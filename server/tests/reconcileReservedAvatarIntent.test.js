const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { before, after, beforeEach, test } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const User = require("../models/userModel");
const Intent = require("../models/avatarUploadIntentModel");
const { initiateAccountDeletion } = require("../services/accountDeletion");
const { reserveAvatarUpload, queueAvatarCleanup, claimAvatarCleanup, recordCleanupResult } = require("../services/avatarUploadIntent");
const { reconcileReservedAvatarIntent } = require("../services/reconcileReservedAvatarIntent");
const { deleteCompletedAvatarIntents } = require("../services/deleteCompletedAvatarIntents");

let db, user, other;
before(async () => {
	db = await MongoMemoryReplSet.create({ binary: { version: "7.0.14" }, replSet: { count: 1, storageEngine: "wiredTiger" } });
	await mongoose.connect(db.getUri(), { dbName: "reconcile_reserved_avatar_intent" });
	await Promise.all([User.init(), Intent.init()]);
}, { timeout: 180000 });
after(async () => { await mongoose.disconnect(); await db?.stop(); });
beforeEach(async () => {
	await Promise.all([User.deleteMany({}), Intent.deleteMany({})]);
	[user, other] = await User.create([
		{ name: "Learner", email: "reconcile-avatar@example.test", googleId: "reconcile-avatar" },
		{ name: "Other", email: "other-reconcile-avatar@example.test", googleId: "other-reconcile-avatar" },
	]);
});

async function reserve(owner = user) {
	return reserveAvatarUpload(owner.id, { operationId: randomUUID(), provider: "local", contentType: "image/jpeg" });
}
async function completeCleanup(owner, intent) {
	await queueAvatarCleanup(owner.id, intent.id);
	const claim = await claimAvatarCleanup(owner.id, intent.id);
	assert.equal(claim.claimed, true);
	await recordCleanupResult(owner.id, intent.id, claim.intent.cleanupGeneration, claim.claimToken, true);
}
async function prepare(owner = user) {
	const intent = await reserve(owner);
	await initiateAccountDeletion(owner.id);
	await completeCleanup(owner, intent);
	return intent;
}

test("reconciles only after a valid completed claim and leaves intent purgeable", async () => {
	const intent = await prepare();
	const result = await reconcileReservedAvatarIntent(user.id, intent.id);
	assert.deepEqual(result, { reconciled: true });
	const reconciled = await Intent.findById(intent.id).lean();
	assert.equal(reconciled.uploadStatus, "finished");
	assert.equal(reconciled.uploadResult, "not_started");
	assert.equal(reconciled.cleanupStatus, "complete");
	assert.ok(await User.exists({ _id: user._id }));
	assert.deepEqual(await reconcileReservedAvatarIntent(user.id, intent.id), { reconciled: true });
	assert.deepEqual(await deleteCompletedAvatarIntents(user.id), { deletedCount: 1, hasMore: false });
	assert.ok(await User.exists({ _id: user._id }));
});

test("preserves pending, retrying, claimed, uncertain, attached, and invalid-proof records", async () => {
	const intents = await Promise.all(Array.from({ length: 7 }, () => reserve()));
	await initiateAccountDeletion(user.id);
	await completeCleanup(user, intents[0]);
	await queueAvatarCleanup(user.id, intents[1].id);
	await queueAvatarCleanup(user.id, intents[2].id);
	const held = await claimAvatarCleanup(user.id, intents[2].id);
	assert.equal(held.claimed, true);
	await queueAvatarCleanup(user.id, intents[3].id);
	const retryClaim = await claimAvatarCleanup(user.id, intents[3].id);
	await recordCleanupResult(user.id, intents[3].id, retryClaim.intent.cleanupGeneration, retryClaim.claimToken, false);
	await Intent.updateOne({ _id: intents[4]._id }, { $set: { uploadStatus: "uncertain", uploadResult: "unknown", cleanupStatus: "retry" } });
	await Intent.updateOne({ _id: intents[5]._id }, { $set: { attachmentStatus: "attached" } });
	await completeCleanup(user, intents[6]);
	await Intent.updateOne({ _id: intents[6]._id }, { $set: { lastCleanupClaimToken: "missing-proof" } });
	for (const intent of intents) {
		await assert.rejects(reconcileReservedAvatarIntent(user.id, intent.id), error => error.statusCode === 409);
		assert.ok(await Intent.exists({ _id: intent._id, user: user._id }));
	}
});

test("requires deleting state and isolates an intent from other accounts", async () => {
	const activeIntent = await reserve();
	await completeCleanup(user, activeIntent);
	await assert.rejects(reconcileReservedAvatarIntent(user.id, activeIntent.id), /Account is not deleting/);
	await initiateAccountDeletion(user.id);
	const foreignIntent = await prepare(other);
	await assert.rejects(reconcileReservedAvatarIntent(user.id, foreignIntent.id), error => error.statusCode === 404);
	assert.equal((await Intent.findById(foreignIntent.id)).uploadStatus, "reserved");
	assert.ok(await User.exists({ _id: other._id }));
});

test("serializes concurrent retries with upload start and returns one stable terminal state", async () => {
	const intent = await prepare();
	const results = await Promise.all(Array.from({ length: 4 }, () => reconcileReservedAvatarIntent(user.id, intent.id)));
	assert.ok(results.every(result => result.reconciled));
	assert.equal(await Intent.countDocuments({ _id: intent._id, uploadStatus: "finished", uploadResult: "not_started" }), 1);
	await assert.rejects(require("../services/avatarUploadIntent").beginAvatarUpload(user.id, intent.id), /Account is not active/);
});

test("rolls back the fence and intent transition if the intent update fails", async t => {
	const intent = await prepare();
	const beforeFence = (await User.findById(user.id).select("+accountWriteFence").lean()).accountWriteFence;
	const original = Intent.findOneAndUpdate;
	const stub = t.mock.method(Intent, "findOneAndUpdate", async function (...args) {
		if (args[0]?._id?.toString() === intent.id && args[0]?.uploadStatus === "reserved") {
			await original.apply(this, args);
			throw new Error("simulated reconciliation write failure");
		}
		return original.apply(this, args);
	});
	try { await assert.rejects(reconcileReservedAvatarIntent(user.id, intent.id), /simulated reconciliation write failure/); }
	finally { stub.mock.restore(); }
	assert.equal((await Intent.findById(intent.id)).uploadStatus, "reserved");
	assert.equal((await User.findById(user.id).select("+accountWriteFence").lean()).accountWriteFence, beforeFence);
});
