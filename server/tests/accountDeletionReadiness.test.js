const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { before, after, beforeEach, test } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const User = require("../models/userModel");
const Intent = require("../models/avatarUploadIntentModel");
const { initiateAccountDeletion } = require("../services/accountDeletion");
const { checkAccountDeletionReadiness } = require("../services/accountDeletionReadiness");
const { reserveAvatarUpload, queueAvatarCleanup, claimAvatarCleanup } = require("../services/avatarUploadIntent");

let db, user;
const legacy = "https://legacy.example.test/avatar.jpg";
before(async () => {
	db = await MongoMemoryReplSet.create({ binary: { version: "7.0.14" }, replSet: { count: 1, storageEngine: "wiredTiger" } });
	await mongoose.connect(db.getUri(), { dbName: "account_deletion_readiness", monitorCommands: true });
	await Promise.all([User.init(), Intent.init()]);
}, { timeout: 180000 });
after(async () => { await mongoose.disconnect(); await db?.stop(); });
beforeEach(async () => {
	await Promise.all([User.deleteMany({}), Intent.deleteMany({})]);
	user = await User.create({ name: "Learner", email: "readiness@example.test", googleId: "readiness", avatar: legacy });
});

async function deletingAccount({ keepLegacy = false } = {}) {
	await initiateAccountDeletion(user.id);
	if (!keepLegacy) await User.updateOne({ _id: user.id }, { $set: { avatar: "" } });
}
async function createIntent({ uploadStatus = "reserved", uploadResult = null, cleanupStatus = "none", attachmentStatus = "unattached", provider = "local" } = {}) {
	const intent = await reserveAvatarUpload(user.id, { operationId: randomUUID(), provider, contentType: "image/jpeg" });
	const fields = { uploadStatus, uploadResult, cleanupStatus, attachmentStatus };
	await Intent.updateOne({ _id: intent.id }, { $set: fields });
	return Intent.findById(intent.id).lean();
}
async function blockers() { return (await checkAccountDeletionReadiness(user.id)).blockers; }

test("reports ready after deletion when no tracked or legacy avatar remains", async () => {
	await deletingAccount();
	assert.deepEqual(await checkAccountDeletionReadiness(user.id), { ready: true, blockers: [] });
});

test("an unresolved legacy avatar blocks readiness", async () => {
	await deletingAccount({ keepLegacy: true });
	assert.deepEqual(await blockers(), ["legacy_avatar_unresolved"]);
});

test("an account that has not entered deletion is not ready", async () => {
	assert.deepEqual(await blockers(), ["account_not_deleting", "legacy_avatar_unresolved"]);
});

test("unfinished and uncertain upload outcomes block readiness", async () => {
	const intent = await createIntent();
	await deletingAccount();
	for (const [uploadStatus, uploadResult] of [["reserved", null], ["uploading", null], ["uncertain", "unknown"], ["finished", "unknown"]]) {
		await Intent.updateOne({ _id: intent._id }, { $set: { uploadStatus, uploadResult, cleanupStatus: "pending" } });
		const found = await blockers();
		assert.ok(found.includes("avatar_upload_unfinished"), `${uploadStatus}/${uploadResult}`);
		assert.ok(found.includes("avatar_cleanup_pending"), `${uploadStatus}/${uploadResult}`);
	}
});

test("pending, retry, and held cleanup claims are distinct blockers", async () => {
	const intent = await createIntent({ uploadStatus: "finished", uploadResult: "success", cleanupStatus: "pending" });
	await deletingAccount();
	assert.deepEqual(await blockers(), ["avatar_cleanup_pending"]);
	await queueAvatarCleanup(user.id, intent._id);
	await Intent.updateOne({ _id: intent._id }, { $set: { cleanupStatus: "retry" } });
	assert.deepEqual(await blockers(), ["avatar_cleanup_pending"]);
	await Intent.updateOne({ _id: intent._id }, { $set: { cleanupStatus: "pending" } });
	assert.equal((await claimAvatarCleanup(user.id, intent._id)).claimed, true);
	assert.deepEqual(await blockers(), ["avatar_cleanup_claim_held"]);
});

test("completed unattached cleanup is safe", async () => {
	await createIntent({ uploadStatus: "finished", uploadResult: "success", cleanupStatus: "complete" });
	await deletingAccount();
	assert.deepEqual(await checkAccountDeletionReadiness(user.id), { ready: true, blockers: [] });
});

test("inconsistent tracking and attached avatar records fail closed", async () => {
	const intent = await createIntent({ uploadStatus: "finished", uploadResult: "success", attachmentStatus: "attached", cleanupStatus: "none" });
	await deletingAccount();
	await User.updateOne({ _id: user.id }, { $set: { avatarIntent: intent._id, avatar: "https://res.cloudinary.com/demo/image/upload/v123/studyjony/avatars/mismatched.jpg" } });
	assert.ok((await blockers()).includes("avatar_tracking_inconsistent"));
	await User.updateOne({ _id: user.id }, { $unset: { avatarIntent: 1 } });
	assert.ok((await blockers()).includes("avatar_tracking_inconsistent"));
});

test("checker performs only reads and does not change account or intent state", async () => {
	const intent = await createIntent({ uploadStatus: "finished", uploadResult: "success", cleanupStatus: "pending" });
	await deletingAccount();
	const beforeUser = await User.findById(user.id).select("+lifecycleState +avatarIntent").lean();
	const beforeIntent = await Intent.findById(intent._id).lean();
	const writes = [];
	const client = mongoose.connection.getClient();
	const listener = event => {
		const isWrite = ["insert", "update", "delete", "findAndModify", "bulkWrite"].includes(event.commandName);
		const collection = event.command?.insert ?? event.command?.update ?? event.command?.delete ?? event.command?.findAndModify;
		if (isWrite && [User.collection.name, Intent.collection.name].includes(collection)) writes.push(event.commandName);
	};
	client.on("commandStarted", listener);
	try { await checkAccountDeletionReadiness(user.id); }
	finally { client.off("commandStarted", listener); }
	assert.deepEqual(writes, []);
	assert.deepEqual(await User.findById(user.id).select("+lifecycleState +avatarIntent").lean(), beforeUser);
	assert.deepEqual(await Intent.findById(intent._id).lean(), beforeIntent);
});

test("invalid and missing accounts are rejected", async () => {
	await assert.rejects(checkAccountDeletionReadiness("invalid"), error => error.statusCode === 400);
	await assert.rejects(checkAccountDeletionReadiness(new mongoose.Types.ObjectId()), error => error.statusCode === 404);
});
