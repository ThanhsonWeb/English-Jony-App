const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { before, after, beforeEach, test } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const User = require("../models/userModel");
const Intent = require("../models/avatarUploadIntentModel");
const Topic = require("../models/topicModel");
const { initiateAccountDeletion } = require("../services/accountDeletion");
const { claimAvatarCleanup, recordCleanupResult } = require("../services/avatarUploadIntent");
const { deleteCompletedAvatarIntents } = require("../services/deleteCompletedAvatarIntents");

let db, user, other;
before(async () => {
	db = await MongoMemoryReplSet.create({ binary: { version: "7.0.14" }, replSet: { count: 1, storageEngine: "wiredTiger" } });
	await mongoose.connect(db.getUri(), { dbName: "delete_completed_avatar_intents" });
	await Promise.all([User.init(), Intent.init(), Topic.init()]);
}, { timeout: 180000 });
after(async () => { await mongoose.disconnect(); await db?.stop(); });
beforeEach(async () => {
	await Promise.all([User.deleteMany({}), Intent.deleteMany({}), Topic.deleteMany({})]);
	[user, other] = await User.create([
		{ name: "Learner", email: "avatar-intent-delete@example.test", googleId: "avatar-intent-delete" },
		{ name: "Other", email: "other-avatar-intent-delete@example.test", googleId: "other-avatar-intent-delete" },
	]);
});

async function createIntent(owner, overrides = {}) {
	const provider = overrides.provider || "local";
	const key = `user_${owner.id}_${randomUUID()}`;
	return Intent.create({
		user: owner._id, operationId: randomUUID(), provider,
		cloudName: provider === "cloudinary" ? "studyjony-test" : undefined,
		contentType: "image/jpeg", storageKey: provider === "cloudinary" ? `studyjony/avatars/${key}` : `${key}.jpg`,
		uploadStatus: "finished", uploadResult: "success", attachmentStatus: "unattached", cleanupStatus: "complete",
		cleanupGeneration: 1, lastCleanupClaimToken: randomUUID(), ...overrides,
	});
}
async function markDeleting() { await initiateAccountDeletion(user.id); }

test("requires an existing account in deleting state and valid batch size", async () => {
	await assert.rejects(deleteCompletedAvatarIntents("invalid"), error => error.statusCode === 400);
	await assert.rejects(deleteCompletedAvatarIntents(user.id), error => error.statusCode === 409);
	await assert.rejects(deleteCompletedAvatarIntents(new mongoose.Types.ObjectId()), error => error.statusCode === 404);
	await markDeleting();
	for (const batchSize of [0, -1, 1.5, 1001]) {
		await assert.rejects(deleteCompletedAvatarIntents(user.id, { batchSize }), error => error.statusCode === 400);
	}
});

test("deletes only proven completed intents in bounded retryable batches", async () => {
	const cloudKey = `studyjony/avatars/user_${user.id}_${randomUUID()}`;
	await Promise.all([
		createIntent(user), createIntent(user, { uploadResult: "failure" }),
		createIntent(user, { provider: "cloudinary", storageKey: cloudKey }),
	]);
	const foreign = await createIntent(other);
	const topic = await Topic.create({ user: user._id, name: "Keep" });
	await markDeleting();
	assert.deepEqual(await deleteCompletedAvatarIntents(user.id, { batchSize: 2 }), { deletedCount: 2, hasMore: true });
	assert.deepEqual(await deleteCompletedAvatarIntents(user.id, { batchSize: 2 }), { deletedCount: 1, hasMore: false });
	assert.deepEqual(await deleteCompletedAvatarIntents(user.id), { deletedCount: 0, hasMore: false });
	assert.ok(await Intent.exists({ _id: foreign._id, user: other._id }));
	assert.ok(await User.exists({ _id: user._id }));
	assert.ok(await Topic.exists({ _id: topic._id }));
});

test("accepts a definitively completed claim recorded by the existing cleanup mechanism", async () => {
	const intent = await createIntent(user, { cleanupStatus: "pending" });
	await markDeleting();
	const claim = await claimAvatarCleanup(user.id, intent.id);
	assert.equal(claim.claimed, true);
	await recordCleanupResult(user.id, intent.id, claim.intent.cleanupGeneration, claim.claimToken, true);
	assert.deepEqual(await deleteCompletedAvatarIntents(user.id), { deletedCount: 1, hasMore: false });
});

