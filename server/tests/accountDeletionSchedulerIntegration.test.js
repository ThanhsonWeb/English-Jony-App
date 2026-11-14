"use strict";
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { before, after, beforeEach, test } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const User = require("../models/userModel");
const Intent = require("../models/avatarUploadIntentModel");
const Receipt = require("../models/accountDeletionReceiptModel");
const { reserveAvatarUpload, queueAvatarCleanup, beginAvatarUpload, recordUploadOutcome } = require("../services/avatarUploadIntent");
const { initiateAccountDeletion } = require("../services/accountDeletion");
const { runAvatarCleanupBatch } = require("../services/avatarCleanupWorker");
const { createAccountDeletionScheduler, startConfiguredAccountDeletionScheduler, ENABLE_ENV, AVATAR_CLEANUP_ENABLE_ENV } = require("../services/accountDeletionScheduler");
const { runAccountDeletionOnce } = require("../services/accountDeletionRunner");
const { receiptIdForEmail } = require("../utils/accountDeletionReceipt");

let repl;
const oldSecret = process.env.ACCOUNT_DELETION_RECEIPT_HMAC_SECRET;
const config = { CLOUDINARY_CLOUD_NAME: "test", CLOUDINARY_API_KEY: "key", CLOUDINARY_API_SECRET: "secret" };
before(async () => {
	process.env.ACCOUNT_DELETION_RECEIPT_HMAC_SECRET = "disposable-scheduler-test-secret-at-least-32-bytes";
	repl = await MongoMemoryReplSet.create({ binary: { version: "7.0.14" }, replSet: { count: 1, storageEngine: "wiredTiger" } });
	await mongoose.connect(repl.getUri(), { dbName: "account_deletion_scheduler_integration" });
	await Promise.all([User.init(), Intent.init(), Receipt.init()]);
}, { timeout: 180000 });
after(async () => {
	await mongoose.disconnect();
	await repl?.stop();
	if (oldSecret === undefined) delete process.env.ACCOUNT_DELETION_RECEIPT_HMAC_SECRET;
	else process.env.ACCOUNT_DELETION_RECEIPT_HMAC_SECRET = oldSecret;
});
beforeEach(async () => { await Intent.deleteMany({}); await Receipt.deleteMany({}); await User.deleteMany({}); });

async function makeUser() {
	const id = randomUUID();
	return User.create({ name: "Test owner", email: id + "@example.test", googleId: id });
}
async function makeIntent(user) {
	return reserveAvatarUpload(user._id, {
		operationId: randomUUID(), provider: "cloudinary", cloudName: "test", contentType: "image/jpeg",
	});
}
function schedulerFor(fetchImpl) {
	const scheduler = createAccountDeletionScheduler({
		runAvatarCleanupBatch: options => runAvatarCleanupBatch({ ...options, config, fetchImpl }),
		runOnce: runAccountDeletionOnce,
		setIntervalImpl: () => ({ unref() {} }), clearIntervalImpl: () => {},
		logger: { warn() {}, error() {} },
	});
	startConfiguredAccountDeletionScheduler({ env: { [ENABLE_ENV]: "true", [AVATAR_CLEANUP_ENABLE_ENV]: "true" }, scheduler });
	return scheduler;
}
async function eligibleTarget() {
	const user = await makeUser();
	const intent = await makeIntent(user);
	await beginAvatarUpload(user._id, intent._id);
	await recordUploadOutcome(user._id, intent._id, "failure");
	await initiateAccountDeletion(user._id);
	return { user, intent };
}

test("scheduled cleanup and finalization never touch twelve legacy accounts", async () => {
	const protectedAccounts = [];
	for (let i = 0; i < 12; i++) {
		const user = await makeUser();
		const intent = await makeIntent(user);
		await queueAvatarCleanup(user._id, intent._id);
		await User.collection.updateOne({ _id: user._id }, { $set: {
			avatar: "https://legacy.example/avatar.jpg",
			lifecycleState: i % 2 ? "active" : "deleting",
			deletionRunnerCycleAttempted: true,
		} });
		protectedAccounts.push({ user, intent });
	}
	const target = await eligibleTarget();
	const protectedBefore = await Promise.all(protectedAccounts.map(async ({ user, intent }) => ({
		user: await User.collection.findOne({ _id: user._id }),
		intent: await Intent.collection.findOne({ _id: intent._id }),
	})));
	let started, release, calls = 0;
	const startedStorage = new Promise(resolve => { started = resolve; });
	const storage = new Promise(resolve => { release = resolve; });
	const scheduler = schedulerFor(async () => { calls++; started(); return storage; });
	try {
		const run = scheduler.runScheduledOnce();
		await startedStorage;
		assert.deepEqual(await scheduler.runScheduledOnce(), { status: "skipped", reason: "run_in_progress" });
		assert.ok(await User.exists({ _id: target.user._id }));
		assert.equal(await Receipt.countDocuments(), 0);
		release({ ok: true, json: async () => ({ result: "ok" }) });
		assert.deepEqual(await run, { status: "completed" });
		assert.equal(calls, 1);
		assert.equal(await User.exists({ _id: target.user._id }), null);
		assert.ok(await Receipt.exists({ _id: receiptIdForEmail(target.user.email) }));
		assert.equal((await scheduler.runScheduledOnce()).status, "idle");
		const protectedAfter = await Promise.all(protectedAccounts.map(async ({ user, intent }) => ({
			user: await User.collection.findOne({ _id: user._id }),
			intent: await Intent.collection.findOne({ _id: intent._id }),
		})));
		assert.deepEqual(protectedAfter, protectedBefore);
	} finally { release?.({ ok: false }); scheduler.stop(); }
});

test("uncertain storage remains held across later scheduled cycles", async () => {
	const { user, intent } = await eligibleTarget();
	let calls = 0;
	const scheduler = schedulerFor(async () => { calls++; throw new Error("timeout"); });
	try {
		const first = await scheduler.runScheduledOnce();
		assert.equal(first.status, "blocked");
		assert.equal((await Intent.findById(intent._id)).cleanupStatus, "claimed");
		assert.ok(await User.exists({ _id: user._id }));
		assert.equal(await Receipt.countDocuments(), 0);
		const second = await scheduler.runScheduledOnce();
		assert.equal(second.status, "blocked");
		assert.equal(calls, 1);
		assert.equal((await Intent.findById(intent._id)).cleanupStatus, "claimed");
	} finally { scheduler.stop(); }
});
