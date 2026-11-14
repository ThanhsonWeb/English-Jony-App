"use strict";

const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { before, after, beforeEach, test } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const User = require("../models/userModel");
const Intent = require("../models/avatarUploadIntentModel");
const { reserveAvatarUpload, queueAvatarCleanup, claimAvatarCleanup, recordCleanupResult } = require("../services/avatarUploadIntent");
const { runAvatarCleanupBatch } = require("../services/avatarCleanupWorker");

let repl;
const config = { CLOUDINARY_CLOUD_NAME: "test", CLOUDINARY_API_KEY: "key", CLOUDINARY_API_SECRET: "secret" };
const success = async () => ({ ok: true, json: async () => ({ result: "ok" }) });

before(async () => {
	repl = await MongoMemoryReplSet.create({ binary: { version: "7.0.14" }, replSet: { count: 1, storageEngine: "wiredTiger" } });
	await mongoose.connect(repl.getUri(), { dbName: "scoped_avatar_cleanup", monitorCommands: true });
	await Promise.all([User.init(), Intent.init()]);
}, { timeout: 180000 });
after(async () => { await mongoose.disconnect(); await repl?.stop(); });
beforeEach(async () => { await Intent.deleteMany({}); await User.deleteMany({}); });

async function makePending(provider = "cloudinary") {
	const id = randomUUID();
	const user = await User.create({ name: "Test owner", email: id + "@example.test", googleId: id });
	const intent = await reserveAvatarUpload(user._id, {
		operationId: randomUUID(), provider, cloudName: "test", contentType: "image/jpeg",
	});
	await queueAvatarCleanup(user._id, intent._id);
	return { user, intent };
}
async function deleting(user, extra = {}) {
	await User.collection.updateOne({ _id: user._id }, { $set: { lifecycleState: "deleting", ...extra } });
}

test("scoped batches isolate twelve legacy accounts and active accounts without starvation", async () => {
	const protectedAccounts = [];
	for (let i = 0; i < 12; i++) {
		const item = await makePending();
		await User.collection.updateOne({ _id: item.user._id }, { $set: {
			lifecycleState: i % 2 ? "active" : "deleting", avatar: "https://legacy.example/avatar.jpg",
		} });
		if (i === 0) await Intent.collection.updateOne({ _id: item.intent._id }, { $set: { cleanupStatus: "retry" } });
		protectedAccounts.push(item);
	}
	const active = await makePending();
	const malformed = await makePending();
	await deleting(malformed.user, { avatar: [""] });
	const target = await makePending();
	await deleting(target.user);
	const excluded = [...protectedAccounts, active, malformed];
	const beforeDocs = await Promise.all(excluded.map(async ({ user, intent }) => ({
		user: await User.collection.findOne({ _id: user._id }),
		intent: await Intent.collection.findOne({ _id: intent._id }),
	})));
	let calls = 0;
	const counts = await runAvatarCleanupBatch({ deletingOnly: true, limit: 1, config,
		fetchImpl: async () => { calls++; return success(); } });
	assert.deepEqual(counts, { complete: 1, retry: 0, held: 0, skipped: 0 });
	assert.equal(calls, 1);
	assert.equal((await Intent.findById(target.intent._id)).cleanupStatus, "complete");
	const afterDocs = await Promise.all(excluded.map(async ({ user, intent }) => ({
		user: await User.collection.findOne({ _id: user._id }),
		intent: await Intent.collection.findOne({ _id: intent._id }),
	})));
	assert.deepEqual(afterDocs, beforeDocs);
});

test("the scoped claim rechecks a concurrent legacy-avatar change in its transaction", { timeout: 15000 }, async () => {
	const { user, intent } = await makePending();
	await deleting(user);
	let entered, release;
	const enteredWrite = new Promise(resolve => { entered = resolve; });
	const releaseWrite = new Promise(resolve => { release = resolve; });
	const transaction = mongoose.connection.transaction(async session => {
		await User.updateOne({ _id: user._id }, { $set: { avatar: "legacy" } }, { session });
		entered();
		await releaseWrite;
	});
	await enteredWrite;
	const client = mongoose.connection.getClient();
	let listener;
	const commandStarted = new Promise(resolve => {
		listener = event => {
			if (event.commandName === "findAndModify" && event.command.findAndModify === User.collection.name) {
				client.off("commandStarted", listener);
				resolve();
			}
		};
		client.on("commandStarted", listener);
	});
	const claiming = claimAvatarCleanup(user._id, intent._id, { deletingOnly: true });
	try { await commandStarted; } finally { client.off("commandStarted", listener); release(); }
	const [, claim] = await Promise.all([transaction, claiming]);
	assert.equal(claim.claimed, false);
	assert.equal((await User.findById(user._id)).avatar, "legacy");
	assert.equal((await Intent.findById(intent._id)).cleanupStatus, "pending");
});

