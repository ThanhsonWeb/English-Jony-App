const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const { before, after, beforeEach, afterEach, test } = require("node:test");
const express = require("express");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const User = require("../models/userModel");
const Intent = require("../models/avatarUploadIntentModel");
const { recordCleanupResult, queueAvatarCleanup } = require("../services/avatarUploadIntent");

let db, server, url, owner, other, token;
const originalFetch = global.fetch;
const originalWriteFile = fs.writeFile;
const env = { JWT_SECRET: "avatar-tracked-route-test", NODE_ENV: "production", CLOUDINARY_CLOUD_NAME: "studyjony-test", CLOUDINARY_API_KEY: "test-key", CLOUDINARY_API_SECRET: "test-secret" };
const previousEnv = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
const bytes = Buffer.from([0xff, 0xd8, 0xff, 0x00]);
const legacy = "https://example.test/legacy-avatar.jpg";

before(async () => {
	Object.assign(process.env, env);
	db = await MongoMemoryReplSet.create({ binary: { version: "7.0.14" }, replSet: { count: 1, storageEngine: "wiredTiger" } });
	await mongoose.connect(db.getUri(), { dbName: "tracked_avatar_route", monitorCommands: true });
	await Promise.all([User.init(), Intent.init()]);
	const app = express(); app.use(express.json());
	app.use("/users", require("../routes/userRoutes"));
	app.use((error, req, res, next) => res.status(error.statusCode || 500).json({ message: "Request failed" }));
	server = await new Promise(resolve => { const listener = app.listen(0, "127.0.0.1", () => resolve(listener)); });
	url = `http://127.0.0.1:${server.address().port}/users/avatar`;
}, { timeout: 180000 });
after(async () => {
	if (server) await new Promise(resolve => server.close(resolve));
	await mongoose.disconnect(); await db?.stop();
	for (const [key, value] of Object.entries(previousEnv)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
});
beforeEach(async () => {
	Object.assign(process.env, env);
	await Promise.all([User.deleteMany({}), Intent.deleteMany({})]);
	[owner, other] = await User.create([
		{ name: "Owner", email: "avatar-owner@example.test", googleId: "owner", avatar: legacy },
		{ name: "Other", email: "avatar-other@example.test", googleId: "other", avatar: "https://example.test/other.jpg" },
	]);
	token = jwt.sign({ id: owner.id }, env.JWT_SECRET, { expiresIn: "1h" });
});
afterEach(() => { global.fetch = originalFetch; fs.writeFile = originalWriteFile; });

function request() {
	return originalFetch(url, { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "image/jpeg" }, body: bytes });
}
function cloudResponse(options) {
	const publicId = `studyjony/avatars/${options.body.get("public_id")}`;
	const version = 12345;
	const signature = crypto.createHash("sha1").update(`public_id=${publicId}&version=${version}test-secret`).digest("hex");
	return { ok: true, json: async () => ({ public_id: publicId, version, signature, secure_url: `https://res.cloudinary.com/studyjony-test/image/upload/v${version}/${publicId}.jpg` }) };
}
function interceptCloud(handler) {
	global.fetch = (target, options) => String(target).startsWith("https://api.cloudinary.com/") ? handler(options) : originalFetch(target, options);
}

test("registration precedes storage; replacement queues only the previous managed avatar", async () => {
	interceptCloud(async options => {
		const key = `studyjony/avatars/${options.body.get("public_id")}`;
		const intent = await Intent.findOne({ storageKey: key });
		assert.ok(intent);
		assert.equal(intent.uploadStatus, "uploading");
		assert.equal(intent.cleanupStatus, "pending");
		assert.equal(intent.attachmentStatus, "unattached");
		assert.equal(options.body.get("overwrite"), "false");
		return cloudResponse(options);
	});
	const firstResponse = await request();
	assert.equal(firstResponse.status, 200);
	const firstBody = await firstResponse.json();
	assert.equal(firstBody.data.user.avatarIntent, undefined);
	const firstOwner = await User.findById(owner.id).select("+avatarIntent");
	const first = await Intent.findById(firstOwner.avatarIntent);
	assert.equal(firstBody.data.user.avatar, firstOwner.avatar);
	assert.equal(first.uploadResult, "success");
	assert.equal(first.uploadStatus, "finished");
	assert.equal(first.attachmentStatus, "attached");
	assert.equal(first.cleanupStatus, "none");
	await assert.rejects(queueAvatarCleanup(owner.id, first.id), error => error.statusCode === 409);
	assert.equal((await request()).status, 200);
	const updatedOwner = await User.findById(owner.id).select("+avatarIntent");
	const previous = await Intent.findById(first.id);
	const current = await Intent.findById(updatedOwner.avatarIntent);
	assert.notEqual(current.storageKey, previous.storageKey);
	assert.equal(previous.attachmentStatus, "unattached");
	assert.equal(previous.cleanupStatus, "pending");
	assert.equal(current.attachmentStatus, "attached");
	assert.equal(current.cleanupStatus, "none");
	assert.equal(await Intent.countDocuments(), 2, "legacy avatar did not create a cleanup record");
	assert.equal((await User.findById(other.id)).avatar, other.avatar);
});

