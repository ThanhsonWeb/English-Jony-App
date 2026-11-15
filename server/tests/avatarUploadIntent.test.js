const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { before, after, beforeEach, test } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const User = require("../models/userModel");
const AvatarUploadIntent = require("../models/avatarUploadIntentModel");
const { reserveAvatarUpload, beginAvatarUpload, recordUploadOutcome, attachAvatarUpload, queueAvatarCleanup, claimAvatarCleanup, recordCleanupResult } = require("../services/avatarUploadIntent");
const { runAvatarCleanupBatch, recoverAvatarCleanup } = require("../services/avatarCleanupWorker");

let db, owner, other;
const input = () => ({ operationId: randomUUID(), provider: "cloudinary", cloudName: "test", contentType: "image/jpeg" });

before(async () => {
	db = await MongoMemoryReplSet.create({ binary: { version: "7.0.14" }, replSet: { count: 1, storageEngine: "wiredTiger" } });
	await mongoose.connect(db.getUri(), { dbName: "avatar_upload_intents", monitorCommands: true });
	await Promise.all([User.init(), AvatarUploadIntent.init()]);
}, { timeout: 180000 });
after(async () => { await mongoose.disconnect(); await db?.stop(); });
beforeEach(async () => {
	await Promise.all([User.deleteMany({}), AvatarUploadIntent.deleteMany({})]);
	[owner, other] = await User.create([
		{ name: "Owner", email: "owner@example.test", googleId: "owner" },
		{ name: "Other", email: "other@example.test", googleId: "other" },
	]);
});

test("worker respects claim eligibility, retries rejection and holds ambiguous results", async () => {
	const pending = await reserveAvatarUpload(owner.id, input());
	await queueAvatarCleanup(owner.id, pending.id);
	const uncertain = await reserveAvatarUpload(other.id, input());
	await beginAvatarUpload(other.id, uncertain.id);
	await recordUploadOutcome(other.id, uncertain.id, "uncertain");
	const config = { CLOUDINARY_CLOUD_NAME: "test", CLOUDINARY_API_KEY: "key", CLOUDINARY_API_SECRET: "secret" };
	const reject = async () => ({ ok: false, status: 429 });
	assert.deepEqual(await runAvatarCleanupBatch({ config, fetchImpl: reject }), { complete: 0, retry: 1, held: 0, skipped: 0 });
	assert.equal((await AvatarUploadIntent.findById(pending.id)).cleanupStatus, "retry");
	assert.deepEqual(await runAvatarCleanupBatch({ config, fetchImpl: async () => { throw new Error("timeout"); } }),
		{ complete: 0, retry: 0, held: 1, skipped: 0 });
	assert.equal((await AvatarUploadIntent.findById(pending.id)).cleanupStatus, "claimed");
	assert.equal((await AvatarUploadIntent.findById(uncertain.id)).cleanupStatus, "pending");
	assert.deepEqual(await runAvatarCleanupBatch({ config, fetchImpl: async () => assert.fail() }),
		{ complete: 0, retry: 0, held: 0, skipped: 0 });
	assert.equal(await recoverAvatarCleanup(owner.id, pending.id, { config, fetchImpl: async () => ({ ok: true, json: async () => ({ result: "not found" }) }) }), "complete");
	assert.equal((await AvatarUploadIntent.findById(pending.id)).cleanupStatus, "complete");
});

test("workers skip attached and local records by default and claim each key once", async () => {
	const attached = await reserveAvatarUpload(owner.id, input());
	await beginAvatarUpload(owner.id, attached.id);
	await attachAvatarUpload(owner.id, attached.id, "https://example.test/avatar.jpg");
	const local = await reserveAvatarUpload(other.id, { ...input(), provider: "local" });
	await queueAvatarCleanup(other.id, local.id);
	const cloud = await reserveAvatarUpload(other.id, input());
	await queueAvatarCleanup(other.id, cloud.id);
	let calls = 0;
	const config = { CLOUDINARY_CLOUD_NAME: "test", CLOUDINARY_API_KEY: "key", CLOUDINARY_API_SECRET: "secret" };
	const fetchImpl = async () => { calls++; return { ok: true, json: async () => ({ result: "ok" }) }; };
	await Promise.all([runAvatarCleanupBatch({ config, fetchImpl }), runAvatarCleanupBatch({ config, fetchImpl })]);
	assert.equal(calls, 1);
	assert.equal((await AvatarUploadIntent.findById(attached.id)).attachmentStatus, "attached");
	assert.equal((await AvatarUploadIntent.findById(local.id)).cleanupStatus, "pending");
	let localCalls = 0;
	await runAvatarCleanupBatch({ allowLocal: true, config, unlink: async () => { localCalls++; } });
	assert.equal(localCalls, 1);
	assert.equal((await AvatarUploadIntent.findById(local.id)).cleanupStatus, "complete");
});

