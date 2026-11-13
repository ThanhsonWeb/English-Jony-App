const test = require("node:test");
const assert = require("node:assert/strict");
const User = require("../models/userModel");
const accountDeletion = require("../services/accountDeletionCoordinator");
const { runAccountDeletionOnce } = require("../services/accountDeletionRunner");

const firstUserId = "64b000000000000000000001";

function mockCandidates(t, candidates) {
	t.mock.method(User, "find", filter => {
		assert.deepEqual(filter, { lifecycleState: "deleting" });
		return {
			select(fields) {
				assert.equal(fields, "_id");
				return {
					sort(order) {
						assert.deepEqual(order, { _id: 1 });
						return {
							limit(count) {
								assert.equal(count, 1);
								return { lean: async () => candidates };
							},
						};
					},
				};
			},
		};
	});
}

test("runner is idle when there is no deleting account", async t => {
	mockCandidates(t, []);
	t.mock.method(accountDeletion, "coordinateAccountDeletion", async () => {
		assert.fail("coordinator must not run without a candidate");
	});

	assert.deepEqual(await runAccountDeletionOnce(), { status: "idle" });
});

test("runner selects and processes only one deleting account", async t => {
	mockCandidates(t, [{ _id: firstUserId }, { _id: "64b000000000000000000002" }]);
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
});

test("coordinator failures propagate and the selected account can be retried", async t => {
	mockCandidates(t, [{ _id: firstUserId }]);
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
});

test("overlapping runner calls share one in-flight account operation", async t => {
	mockCandidates(t, [{ _id: firstUserId }]);
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
	release({ status: "completed" });
	assert.deepEqual(await first, { status: "completed" });
});
