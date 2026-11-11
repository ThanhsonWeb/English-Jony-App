const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { before, after, beforeEach, test } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const User = require("../models/userModel");
const AvatarUploadIntent = require("../models/avatarUploadIntentModel");
const { reserveAvatarUpload, beginAvatarUpload, recordUploadOutcome, queueAvatarCleanup, recordCleanupResult } = require("../services/avatarUploadIntent");

let db, owner, other;
const input = () => ({ operationId: randomUUID(), provider: "cloudinary", contentType: "image/jpeg" });

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

test("reservation generates unique, provider-specific storage keys without caller-supplied paths", async () => {
	const cloud = await reserveAvatarUpload(owner.id, { ...input(), storageKey: "forged" });
	const local = await reserveAvatarUpload(owner.id, { ...input(), provider: "local", contentType: "image/png" });
	const another = await reserveAvatarUpload(other.id, input());
	assert.match(cloud.storageKey, new RegExp(`^studyjony/avatars/user_${owner.id}_[0-9a-f-]{36}$`));
	assert.match(local.storageKey, new RegExp(`^user_${owner.id}_[0-9a-f-]{36}\\.png$`));
	assert.notEqual(cloud.storageKey, another.storageKey);
	assert.equal(String(cloud.user), owner.id);
	assert.equal(cloud.uploadStatus, "reserved");
	assert.equal(cloud.cleanupStatus, "none");
	assert.equal(cloud.cleanupGeneration, 0);
	for (const options of [{ ...input(), provider: "other" }, { ...input(), contentType: "image/gif" }, { ...input(), operationId: "bad" }]) {
		await assert.rejects(reserveAvatarUpload(owner.id, options), error => error.statusCode === 400);
	}
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
		() => recordUploadOutcome(other.id, intent.id, "finished"),
		() => queueAvatarCleanup(other.id, intent.id),
		() => recordCleanupResult(other.id, intent.id, 1, true),
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
	await assert.rejects(recordCleanupResult(owner.id, intent.id, 1, true), error => error.statusCode === 409);
	assert.equal((await recordCleanupResult(owner.id, intent.id, 1, false)).cleanupStatus, "retry");
	assert.equal((await recordCleanupResult(owner.id, intent.id, 1, false)).cleanupStatus, "retry");
	const second = await queueAvatarCleanup(owner.id, intent.id);
	assert.equal(second.cleanupGeneration, 2);
	await assert.rejects(recordCleanupResult(owner.id, intent.id, 1, false), error => error.statusCode === 409);
	await assert.rejects(recordCleanupResult(owner.id, intent.id, 2, true), error => error.statusCode === 409);
	assert.equal((await recordUploadOutcome(owner.id, intent.id, "finished")).uploadStatus, "finished");
	assert.equal((await recordCleanupResult(owner.id, intent.id, 2, true)).cleanupStatus, "complete");
	assert.equal((await recordCleanupResult(owner.id, intent.id, 2, true)).cleanupStatus, "complete");
	assert.equal((await queueAvatarCleanup(owner.id, intent.id)).cleanupStatus, "complete");
	await assert.rejects(recordUploadOutcome(owner.id, intent.id, "uncertain"), error => error.statusCode === 409);
});

test("queued cleanup cancels unstarted uploads and records survive account removal", async () => {
	const intent = await reserveAvatarUpload(owner.id, input());
	const pending = await queueAvatarCleanup(owner.id, intent.id);
	assert.equal((await beginAvatarUpload(owner.id, intent.id)).claimed, false);
	await User.deleteOne({ _id: owner.id });
	assert.equal((await recordCleanupResult(owner.id, intent.id, pending.cleanupGeneration, true)).cleanupStatus, "complete");
	assert.ok(await AvatarUploadIntent.findById(intent.id));
	await assert.rejects(reserveAvatarUpload(owner.id, input()), error => error.statusCode === 401);
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