test("untracked legacy avatars cannot be replaced without losing their cleanup reference", async () => {
	const legacyAvatar = "https://res.cloudinary.com/studyjony/image/upload/v123/legacy/avatar.jpg";
	await User.updateOne({ _id: owner._id }, { $set: { avatar: legacyAvatar } });
	const replacement = await reserveAvatarUpload(owner.id, input());
	await beginAvatarUpload(owner.id, replacement.id);

	await assert.rejects(
		attachAvatarUpload(owner.id, replacement.id, "https://res.cloudinary.com/studyjony/image/upload/v123/replacement.jpg"),
		error => error.statusCode === 409,
	);
	// The upload controller records the successful external upload after attach is rejected.
	await recordUploadOutcome(owner.id, replacement.id, "success");

	const saved = await User.findById(owner.id).select("+avatarIntent");
	const intent = await AvatarUploadIntent.findById(replacement.id).lean();
	assert.equal(saved.avatar, legacyAvatar);
	assert.equal(saved.avatarIntent, undefined);
	assert.equal(intent.uploadStatus, "finished");
	assert.equal(intent.uploadResult, "success");
	assert.equal(intent.attachmentStatus, "unattached");
	assert.equal(intent.cleanupStatus, "pending");
});

test("reservation generates unique, provider-specific storage keys without caller-supplied paths", async () => {
	const cloud = await reserveAvatarUpload(owner.id, { ...input(), storageKey: "forged" });
	const local = await reserveAvatarUpload(owner.id, { ...input(), provider: "local", contentType: "image/png" });
	const another = await reserveAvatarUpload(other.id, input());
	assert.match(cloud.storageKey, new RegExp(`^studyjony/avatars/user_${owner.id}_[0-9a-f-]{36}$`));
	assert.match(local.storageKey, new RegExp(`^user_${owner.id}_[0-9a-f-]{36}\\.png$`));
	assert.notEqual(cloud.storageKey, another.storageKey);
	assert.equal(String(cloud.user), owner.id);
	assert.equal(cloud.cloudName, "test");
	assert.equal(cloud.uploadStatus, "reserved");
	assert.equal(cloud.cleanupStatus, "none");
	assert.equal(cloud.cleanupGeneration, 0);
	for (const options of [{ ...input(), provider: "other" }, { ...input(), contentType: "image/gif" }, { ...input(), operationId: "bad" }]) {
		await assert.rejects(reserveAvatarUpload(owner.id, options), error => error.statusCode === 400);
	}
});

test("a reserved legacy Cloudinary intent without account identity cannot start an upload", async () => {
	const intent = await reserveAvatarUpload(owner.id, input());
	await AvatarUploadIntent.collection.updateOne({ _id: intent._id }, { $unset: { cloudName: "" } });
	const claim = await beginAvatarUpload(owner.id, intent._id);
	assert.equal(claim.claimed, false);
	assert.equal(claim.intent.uploadStatus, "reserved");
	assert.equal(claim.intent.cleanupStatus, "none");
});

test("concurrent reservation and upload-claim retries are idempotent and isolated by owner", async () => {
	const options = input();
	const reservations = await Promise.all(Array.from({ length: 6 }, () => reserveAvatarUpload(owner.id, options)));
	assert.equal(new Set(reservations.map(record => record.id)).size, 1);
	assert.equal(new Set(reservations.map(record => record.storageKey)).size, 1);
	await assert.rejects(reserveAvatarUpload(owner.id, { ...options, contentType: "image/png" }), error => error.statusCode === 409);
	const otherIntent = await reserveAvatarUpload(other.id, options);
	assert.notEqual(otherIntent.storageKey, reservations[0].storageKey);
	const claims = await Promise.all(Array.from({ length: 4 }, () => beginAvatarUpload(owner.id, reservations[0].id)));
	assert.equal(claims.filter(result => result.claimed).length, 1);
	assert.ok(claims.every(result => result.intent.uploadStatus === "uploading"));
	assert.equal(await AvatarUploadIntent.countDocuments(), 2);
});

