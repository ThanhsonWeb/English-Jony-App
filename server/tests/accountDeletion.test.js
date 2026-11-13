const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { before, after, beforeEach, test } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const User = require("../models/userModel");
const Intent = require("../models/avatarUploadIntentModel");
const { initiateAccountDeletion } = require("../services/accountDeletion");
const { reserveAvatarUpload, beginAvatarUpload, attachAvatarUpload, recordUploadOutcome, claimAvatarCleanup } = require("../services/avatarUploadIntent");

let db, user, other;
const legacy = "https://example.test/old-avatar.jpg";
before(async () => {
	db = await MongoMemoryReplSet.create({ binary: { version: "7.0.14" }, replSet: { count: 1, storageEngine: "wiredTiger" } });
	await mongoose.connect(db.getUri(), { dbName: "account_deletion_initiation", monitorCommands: true });
	await Promise.all([User.init(), Intent.init()]);
}, { timeout: 180000 });
after(async () => { await mongoose.disconnect(); await db?.stop(); });
beforeEach(async () => {
	await Promise.all([User.deleteMany({}), Intent.deleteMany({})]);
	[user, other] = await User.create([
		{ name: "Learner", email: "deletion@example.test", googleId: "deletion" },
		{ name: "Other", email: "other@example.test", googleId: "other" },
	]);
});

async function startUpload(owner = user) {
	const intent = await reserveAvatarUpload(owner.id, { operationId: randomUUID(), provider: "cloudinary", cloudName: "studyjony-test", contentType: "image/jpeg" });
	assert.equal((await beginAvatarUpload(owner.id, intent.id)).claimed, true);
	return intent;
}
function cloudAvatarUrl(intent) {
	return `https://res.cloudinary.com/studyjony-test/image/upload/v123/${intent.storageKey}.jpg`;
}
async function attach(owner = user) {
	const intent = await startUpload(owner);
	await attachAvatarUpload(owner.id, intent.id, cloudAvatarUrl(intent));
	return intent;
}
async function savedUser() { return User.findById(user.id).select("+lifecycleState +avatarIntent").lean(); }
function waitForUserWrite() {
	const client = mongoose.connection.getClient();
	return new Promise(resolve => {
		const listener = event => {
			if (event.commandName !== "findAndModify" || event.command.findAndModify !== User.collection.name) return;
			client.off("commandStarted", listener); resolve();
		};
		client.on("commandStarted", listener);
	});
}

test("tracked avatar is detached and queued exactly once under concurrent initiation", async t => {
	const avatar = await attach();
	await User.updateOne({ _id: other._id }, { $set: { avatar: legacy } });
	const fetch = t.mock.method(global, "fetch", () => { throw new Error("unexpected storage request"); });
	try {
		const results = await Promise.all(Array.from({ length: 6 }, () => initiateAccountDeletion(user.id)));
		assert.equal(results.filter(result => result.initiated).length, 1);
		assert.equal(results.filter(result => !result.initiated).length, 5);
		const saved = await savedUser(), intent = await Intent.findById(avatar.id).lean();
		assert.equal(saved.lifecycleState, "deleting");
		assert.equal(saved.avatarIntent, undefined);
		assert.equal(saved.avatar, "");
		assert.equal(intent.attachmentStatus, "unattached");
		assert.equal(intent.cleanupStatus, "pending");
		assert.equal(intent.cleanupGeneration, 2);
		assert.equal((await claimAvatarCleanup(user.id, avatar.id)).claimed, true);
		assert.equal(await User.countDocuments(), 2);
		assert.equal((await User.findById(other.id)).avatar, legacy);
		assert.equal(fetch.mock.callCount(), 0);
	} finally { fetch.mock.restore(); }
});