test("a Cloudinary timeout stays uncertain and cannot be marked cleaned", async () => {
	interceptCloud(async () => { throw new Error("simulated timeout"); });
	assert.equal((await request()).status, 502);
	const intent = await Intent.findOne({ user: owner.id });
	assert.equal(intent.uploadStatus, "uncertain");
	assert.equal(intent.uploadResult, "unknown");
	assert.equal(intent.cleanupStatus, "pending");
	await assert.rejects(recordCleanupResult(owner.id, intent.id, intent.cleanupGeneration, true), error => error.statusCode === 409);
	assert.equal((await User.findById(owner.id)).avatar, legacy);
});

test("an unverified provider response stays uncertain and is not attached", async () => {
	interceptCloud(async options => {
		const response = cloudResponse(options);
		const body = await response.json();
		body.secure_url = "https://res.cloudinary.com/studyjony-test/image/upload/v12345/other.jpg";
		return { ok: true, json: async () => body };
	});
	assert.equal((await request()).status, 502);
	const intent = await Intent.findOne({ user: owner.id });
	assert.equal(intent.uploadStatus, "uncertain");
	assert.equal(intent.uploadResult, "unknown");
	assert.equal(intent.cleanupStatus, "pending");
	assert.equal((await User.findById(owner.id)).avatar, legacy);
});

test("simultaneous successful uploads leave one attachment and queue the superseded file", { timeout: 15000 }, async () => {
	let release, entered;
	let count = 0;
	const bothStarted = new Promise(resolve => { entered = resolve; });
	const proceed = new Promise(resolve => { release = resolve; });
	interceptCloud(async options => { if (++count === 2) entered(); await proceed; return cloudResponse(options); });
	try {
		const uploads = Promise.all([request(), request()]);
		await bothStarted;
		release();
		assert.deepEqual((await uploads).map(response => response.status), [200, 200]);
		const saved = await User.findById(owner.id).select("+avatarIntent");
		const intents = await Intent.find({ user: owner.id });
		assert.equal(intents.length, 2);
		const attached = intents.find(intent => intent.attachmentStatus === "attached");
		const previous = intents.find(intent => intent.attachmentStatus === "unattached");
		assert.ok(attached && previous);
		assert.equal(String(saved.avatarIntent), attached.id);
		assert.equal(attached.cleanupStatus, "none");
		assert.equal(previous.cleanupStatus, "pending");
		assert.equal((await User.findById(other.id)).avatar, other.avatar);
	} finally { release(); }
});