test("retains uncertain, unfinished, pending, claimed, retrying, and inconsistent records", async () => {
	const unresolved = await Promise.all([
		createIntent(user, { uploadStatus: "reserved", uploadResult: null }),
		createIntent(user, { uploadStatus: "uploading", uploadResult: null, cleanupStatus: "pending" }),
		createIntent(user, { uploadStatus: "uncertain", uploadResult: "unknown", cleanupStatus: "retry" }),
		createIntent(user, { uploadResult: "unknown" }),
		createIntent(user, { cleanupStatus: "pending" }),
		createIntent(user, { cleanupStatus: "retry" }),
		createIntent(user, { cleanupStatus: "claimed", cleanupClaimToken: randomUUID() }),
		createIntent(user, { cleanupClaimToken: randomUUID() }),
		createIntent(user, { cleanupGeneration: 0 }),
		createIntent(user, { storageKey: "../invalid.jpg" }),
		createIntent(user, { operationId: "invalid-operation" }),
		createIntent(user, { lastCleanupClaimToken: "invalid-claim" }),
		createIntent(user, { cleanupGeneration: 1.5 }),
	]);
	const malformed = await createIntent(user);
	await Intent.collection.updateOne({ _id: malformed._id }, { $set: { uploadStatus: ["finished"] } });
	const referenced = await createIntent(user);
	const urlReferenced = await createIntent(user);
	const missingCloudIdentity = await createIntent(user, { provider: "cloudinary" });
	await Intent.collection.updateOne({ _id: missingCloudIdentity._id }, { $unset: { cloudName: "" } });
	await User.updateOne({ _id: other._id }, { $set: { avatarIntent: referenced._id, avatar: `/api/v1/users/avatar-files/${urlReferenced.storageKey}` } });
	await createIntent(user);
	await markDeleting();
	assert.deepEqual(await deleteCompletedAvatarIntents(user.id), { deletedCount: 1, hasMore: false });
	assert.equal(await Intent.countDocuments({ _id: { $in: unresolved.map(item => item._id) } }), unresolved.length);
	assert.ok(await Intent.exists({ _id: malformed._id }));
	assert.ok(await Intent.exists({ _id: referenced._id }));
	assert.ok(await Intent.exists({ _id: urlReferenced._id }));
	assert.ok(await Intent.exists({ _id: missingCloudIdentity._id }));
});

test("retains all candidates while account avatar tracking is unresolved", async () => {
	const completed = await createIntent(user);
	await markDeleting();
	await User.updateOne({ _id: user._id }, { $set: { avatar: "https://legacy.example/avatar.jpg" } });
	assert.deepEqual(await deleteCompletedAvatarIntents(user.id), { deletedCount: 0, hasMore: false, blocked: "avatar_tracking_unresolved" });
	await User.updateOne({ _id: user._id }, { $set: { avatar: "", avatarIntent: completed._id } });
	assert.equal((await deleteCompletedAvatarIntents(user.id)).blocked, "avatar_tracking_unresolved");
	await User.updateOne({ _id: user._id }, { $unset: { avatarIntent: 1 } });
	const attached = await createIntent(user, { attachmentStatus: "attached" });
	assert.equal((await deleteCompletedAvatarIntents(user.id)).blocked, "avatar_tracking_unresolved");
	assert.ok(await Intent.exists({ _id: completed._id }));
	assert.ok(await Intent.exists({ _id: attached._id }));
});

test("concurrent cleanup calls are isolated and idempotent", async () => {
	await Promise.all(Array.from({ length: 4 }, () => createIntent(user)));
	const foreign = await createIntent(other);
	await markDeleting();
	const results = await Promise.all([
		deleteCompletedAvatarIntents(user.id, { batchSize: 4 }),
		deleteCompletedAvatarIntents(user.id, { batchSize: 4 }),
	]);
	assert.equal(results.reduce((sum, result) => sum + result.deletedCount, 0), 4);
	assert.equal(await Intent.countDocuments({ user: user._id }), 0);
	assert.ok(await Intent.exists({ _id: foreign._id, user: other._id }));
});

test("rolls back a failed transactional batch", async t => {
	const records = await Promise.all([createIntent(user), createIntent(user)]);
	await markDeleting();
	const original = Intent.deleteMany;
	const stub = t.mock.method(Intent, "deleteMany", async function (...args) {
		assert.ok(args[1]?.session?.inTransaction());
		await original.apply(this, args);
		throw new Error("simulated avatar intent cleanup failure");
	});
	try { await assert.rejects(deleteCompletedAvatarIntents(user.id), /simulated avatar intent cleanup failure/); }
	finally { stub.mock.restore(); }
	assert.equal(await Intent.countDocuments({ _id: { $in: records.map(item => item._id) } }), 2);
});