test("database indexes reject duplicate owner operations and duplicate storage keys", async () => {
	const intent = await reserveAvatarUpload(owner.id, input());
	const duplicate = { user: owner.id, operationId: intent.operationId, provider: intent.provider,
		contentType: intent.contentType, storageKey: `studyjony/avatars/user_${owner.id}_${randomUUID()}` };
	await assert.rejects(AvatarUploadIntent.create(duplicate), error => error.code === 11000);
	await assert.rejects(AvatarUploadIntent.create({ ...duplicate, user: other.id, operationId: randomUUID(), storageKey: intent.storageKey }),
		error => error.code === 11000);
});

test("another account cannot claim or alter an intent or its cleanup", async () => {
	const intent = await reserveAvatarUpload(owner.id, input());
	for (const action of [
		() => beginAvatarUpload(other.id, intent.id),
		() => recordUploadOutcome(other.id, intent.id, "success"),
		() => queueAvatarCleanup(other.id, intent.id),
		() => claimAvatarCleanup(other.id, intent.id),
		() => recordCleanupResult(other.id, intent.id, 1, randomUUID(), true),
	]) await assert.rejects(action(), error => error.statusCode === 404);
	const saved = await AvatarUploadIntent.findById(intent.id);
	assert.equal(saved.uploadStatus, "reserved");
	assert.equal(saved.cleanupStatus, "none");
	assert.equal((await User.findById(other.id).select("+accountWriteFence")).accountWriteFence, 0);
});

test("cleanup retries are durable, idempotent and reject stale or premature success", async () => {
	const intent = await reserveAvatarUpload(owner.id, input());
	assert.equal((await beginAvatarUpload(owner.id, intent.id)).claimed, true);
	assert.equal((await recordUploadOutcome(owner.id, intent.id, "uncertain")).uploadStatus, "uncertain");
	assert.equal((await recordUploadOutcome(owner.id, intent.id, "uncertain")).uploadStatus, "uncertain");
	const first = await queueAvatarCleanup(owner.id, intent.id);
	assert.equal(first.cleanupGeneration, 1);
	assert.equal((await queueAvatarCleanup(owner.id, intent.id)).cleanupGeneration, 1);
	assert.equal((await claimAvatarCleanup(owner.id, intent.id)).claimed, false);
	await assert.rejects(recordCleanupResult(owner.id, intent.id, 1, randomUUID(), true), error => error.statusCode === 409);
	assert.equal((await recordUploadOutcome(owner.id, intent.id, "success")).uploadStatus, "finished");
	const firstClaim = await claimAvatarCleanup(owner.id, intent.id);
	assert.equal(firstClaim.claimed, true);
	assert.equal((await recordCleanupResult(owner.id, intent.id, 1, firstClaim.claimToken, false)).cleanupStatus, "retry");
	assert.equal((await recordCleanupResult(owner.id, intent.id, 1, firstClaim.claimToken, false)).cleanupStatus, "retry");
	const second = await queueAvatarCleanup(owner.id, intent.id);
	assert.equal(second.cleanupGeneration, 2);
	const secondClaim = await claimAvatarCleanup(owner.id, intent.id);
	assert.equal(secondClaim.claimed, true);
	assert.notEqual(secondClaim.claimToken, firstClaim.claimToken);
	await assert.rejects(recordCleanupResult(owner.id, intent.id, 1, firstClaim.claimToken, false), error => error.statusCode === 409);
	await assert.rejects(recordCleanupResult(owner.id, intent.id, 2, firstClaim.claimToken, true), error => error.statusCode === 409);
	assert.equal((await recordCleanupResult(owner.id, intent.id, 2, secondClaim.claimToken, true)).cleanupStatus, "complete");
	assert.equal((await recordCleanupResult(owner.id, intent.id, 2, secondClaim.claimToken, true)).cleanupStatus, "complete");
	assert.equal((await queueAvatarCleanup(owner.id, intent.id)).cleanupStatus, "complete");
	await assert.rejects(recordUploadOutcome(owner.id, intent.id, "uncertain"), error => error.statusCode === 409);
});