test("concurrent scoped workers claim an eligible intent once", async () => {
	const { user, intent } = await makePending();
	await deleting(user);
	let calls = 0;
	const fetchImpl = async () => { calls++; return success(); };
	await Promise.all(Array.from({ length: 5 }, () => runAvatarCleanupBatch({ deletingOnly: true, config, fetchImpl })));
	assert.equal(calls, 1);
	assert.equal((await Intent.findById(intent._id)).cleanupStatus, "complete");
});

test("scoped claim rollback restores the account fence and intent", async t => {
	const { user, intent } = await makePending();
	await deleting(user);
	const beforeUser = await User.collection.findOne({ _id: user._id });
	const beforeIntent = await Intent.collection.findOne({ _id: intent._id });
	const original = Intent.findOneAndUpdate;
	t.mock.method(Intent, "findOneAndUpdate", async function (...args) {
		await original.apply(this, args);
		throw new Error("injected rollback");
	});
	await assert.rejects(claimAvatarCleanup(user._id, intent._id, { deletingOnly: true }), /injected rollback/);
	assert.deepEqual(await User.collection.findOne({ _id: user._id }), beforeUser);
	assert.deepEqual(await Intent.collection.findOne({ _id: intent._id }), beforeIntent);
});

test("scoped retries advance the claim generation and hold uncertain responses", async () => {
	const { user, intent } = await makePending();
	await deleting(user);
	assert.deepEqual(await runAvatarCleanupBatch({ deletingOnly: true, config,
		fetchImpl: async () => ({ ok: false, status: 429 }) }), { complete: 0, retry: 1, held: 0, skipped: 0 });
	assert.equal((await Intent.findById(intent._id)).cleanupGeneration, 1);
	assert.deepEqual(await runAvatarCleanupBatch({ deletingOnly: true, config,
		fetchImpl: async () => { throw new Error("uncertain"); } }), { complete: 0, retry: 0, held: 1, skipped: 0 });
	const saved = await Intent.findById(intent._id);
	assert.equal(saved.cleanupGeneration, 2);
	assert.equal(saved.cleanupStatus, "claimed");
	assert.deepEqual(await runAvatarCleanupBatch({ deletingOnly: true, config, fetchImpl: async () => assert.fail() }),
		{ complete: 0, retry: 0, held: 0, skipped: 0 });
});

test("scoped local cleanup still requires explicit opt-in", async () => {
	const { user, intent } = await makePending("local");
	await deleting(user);
	let calls = 0;
	const unlink = async () => { calls++; };
	await runAvatarCleanupBatch({ deletingOnly: true, unlink });
	assert.equal(calls, 0);
	assert.equal((await Intent.findById(intent._id)).cleanupStatus, "pending");
	await runAvatarCleanupBatch({ deletingOnly: true, allowLocal: true, unlink });
	assert.equal(calls, 1);
	assert.equal((await Intent.findById(intent._id)).cleanupStatus, "complete");
});

test("scoped claim rejects invalid scope and excludes missing accounts and foreign intents", async () => {
	const { user, intent } = await makePending();
	const other = await makePending();
	await deleting(user);
	await assert.rejects(claimAvatarCleanup(user._id, intent._id, { deletingOnly: "true" }), TypeError);
	assert.equal((await claimAvatarCleanup(user._id, other.intent._id, { deletingOnly: true })).claimed, false);
	await User.deleteOne({ _id: user._id });
	assert.equal((await claimAvatarCleanup(user._id, intent._id, { deletingOnly: true })).claimed, false);
	assert.equal((await Intent.findById(intent._id)).cleanupStatus, "pending");
});

test("scoped claims fail closed for malformed avatar and pointer values", async () => {
	for (const fields of [{ avatar: null }, { avatar: 42 }, { avatar: [""] },
		{ avatar: "  " }, { avatar: "", avatarIntent: "invalid" }]) {
		const { user, intent } = await makePending();
		await deleting(user, fields);
		const beforeUser = await User.collection.findOne({ _id: user._id });
		const beforeIntent = await Intent.collection.findOne({ _id: intent._id });
		assert.equal((await claimAvatarCleanup(user._id, intent._id, { deletingOnly: true })).claimed, false);
		assert.deepEqual(await User.collection.findOne({ _id: user._id }), beforeUser);
		assert.deepEqual(await Intent.collection.findOne({ _id: intent._id }), beforeIntent);
	}
});