test("legacy avatars and old active accounts remain untouched and no storage intent is invented", async () => {
	await User.updateOne({ _id: user._id }, { $set: { avatar: legacy } });
	await User.collection.updateOne({ _id: user._id }, { $unset: { lifecycleState: "" } });
	assert.deepEqual(await initiateAccountDeletion(user.id), { initiated: true });
	const saved = await savedUser();
	assert.equal(saved.lifecycleState, "deleting");
	assert.equal(saved.avatar, legacy);
	assert.equal(saved.avatarIntent, undefined);
	assert.equal(await Intent.countDocuments(), 0);
	assert.deepEqual(await initiateAccountDeletion(user.id), { initiated: false });
});

test("a tracked avatar URL for another Cloudinary account is preserved and blocks initiation", async () => {
	const intent = await attach();
	const mismatchedUrl = `https://res.cloudinary.com/other-account/image/upload/v123/${intent.storageKey}.jpg`;
	await User.updateOne({ _id: user._id }, { $set: { avatar: mismatchedUrl } });
	await assert.rejects(initiateAccountDeletion(user.id), error => error.statusCode === 409);
	const saved = await savedUser();
	assert.equal(saved.lifecycleState, "active");
	assert.equal(String(saved.avatarIntent), String(intent._id));
	assert.equal(saved.avatar, mismatchedUrl);
	const tracked = await Intent.findById(intent._id).lean();
	assert.equal(tracked.attachmentStatus, "attached");
	assert.equal(tracked.cleanupStatus, "none");
});

test("missing, foreign or inconsistent tracked intents fail closed and roll back", async () => {
	const foreign = await attach(other);
	for (const id of [foreign._id, new mongoose.Types.ObjectId()]) {
		await User.updateOne({ _id: user.id }, { $set: { avatarIntent: id } });
		await assert.rejects(initiateAccountDeletion(user.id), error => error.statusCode === 409);
		const saved = await savedUser();
		assert.equal(saved.lifecycleState, "active");
		assert.equal(String(saved.avatarIntent), String(id));
		assert.equal(saved.avatar, "");
	}
	assert.equal((await Intent.findById(foreign.id)).attachmentStatus, "attached");
	await assert.rejects(initiateAccountDeletion(new mongoose.Types.ObjectId()), error => error.statusCode === 404);
	await assert.rejects(initiateAccountDeletion("invalid"), error => error.statusCode === 400);
});

test("failure after detaching the intent rolls back both records", async t => {
	const avatar = await attach();
	const original = Intent.findOneAndUpdate;
	const stub = t.mock.method(Intent, "findOneAndUpdate", async function (...args) {
		await original.apply(this, args);
		throw new Error("simulated detach failure");
	});
	try { await assert.rejects(initiateAccountDeletion(user.id), /simulated detach failure/); }
	finally { stub.mock.restore(); }
	const saved = await savedUser(), intent = await Intent.findById(avatar.id).lean();
	assert.equal(saved.lifecycleState, "active");
	assert.equal(String(saved.avatarIntent), avatar.id);
	assert.equal(intent.attachmentStatus, "attached");
	assert.equal(intent.cleanupStatus, "none");
});

test("an attached intent with an uncertain upload is not queued", async () => {
	const avatar = await attach();
	await Intent.updateOne({ _id: avatar.id }, { $set: { uploadStatus: "uncertain", uploadResult: "unknown" } });
	await assert.rejects(initiateAccountDeletion(user.id), error => error.statusCode === 409);
	assert.equal((await savedUser()).lifecycleState, "active");
	const intent = await Intent.findById(avatar.id);
	assert.equal(intent.attachmentStatus, "attached");
	assert.equal(intent.cleanupStatus, "none");
});

test("an already deleting account with a tracked avatar fails closed", async () => {
	const avatar = await attach();
	await User.updateOne({ _id: user.id }, { $set: { lifecycleState: "deleting" } });
	await assert.rejects(initiateAccountDeletion(user.id), error => error.statusCode === 409);
	assert.equal((await Intent.findById(avatar.id)).attachmentStatus, "attached");
});

