const test = require("node:test");
const assert = require("node:assert/strict");
const User = require("../models/userModel");
const accountDeletion = require("../services/accountDeletionCoordinator");
const { runAccountDeletionOnce } = require("../services/accountDeletionRunner");

const firstUserId = "64b000000000000000000001";
const secondUserId = "64b000000000000000000002";

function mockScheduler(t, userIds) {
	const pool = userIds.map(_id => ({ _id, attempted: false }));
	const selectedIds = [];
	let resetCount = 0;

	t.mock.method(User, "findOneAndUpdate", (filter, update, options) => {
		assert.deepEqual(filter, {
			lifecycleState: "deleting",
			deletionRunnerCycleAttempted: { $ne: true },
		});
		assert.deepEqual(update, { $set: { deletionRunnerCycleAttempted: true } });
		assert.deepEqual(options, { sort: { _id: 1 }, returnDocument: "after", timestamps: false });

		const candidate = pool.filter(user => !user.attempted)
			.sort((left, right) => String(left._id).localeCompare(String(right._id)))[0];
		if (candidate) {
			candidate.attempted = true;
			selectedIds.push(String(candidate._id));
		}
		return {
			select(fields) {
				assert.equal(fields, "_id");
				return { lean: async () => candidate ? { _id: candidate._id } : null };
			},
		};
	});

	t.mock.method(User, "updateMany", async (filter, update, options) => {
		assert.deepEqual(filter, { lifecycleState: "deleting", deletionRunnerCycleAttempted: true });
		assert.deepEqual(update, { $unset: { deletionRunnerCycleAttempted: 1 } });
		assert.deepEqual(options, { timestamps: false });
		resetCount += 1;
		for (const user of pool) user.attempted = false;
		return { modifiedCount: pool.length };
	});

	return { pool, selectedIds, get resetCount() { return resetCount; } };
}

test("runner is idle when there is no deleting account", async t => {
	mockScheduler(t, []);
	t.mock.method(accountDeletion, "coordinateAccountDeletion", async () => {
		assert.fail("coordinator must not run without a candidate");
	});

	assert.deepEqual(await runAccountDeletionOnce(), { status: "idle" });
});

test("runner selects and processes only one deleting account", async t => {
	const scheduler = mockScheduler(t, [firstUserId, secondUserId]);
	const processed = [];
	t.mock.method(accountDeletion, "coordinateAccountDeletion", async id => {
		processed.push(String(id));
		return { status: "blocked", blockers: ["avatar_cleanup_pending"] };
	});

	assert.deepEqual(await runAccountDeletionOnce(), {
		status: "blocked",
		blockers: ["avatar_cleanup_pending"],
	});
	assert.deepEqual(processed, [firstUserId]);
	assert.deepEqual(scheduler.selectedIds, [firstUserId]);
	assert.equal(scheduler.pool[0].attempted, true);
	assert.equal(scheduler.pool[1].attempted, false);
});

test("a blocked account rotates behind other deleting accounts and retries next cycle", async t => {
	const scheduler = mockScheduler(t, [firstUserId, secondUserId]);
	const processed = [];
	t.mock.method(accountDeletion, "coordinateAccountDeletion", async id => {
		const accountId = String(id);
		processed.push(accountId);
		return accountId === firstUserId ? { status: "blocked", blockers: ["avatar_cleanup_pending"] } : { status: "completed" };
	});

	assert.equal((await runAccountDeletionOnce()).status, "blocked");
	assert.deepEqual(await runAccountDeletionOnce(), { status: "completed" });
	assert.equal((await runAccountDeletionOnce()).status, "blocked");

	assert.deepEqual(processed, [firstUserId, secondUserId, firstUserId]);
	assert.deepEqual(scheduler.selectedIds, [firstUserId, secondUserId, firstUserId]);
	assert.equal(scheduler.resetCount, 1);
});

test("coordinator failures propagate and become retryable after the round completes", async t => {
	const scheduler = mockScheduler(t, [firstUserId]);
	let attempts = 0;
	t.mock.method(accountDeletion, "coordinateAccountDeletion", async id => {
		assert.equal(String(id), firstUserId);
		attempts += 1;
		if (attempts === 1) throw new Error("temporary cleanup failure");
		return { status: "in_progress", step: "vocabularies" };
	});

	await assert.rejects(runAccountDeletionOnce(), /temporary cleanup failure/);
	assert.deepEqual(await runAccountDeletionOnce(), {
		status: "in_progress",
		step: "vocabularies",
	});
	assert.equal(attempts, 2);
	assert.equal(scheduler.resetCount, 1);
});

test("overlapping runner calls share one in-flight account operation", async t => {
	const scheduler = mockScheduler(t, [firstUserId]);
	let calls = 0;
	let release;
	t.mock.method(accountDeletion, "coordinateAccountDeletion", () => {
		calls += 1;
		return new Promise(resolve => { release = resolve; });
	});

	const first = runAccountDeletionOnce();
	const second = runAccountDeletionOnce();
	assert.strictEqual(second, first);
	await new Promise(resolve => setImmediate(resolve));
	assert.equal(calls, 1);
	assert.deepEqual(scheduler.selectedIds, [firstUserId]);
	release({ status: "completed" });
	assert.deepEqual(await first, { status: "completed" });
});
