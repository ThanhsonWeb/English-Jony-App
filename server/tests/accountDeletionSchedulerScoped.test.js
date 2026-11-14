"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const {
	createAccountDeletionScheduler, startConfiguredAccountDeletionScheduler,
	ENABLE_ENV, AVATAR_CLEANUP_ENABLE_ENV,
} = require("../services/accountDeletionScheduler");

test("scheduled storage cleanup requires both exact opt-in flags", () => {
	const starts = [];
	const scheduler = { start(options) { starts.push(options); return true; } };
	assert.equal(startConfiguredAccountDeletionScheduler({ env: {}, scheduler }), false);
	assert.equal(startConfiguredAccountDeletionScheduler({ env: { [AVATAR_CLEANUP_ENABLE_ENV]: "true" }, scheduler }), false);
	assert.equal(startConfiguredAccountDeletionScheduler({ env: { [ENABLE_ENV]: "true" }, scheduler }), true);
	assert.deepEqual(starts.pop(), { avatarCleanupEnabled: false });
	assert.equal(startConfiguredAccountDeletionScheduler({
		env: { [ENABLE_ENV]: "true", [AVATAR_CLEANUP_ENABLE_ENV]: "TRUE" }, scheduler,
	}), true);
	assert.deepEqual(starts.pop(), { avatarCleanupEnabled: false });
	assert.equal(startConfiguredAccountDeletionScheduler({
		env: { [ENABLE_ENV]: "true", [AVATAR_CLEANUP_ENABLE_ENV]: "true" }, scheduler,
	}), true);
	assert.deepEqual(starts.pop(), { avatarCleanupEnabled: true });
});

test("scoped cleanup and account processing share a process-wide overlap guard", async () => {
	const calls = [];
	let release;
	const scheduler = createAccountDeletionScheduler({
		runAvatarCleanupBatch: options => {
			calls.push(["cleanup", options]);
			return new Promise(resolve => { release = resolve; });
		},
		runOnce: async () => { calls.push(["account"]); return { status: "idle" }; },
		setIntervalImpl: () => ({ unref() {} }), clearIntervalImpl: () => {},
	});
	const second = createAccountDeletionScheduler({
		runOnce: async () => { assert.fail("second cycle must not overlap"); },
	});
	scheduler.start({ avatarCleanupEnabled: true });
	const first = scheduler.runScheduledOnce();
	assert.deepEqual(await scheduler.runScheduledOnce(), { status: "skipped", reason: "run_in_progress" });
	assert.deepEqual(await second.runScheduledOnce(), { status: "skipped", reason: "run_in_progress" });
	assert.deepEqual(calls, [["cleanup", { deletingOnly: true }]]);
	release({ complete: 1, retry: 0, held: 0, skipped: 0 });
	assert.deepEqual(await first, { status: "idle" });
	assert.deepEqual(calls, [["cleanup", { deletingOnly: true }], ["account"]]);
	scheduler.stop();
});

test("cleanup failures are redacted, do not starve accounts, and later cycles retry", async () => {
	let cleanups = 0, accounts = 0;
	const logs = [];
	const scheduler = createAccountDeletionScheduler({
		runAvatarCleanupBatch: async options => {
			assert.deepEqual(options, { deletingOnly: true });
			cleanups++;
			if (cleanups === 1) throw new Error("secret database detail");
			return { complete: 0, retry: 1, held: 1, skipped: 0 };
		},
		runOnce: async () => { accounts++; return { status: "idle" }; },
		logger: { error: (...args) => logs.push(args), warn: (...args) => logs.push(args) },
		setIntervalImpl: () => ({ unref() {} }), clearIntervalImpl: () => {},
	});
	scheduler.start({ avatarCleanupEnabled: true });
	assert.deepEqual(await scheduler.runScheduledOnce(), { status: "failed", phase: "avatar_cleanup", accountStatus: "idle" });
	assert.deepEqual(await scheduler.runScheduledOnce(), { status: "idle" });
	assert.equal(accounts, 2);
	assert.deepEqual(logs, [
		["Scheduled avatar cleanup failed"],
		["Scheduled avatar cleanup requires attention", { held: 1, retry: 1 }],
	]);
	assert.equal(JSON.stringify(logs).includes("secret database detail"), false);
	scheduler.stop();
});

test("account runner failure releases the guard and later cycles continue", async () => {
	let calls = 0;
	const scheduler = createAccountDeletionScheduler({
		runAvatarCleanupBatch: async options => { assert.deepEqual(options, { deletingOnly: true }); return {}; },
		runOnce: async () => { if (++calls === 1) throw new Error("failure"); return { status: "idle" }; },
		logger: { error() {} }, setIntervalImpl: () => ({ unref() {} }), clearIntervalImpl: () => {},
	});
	scheduler.start({ avatarCleanupEnabled: true });
	assert.deepEqual(await scheduler.runScheduledOnce(), { status: "failed" });
	assert.deepEqual(await scheduler.runScheduledOnce(), { status: "idle" });
	scheduler.stop();
});