test("in-flight and uncertain uploads stay tracked and cannot attach after initiation", async () => {
	const uploading = await startUpload();
	const uncertain = await startUpload();
	await recordUploadOutcome(user.id, uncertain.id, "uncertain");
	await initiateAccountDeletion(user.id);
	await assert.rejects(attachAvatarUpload(user.id, uploading.id, "https://example.test/new.jpg"), error => error.statusCode === 401);
	assert.equal((await claimAvatarCleanup(user.id, uploading.id)).claimed, false);
	assert.equal((await claimAvatarCleanup(user.id, uncertain.id)).claimed, false);
	await recordUploadOutcome(user.id, uploading.id, "success");
	assert.equal((await claimAvatarCleanup(user.id, uploading.id)).claimed, true);
	assert.equal((await Intent.findById(uncertain.id)).uploadStatus, "uncertain");
	assert.equal((await savedUser()).avatar, "");
});

test("a reservation made before deletion cannot start storage afterwards", async () => {
	const reserved = await reserveAvatarUpload(user.id, { operationId: randomUUID(), provider: "local", contentType: "image/png" });
	await initiateAccountDeletion(user.id);
	await assert.rejects(beginAvatarUpload(user.id, reserved.id), error => error.statusCode === 401);
	const saved = await Intent.findById(reserved.id).lean();
	assert.equal(saved.uploadStatus, "reserved");
	assert.equal(saved.cleanupStatus, "none");
	assert.equal(saved.attachmentStatus, "unattached");
});

test("attachment already holding the fence commits before deletion and its new avatar is queued", async t => {
	const old = await attach(), next = await startUpload();
	let entered, release;
	const enteredWrite = new Promise(resolve => { entered = resolve; });
	const releaseWrite = new Promise(resolve => { release = resolve; });
	const original = User.findByIdAndUpdate;
	const stub = t.mock.method(User, "findByIdAndUpdate", function (...args) {
		const query = original.apply(this, args);
		const exec = query.exec;
		query.exec = async function (...execArgs) { const result = await exec.apply(this, ...execArgs); entered(); await releaseWrite; return result; };
		return query;
	});
	try {
		const attaching = attachAvatarUpload(user.id, next.id, cloudAvatarUrl(next));
		await enteredWrite;
		const sent = waitForUserWrite();
		const deleting = initiateAccountDeletion(user.id);
		await sent; release();
		await Promise.all([attaching, deleting]);
		assert.equal((await savedUser()).lifecycleState, "deleting");
		for (const id of [old.id, next.id]) {
			const intent = await Intent.findById(id).lean();
			assert.equal(intent.attachmentStatus, "unattached");
			assert.equal(intent.cleanupStatus, "pending");
		}
	} finally { release(); stub.mock.restore(); }
});

test("deletion holding the fence prevents an in-flight upload from attaching", async t => {
	const current = await attach(), uploading = await startUpload();
	let entered, release;
	const enteredWrite = new Promise(resolve => { entered = resolve; });
	const releaseWrite = new Promise(resolve => { release = resolve; });
	const original = Intent.findOneAndUpdate;
	const stub = t.mock.method(Intent, "findOneAndUpdate", function (...args) {
		const query = original.apply(this, args);
		const exec = query.exec;
		query.exec = async function (...execArgs) { const result = await exec.apply(this, ...execArgs); entered(); await releaseWrite; return result; };
		return query;
	});
	try {
		const deletion = initiateAccountDeletion(user.id);
		await enteredWrite;
		const sent = waitForUserWrite();
		const attachment = assert.rejects(attachAvatarUpload(user.id, uploading.id, "https://example.test/new.jpg"), error => error.statusCode === 401);
		await sent; release();
		await Promise.all([deletion, attachment]);
		const saved = await savedUser();
		assert.equal(saved.lifecycleState, "deleting");
		assert.equal(saved.avatarIntent, undefined);
		assert.equal((await Intent.findById(current.id)).cleanupStatus, "pending");
		assert.equal((await Intent.findById(uploading.id)).uploadStatus, "uploading");
		assert.equal((await claimAvatarCleanup(user.id, uploading.id)).claimed, false);
	} finally { release(); stub.mock.restore(); }
});