test("queued cleanup cancels unstarted uploads and records survive account removal", async () => {
	const intent = await reserveAvatarUpload(owner.id, input());
	const pending = await queueAvatarCleanup(owner.id, intent.id);
	assert.equal((await beginAvatarUpload(owner.id, intent.id)).claimed, false);
	await User.deleteOne({ _id: owner.id });
	const claim = await claimAvatarCleanup(owner.id, intent.id);
	assert.equal(claim.claimed, true);
	assert.equal((await recordCleanupResult(owner.id, intent.id, pending.cleanupGeneration, claim.claimToken, true)).cleanupStatus, "complete");
	assert.ok(await AvatarUploadIntent.findById(intent.id));
	await assert.rejects(reserveAvatarUpload(owner.id, input()), error => error.statusCode === 401);
});

test("concurrent workers receive only one claim and cannot report with another token", async () => {
	const intent = await reserveAvatarUpload(owner.id, input());
	await queueAvatarCleanup(owner.id, intent.id);
	const attempts = await Promise.all(Array.from({ length: 12 }, () => claimAvatarCleanup(owner.id, intent.id)));
	const winners = attempts.filter(result => result.claimed);
	assert.equal(winners.length, 1);
	assert.ok(attempts.filter(result => !result.claimed).every(result => !result.claimToken && !result.intent.cleanupClaimToken));
	const winner = winners[0];
	assert.equal(winner.intent.cleanupStatus, "claimed");
	assert.equal(winner.intent.cleanupClaimToken, undefined);
	await assert.rejects(recordCleanupResult(owner.id, intent.id, winner.intent.cleanupGeneration, randomUUID(), true),
		error => error.statusCode === 409);
	assert.equal((await AvatarUploadIntent.findById(intent.id)).cleanupStatus, "claimed");
	assert.equal((await recordCleanupResult(owner.id, intent.id, winner.intent.cleanupGeneration, winner.claimToken, true)).cleanupStatus, "complete");
	assert.equal((await claimAvatarCleanup(owner.id, intent.id)).claimed, false);
});

test("cleanup claims exclude attached, uploading and uncertain avatars", async () => {
	const uploading = await reserveAvatarUpload(owner.id, input());
	await beginAvatarUpload(owner.id, uploading.id);
	assert.equal((await claimAvatarCleanup(owner.id, uploading.id)).claimed, false);
	await recordUploadOutcome(owner.id, uploading.id, "uncertain");
	assert.equal((await claimAvatarCleanup(owner.id, uploading.id)).claimed, false);
	await AvatarUploadIntent.updateOne({ _id: uploading.id }, { $set: { uploadStatus: "finished", uploadResult: "unknown" } });
	assert.equal((await claimAvatarCleanup(owner.id, uploading.id)).claimed, false);
	await AvatarUploadIntent.updateOne({ _id: uploading.id }, { $set: { uploadStatus: "uncertain", uploadResult: "unknown" } });
	await recordUploadOutcome(owner.id, uploading.id, "failure");
	assert.equal((await claimAvatarCleanup(owner.id, uploading.id)).claimed, true);

	const attached = await reserveAvatarUpload(other.id, input());
	await beginAvatarUpload(other.id, attached.id);
	await attachAvatarUpload(other.id, attached.id, "https://example.test/avatar.jpg");
	// Even a malformed pending state must never make an attached avatar claimable.
	await AvatarUploadIntent.updateOne({ _id: attached.id }, { $set: { cleanupStatus: "pending" } });
	assert.equal((await claimAvatarCleanup(other.id, attached.id)).claimed, false);
});

