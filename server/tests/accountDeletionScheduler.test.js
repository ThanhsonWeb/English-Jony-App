const test = require("node:test");
const assert = require("node:assert/strict");
const {
	createAccountDeletionScheduler,
	startConfiguredAccountDeletionScheduler,
	ENABLE_ENV,
} = require("../services/accountDeletionScheduler");

test("scheduler stays disabled unless its exact opt-in flag is true", () => {
	let starts = 0;
	const scheduler = { start() { starts += 1; return true; } };

	assert.equal(startConfiguredAccountDeletionScheduler({ env: {}, scheduler }), false);
	assert.equal(startConfiguredAccountDeletionScheduler({ env: { [ENABLE_ENV]: "false" }, scheduler }), false);
	assert.equal(starts, 0);
	assert.equal(startConfiguredAccountDeletionScheduler({ env: { [ENABLE_ENV]: "true" }, scheduler }), true);
	assert.equal(starts, 1);
});

test("enabled scheduler waits for a tick and skips overlapping runs", async () => {
	let callback, interval, calls = 0, resolveRun;
	const timer = { unrefCalled: false, unref() { this.unrefCalled = true; } };
	const scheduler = createAccountDeletionScheduler({
		intervalMs: 5000,
		runOnce: () => {
			calls += 1;
			return new Promise(resolve => { resolveRun = resolve; });
		},
		setIntervalImpl: (fn, ms) => { callback = fn; interval = ms; return timer; },
		clearIntervalImpl: () => {},
	});

	assert.equal(scheduler.start(), true);
	assert.equal(scheduler.start(), false);
	assert.equal(interval, 5000);
	assert.equal(timer.unrefCalled, true);
	assert.equal(calls, 0, "starting the scheduler does not run deletion immediately");

	callback();
	assert.equal(calls, 1);
	callback();
	assert.equal(calls, 1, "a tick during an active run is skipped");

	resolveRun({ status: "idle" });
	await new Promise(resolve => setImmediate(resolve));
	callback();
	assert.equal(calls, 2);
	resolveRun({ status: "idle" });
	await scheduler.runScheduledOnce();
});

test("a failed scheduled run is contained and later ticks still run", async () => {
	let calls = 0;
	const logs = [];
	const scheduler = createAccountDeletionScheduler({
		runOnce: async () => {
			calls += 1;
			if (calls === 1) throw new Error("sensitive database detail");
			return { status: "idle" };
		},
		logger: { error: (...args) => logs.push(args) },
	});

	assert.deepEqual(await scheduler.runScheduledOnce(), { status: "failed" });
	assert.deepEqual(await scheduler.runScheduledOnce(), { status: "idle" });
	assert.equal(calls, 2);
	assert.equal(logs.length, 1);
	assert.deepEqual(logs[0], [
		"Scheduled account deletion run failed",
		{ errorName: "Error" },
	]);
	assert.ok(!JSON.stringify(logs).includes("sensitive database detail"));
});

test("stop clears the timer and is safe to call more than once", () => {
	let cleared;
	const timer = {};
	const scheduler = createAccountDeletionScheduler({
		setIntervalImpl: () => timer,
		clearIntervalImpl: value => { cleared = value; },
	});

	assert.equal(scheduler.start(), true);
	assert.equal(scheduler.stop(), true);
	assert.equal(cleared, timer);
	assert.equal(scheduler.stop(), false);
	assert.equal(scheduler.start(), true);
	assert.equal(scheduler.stop(), true);
});