test("a local write failure records terminal failure and leaves cleanup pending", async () => {
	process.env.NODE_ENV = "development";
	for (const key of ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"]) delete process.env[key];
	fs.writeFile = async () => { const error = new Error("simulated disk error"); error.code = "EIO"; throw error; };
	assert.equal((await request()).status, 502);
	const intent = await Intent.findOne({ user: owner.id });
	assert.equal(intent.provider, "local");
	assert.equal(intent.uploadStatus, "finished");
	assert.equal(intent.uploadResult, "failure");
	assert.equal(intent.cleanupStatus, "pending");
	assert.equal((await User.findById(owner.id)).avatar, legacy);
});

test("account deletion during storage prevents attachment and queues the completed upload", { timeout: 15000 }, async () => {
	let entered, release;
	const started = new Promise(resolve => { entered = resolve; });
	const proceed = new Promise(resolve => { release = resolve; });
	interceptCloud(async options => { entered(); await proceed; return cloudResponse(options); });
	try {
		const upload = request();
		await started;
		await User.updateOne({ _id: owner.id }, { $set: { lifecycleState: "deleting" } });
		release();
		assert.equal((await upload).status, 401);
		const intent = await Intent.findOne({ user: owner.id });
		assert.equal(intent.uploadStatus, "finished");
		assert.equal(intent.uploadResult, "success");
		assert.equal(intent.attachmentStatus, "unattached");
		assert.equal(intent.cleanupStatus, "pending");
		assert.equal((await User.findById(owner.id)).avatar, legacy);
		assert.equal((await User.findById(other.id)).avatar, other.avatar);
	} finally { release(); }
});

test("an attachment already in its transaction commits before a racing deletion", { timeout: 15000 }, async () => {
	interceptCloud(async options => cloudResponse(options));
	const original = mongoose.Query.prototype.exec;
	let entered, release;
	const attached = new Promise(resolve => { entered = resolve; });
	const proceed = new Promise(resolve => { release = resolve; });
	mongoose.Query.prototype.exec = async function (...args) {
		const update = this.getUpdate() || {};
		if (this.model !== User || this.op !== "findOneAndUpdate" || !(update.avatar || update.$set?.avatar)) return original.apply(this, args);
		assert.ok(this.getOptions().session?.inTransaction());
		const result = await original.apply(this, args);
		entered();
		await proceed;
		return result;
	};
	try {
		const upload = request();
		await attached;
		const sent = new Promise(resolve => {
			const client = mongoose.connection.getClient();
			const listener = event => {
				if (event.commandName !== "findAndModify" || event.command.findAndModify !== User.collection.name ||
					event.command.update?.$set?.lifecycleState !== "deleting") return;
				client.off("commandStarted", listener);
				resolve();
			};
			client.on("commandStarted", listener);
		});
		const deletion = mongoose.connection.transaction(async session => {
			assert.ok(await User.findOneAndUpdate({ _id: owner.id, lifecycleState: "active" },
				{ $set: { lifecycleState: "deleting" } }, { session, returnDocument: "after" }));
		});
		await sent;
		release();
		assert.equal((await upload).status, 200);
		await deletion;
		const saved = await User.findById(owner.id).select("+avatarIntent +lifecycleState");
		const intent = await Intent.findById(saved.avatarIntent);
		assert.equal(saved.lifecycleState, "deleting");
		assert.equal(intent.attachmentStatus, "attached");
		assert.equal(intent.uploadResult, "success");
		assert.equal(intent.cleanupStatus, "none", "future account deletion must queue the attached asset");
	} finally { release(); mongoose.Query.prototype.exec = original; }
});

test("attachment failure rolls back avatar changes and leaves the new file queued", async () => {
	interceptCloud(async options => cloudResponse(options));
	assert.equal((await request()).status, 200);
	const before = await User.findById(owner.id).select("+avatarIntent");
	const original = mongoose.Query.prototype.exec;
	mongoose.Query.prototype.exec = async function (...args) {
		const update = this.getUpdate() || {};
		if (this.model !== User || this.op !== "findOneAndUpdate" || !(update.avatar || update.$set?.avatar)) return original.apply(this, args);
		assert.ok(this.getOptions().session?.inTransaction());
		await original.apply(this, args);
		throw new Error("simulated attachment failure");
	};
	try { assert.equal((await request()).status, 500); } finally { mongoose.Query.prototype.exec = original; }
	const after = await User.findById(owner.id).select("+avatarIntent");
	assert.equal(after.avatar, before.avatar);
	assert.equal(String(after.avatarIntent), String(before.avatarIntent));
	const previous = await Intent.findById(before.avatarIntent);
	const pending = await Intent.findOne({ user: owner.id, _id: { $ne: before.avatarIntent } });
	assert.equal(previous.attachmentStatus, "attached");
	assert.equal(previous.cleanupStatus, "none");
	assert.equal(pending.uploadStatus, "finished");
	assert.equal(pending.uploadResult, "success");
	assert.equal(pending.cleanupStatus, "pending");
	assert.equal((await User.findById(other.id)).avatar, other.avatar);
});

test("a failed outcome write retains the prequeued in-flight intent", async () => {
	interceptCloud(async () => { throw new Error("simulated timeout"); });
	const original = mongoose.Query.prototype.exec;
	mongoose.Query.prototype.exec = async function (...args) {
		const update = this.getUpdate() || {};
		if (this.model === Intent && this.op === "findOneAndUpdate" && update.$set?.uploadResult === "unknown") {
			throw new Error("simulated database failure");
		}
		return original.apply(this, args);
	};
	try { assert.equal((await request()).status, 502); } finally { mongoose.Query.prototype.exec = original; }
	const intent = await Intent.findOne({ user: owner.id });
	assert.equal(intent.uploadStatus, "uploading");
	assert.equal(intent.cleanupStatus, "pending");
	await assert.rejects(recordCleanupResult(owner.id, intent.id, intent.cleanupGeneration, true), error => error.statusCode === 409);
});