test("cleanup claims cannot race an upload start or avatar attachment", async () => {
	const unstarted = await reserveAvatarUpload(owner.id, input());
	await queueAvatarCleanup(owner.id, unstarted.id);
	const [cleanup, upload] = await Promise.all([
		claimAvatarCleanup(owner.id, unstarted.id), beginAvatarUpload(owner.id, unstarted.id),
	]);
	assert.equal(cleanup.claimed, true);
	assert.equal(upload.claimed, false);

	const inFlight = await reserveAvatarUpload(other.id, input());
	await beginAvatarUpload(other.id, inFlight.id);
	const [claim, user] = await Promise.all([
		claimAvatarCleanup(other.id, inFlight.id),
		attachAvatarUpload(other.id, inFlight.id, "https://example.test/avatar.jpg"),
	]);
	assert.equal(claim.claimed, false);
	assert.equal(user.avatar, "https://example.test/avatar.jpg");
	assert.equal((await AvatarUploadIntent.findById(inFlight.id)).attachmentStatus, "attached");
});

test("claim transaction rollback leaves the pending cleanup claimable", async () => {
	const intent = await reserveAvatarUpload(owner.id, input());
	await queueAvatarCleanup(owner.id, intent.id);
	const original = AvatarUploadIntent.findOneAndUpdate;
	AvatarUploadIntent.findOneAndUpdate = async function (...args) {
		assert.equal(args[1].$set.cleanupStatus, "claimed");
		assert.ok(args[2].session?.inTransaction());
		await original.apply(this, args);
		throw new Error("simulated claim transaction failure");
	};
	try { await assert.rejects(claimAvatarCleanup(owner.id, intent.id), /simulated claim transaction failure/); }
	finally { AvatarUploadIntent.findOneAndUpdate = original; }
	const saved = await AvatarUploadIntent.findById(intent.id).select("+cleanupClaimToken");
	assert.equal(saved.cleanupStatus, "pending");
	assert.equal(saved.cleanupClaimToken, undefined);
	assert.equal((await claimAvatarCleanup(owner.id, intent.id)).claimed, true);
});

test("deleting accounts cannot reserve or claim uploads; legacy active accounts can", async () => {
	const intent = await reserveAvatarUpload(owner.id, input());
	await User.updateOne({ _id: owner.id }, { $set: { lifecycleState: "deleting" } });
	await assert.rejects(reserveAvatarUpload(owner.id, input()), error => error.statusCode === 401);
	await assert.rejects(beginAvatarUpload(owner.id, intent.id), error => error.statusCode === 401);
	await User.collection.updateOne({ _id: owner._id }, { $unset: { lifecycleState: "" } });
	assert.equal((await beginAvatarUpload(owner.id, intent.id)).claimed, true);
});

test("reservation racing behind a deletion transition cannot create an intent", { timeout: 15000 }, async () => {
	let entered, release;
	const enteredDeletion = new Promise(resolve => { entered = resolve; });
	const releaseDeletion = new Promise(resolve => { release = resolve; });
	const deletion = mongoose.connection.transaction(async session => {
		await User.updateOne({ _id: owner._id, lifecycleState: "active" }, { $set: { lifecycleState: "deleting" } }, { session });
		entered();
		await releaseDeletion;
	});
	await enteredDeletion;
	const sent = new Promise(resolve => {
		const client = mongoose.connection.getClient();
		const listener = event => {
			if (event.commandName !== "findAndModify" || event.command.findAndModify !== User.collection.name) return;
			client.off("commandStarted", listener);
			resolve();
		};
		client.on("commandStarted", listener);
	});
	const rejected = assert.rejects(reserveAvatarUpload(owner.id, input()), error => error.statusCode === 401);
	try { await sent; } finally { release(); }
	await Promise.all([deletion, rejected]);
	assert.equal(await AvatarUploadIntent.countDocuments(), 0);
});

test("reservation failure rolls back the intent and the account fence", async () => {
	const original = AvatarUploadIntent.create;
	AvatarUploadIntent.create = async function (...args) {
		assert.ok(args[1]?.session?.inTransaction());
		await original.apply(this, args);
		throw new Error("simulated reservation failure");
	};
	try { await assert.rejects(reserveAvatarUpload(owner.id, input()), /simulated reservation failure/); }
	finally { AvatarUploadIntent.create = original; }
	assert.equal(await AvatarUploadIntent.countDocuments(), 0);
	assert.equal((await User.findById(owner.id).select("+accountWriteFence")).accountWriteFence, 0);
});