test("the scoped claim loses a race to an account becoming active", { timeout: 15000 }, async () => {
	const { user, intent } = await makePending();
	await deleting(user);
	let entered, release;
	const enteredWrite = new Promise(resolve => { entered = resolve; });
	const releaseWrite = new Promise(resolve => { release = resolve; });
	const transaction = mongoose.connection.transaction(async session => {
		await User.updateOne({ _id: user._id }, { $set: { lifecycleState: "active" } }, { session });
		entered();
		await releaseWrite;
	});
	await enteredWrite;
	const client = mongoose.connection.getClient();
	let listener;
	const commandStarted = new Promise(resolve => {
		listener = event => {
			if (event.commandName === "findAndModify" && event.command.findAndModify === User.collection.name) {
				client.off("commandStarted", listener);
				resolve();
			}
		};
		client.on("commandStarted", listener);
	});
	const claiming = claimAvatarCleanup(user._id, intent._id, { deletingOnly: true });
	try { await commandStarted; } finally { client.off("commandStarted", listener); release(); }
	const [, claim] = await Promise.all([transaction, claiming]);
	assert.equal(claim.claimed, false);
	assert.equal((await User.findById(user._id).select("+lifecycleState")).lifecycleState, "active");
	assert.equal((await Intent.findById(intent._id)).cleanupStatus, "pending");
});

test("the CLI passes the opt-in scope and rejects its use for claim recovery", async () => {
	const path = require("node:path");
	const { promisify } = require("node:util");
	const execFile = promisify(require("node:child_process").execFile);
	const active = await makePending();
	const target = await makePending();
	await deleting(target.user);
	const env = {
		PATH: process.env.PATH, SystemRoot: process.env.SystemRoot,
		DATABASE: repl.getUri("scoped_avatar_cleanup"), NODE_ENV: "test",
		CLOUDINARY_CLOUD_NAME: "different", CLOUDINARY_API_KEY: "key", CLOUDINARY_API_SECRET: "secret",
	};
	const cli = path.join(__dirname, "../scripts/run-avatar-cleanup.js");
	const cwd = path.resolve(__dirname, "..");
	const { stdout } = await execFile(process.execPath, [cli, "--deleting-only"], { env, cwd });
	assert.deepEqual(JSON.parse(stdout), { complete: 0, retry: 1, held: 0, skipped: 0 });
	assert.equal((await Intent.findById(active.intent._id)).cleanupStatus, "pending");
	assert.equal((await Intent.findById(target.intent._id)).cleanupStatus, "retry");
	await assert.rejects(execFile(process.execPath, [cli, "--deleting-only", "recover",
		String(target.user._id), String(target.intent._id), "--workers-fenced-and-requests-settled"], { env, cwd }));
	assert.equal((await Intent.findById(target.intent._id)).cleanupStatus, "retry");
});

test("scoped claims leave malformed intent state untouched", async () => {
	for (const fields of [
		{ cleanupGeneration: 1.5 }, { cleanupStatus: ["pending"] },
		{ attachmentStatus: ["unattached"] }, { uploadStatus: ["reserved"] },
		{ cleanupStatus: "retry", cleanupGeneration: Number.MAX_SAFE_INTEGER },
	]) {
		const { user, intent } = await makePending();
		await deleting(user);
		await Intent.collection.updateOne({ _id: intent._id }, { $set: fields });
		const beforeUser = await User.collection.findOne({ _id: user._id });
		const beforeIntent = await Intent.collection.findOne({ _id: intent._id });
		assert.equal((await claimAvatarCleanup(user._id, intent._id, { deletingOnly: true })).claimed, false);
		assert.deepEqual(await User.collection.findOne({ _id: user._id }), beforeUser);
		assert.deepEqual(await Intent.collection.findOne({ _id: intent._id }), beforeIntent);
	}
});

test("scoped cleanup blocks a Cloudinary account mismatch before storage is contacted", async () => {
	const { user, intent } = await makePending();
	await deleting(user);
	const mismatch = { ...config, CLOUDINARY_CLOUD_NAME: "wrong" };
	const result = await runAvatarCleanupBatch({ deletingOnly: true, config: mismatch, fetchImpl: async () => assert.fail() });
	assert.deepEqual(result, { complete: 0, retry: 1, held: 0, skipped: 0 });
	assert.equal((await Intent.findById(intent._id)).cleanupStatus, "retry");
});
