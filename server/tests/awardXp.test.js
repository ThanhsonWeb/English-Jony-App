const assert = require("node:assert/strict");
const { before, after, beforeEach, test } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const User = require("../models/userModel");
const XPEvent = require("../models/xpEventModel");
const awardXp = require("../services/awardXp");

let replicaSet;
let user;

before(async () => {
	// Always use a disposable database. Never load .env or a deployed DB URI.
	replicaSet = await MongoMemoryReplSet.create({
		binary: { version: "7.0.14" },
		replSet: { count: 1, storageEngine: "wiredTiger" },
	});
	await mongoose.connect(replicaSet.getUri(), { dbName: "xp_foundation_test", monitorCommands: true });
	await Promise.all([User.init(), XPEvent.init()]);
}, { timeout: 180000 });

after(async () => {
	await mongoose.disconnect();
	await replicaSet?.stop();
});

beforeEach(async () => {
	await XPEvent.deleteMany({});
	await User.deleteMany({});
	user = await User.create({ name: "Test Learner", email: "learner@example.com", googleId: "test-google-id" });
});

function input(overrides = {}) {
	return {
		userId: user._id,
		awardKey: "dialogue:course:dialogue:task-1",
		sourceType: "dialogue_task",
		sourceId: "course/dialogue/task-1",
		amount: 10,
		...overrides,
	};
}

async function assertState(totalXp, eventCount) {
	const savedUser = await User.findById(user._id).lean();
	assert.equal(savedUser.totalXp, totalXp);
	assert.equal(await XPEvent.countDocuments({ user: user._id }), eventCount);
}

test("users default to zero XP and reject invalid totals", async () => {
	assert.equal(user.totalXp, 0);
	for (const totalXp of [-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
		user.totalXp = totalXp;
		await assert.rejects(user.validate());
	}
});

test("award commits one event and total, using server time and Vietnam day", async () => {
	const startedAt = new Date();
	const result = await awardXp(input({ earnedAt: "2000-01-01", dayKey: "2000-01-01" }));
	assert.equal(result.awarded, 10);
	assert.equal(result.totalXp, 10);
	assert.equal(result.reason, "awarded");
	await assertState(10, 1);
	const event = await XPEvent.findById(result.eventId).lean();
	assert.ok(event.earnedAt >= startedAt && event.earnedAt <= new Date());
	assert.equal(event.dayKey, new Intl.DateTimeFormat("en-CA", {
		timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit",
	}).format(event.earnedAt));
	assert.equal(event.ruleVersion, 1);
});

test("sequential retry returns the original event and no extra XP", async () => {
	const first = await awardXp(input());
	const retry = await awardXp(input({ awardKey: ` ${input().awardKey} ` }));
	assert.equal(retry.awarded, 0);
	assert.equal(retry.reason, "already_awarded");
	assert.equal(String(retry.eventId), String(first.eventId));
	await assertState(10, 1);
});

test("simultaneous identical awards grant XP exactly once", async () => {
	const results = await Promise.all(Array.from({ length: 12 }, () => awardXp(input())));
	assert.equal(results.filter(result => result.reason === "awarded").length, 1);
	assert.equal(results.reduce((sum, result) => sum + result.awarded, 0), 10);
	await assertState(10, 1);
});

test("concurrent distinct awards do not lose increments", async () => {
	await Promise.all(Array.from({ length: 8 }, (_, index) => awardXp(input({
		awardKey: `task:${index}`, sourceId: `task/${index}`, amount: index + 1,
	}))));
	await assertState(36, 8);
});

test("the same key can be awarded to different users", async () => {
	const second = await User.create({ name: "Second Learner", email: "second@example.com", googleId: "second-google" });
	await awardXp(input());
	await awardXp(input({ userId: second._id }));
	await assertState(10, 1);
	assert.equal((await User.findById(second._id)).totalXp, 10);
});

test("reusing a key with different award details is rejected", async () => {
	await awardXp(input());
	for (const change of [{ amount: 20 }, { sourceId: "other" }, { sourceType: "vocabulary_review" }, { ruleVersion: 2 }]) {
		await assert.rejects(awardXp(input(change)), { code: "XP_AWARD_CONFLICT" });
	}
	await assertState(10, 1);
});

test("concurrent conflicting awards commit only the winning amount", async () => {
	const results = await Promise.allSettled([awardXp(input()), awardXp(input({ amount: 20 }))]);
	assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
	assert.equal(results.find(result => result.status === "rejected").reason.code, "XP_AWARD_CONFLICT");
	const event = await XPEvent.findOne().lean();
	await assertState(event.amount, 1);
});

test("a duplicate reports the current lifetime total after other awards", async () => {
	await awardXp(input());
	await awardXp(input({ awardKey: "second-task", sourceId: "second-task", amount: 5 }));
	const retry = await awardXp(input());
	assert.equal(retry.awarded, 0);
	assert.equal(retry.totalXp, 15);
	await assertState(15, 2);
});

test("different attempts do not bypass the reward key", async () => {
	await awardXp(input({ attemptId: new mongoose.Types.ObjectId() }));
	assert.equal((await awardXp(input({ attemptId: new mongoose.Types.ObjectId() }))).awarded, 0);
	await assertState(10, 1);
});

test("invalid input is rejected without writes", async () => {
	for (const amount of [0, -1, 1.5, "10", NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
		await assert.rejects(awardXp(input({ amount })), { code: "XP_INVALID_INPUT" });
	}
	for (const change of [
		{ userId: "invalid" }, { attemptId: "invalid" }, { sourceType: "page_visit" },
		{ awardKey: " " }, { awardKey: "x".repeat(301) }, { sourceId: "" },
		{ ruleVersion: 0 }, { ruleVersion: 1.5 },
	]) {
		await assert.rejects(awardXp(input(change)), { code: "XP_INVALID_INPUT" });
	}
	await assert.rejects(awardXp(), { code: "XP_INVALID_INPUT" });
	await assertState(0, 0);
});

test("missing user rolls back the inserted XP event", async () => {
	await assert.rejects(awardXp(input({ userId: new mongoose.Types.ObjectId() })), { code: "XP_USER_NOT_FOUND" });
	assert.equal(await XPEvent.countDocuments(), 0);
});

test("legacy users with no stored totalXp receive the correct first increment", async () => {
	await User.collection.updateOne({ _id: user._id }, { $unset: { totalXp: "" } });
	await awardXp(input());
	await assertState(10, 1);
});

test("total overflow rolls back the event", async () => {
	await User.updateOne({ _id: user._id }, { $set: { totalXp: Number.MAX_SAFE_INTEGER - 5 } });
	await assert.rejects(awardXp(input()), { code: "XP_INVALID_TOTAL" });
	await assertState(Number.MAX_SAFE_INTEGER - 5, 0);
});

test("failed user update rolls back the event and can be retried", async (t) => {
	const failure = new Error("Simulated total write failure");
	const original = User.findOneAndUpdate;
	const stub = t.mock.method(User, "findOneAndUpdate", function (filter, update, ...rest) {
		if (update?.$inc?.totalXp) throw failure;
		return original.call(this, filter, update, ...rest);
	});
	try {
		await assert.rejects(awardXp(input()), error => error === failure);
	} finally {
		stub.mock.restore();
	}
	await assertState(0, 0);
	await awardXp(input());
	await assertState(10, 1);
});

test("unrelated duplicate-key errors are not swallowed", async (t) => {
	const failure = Object.assign(new Error("Other duplicate index"), { code: 11000, keyPattern: { other: 1 } });
	const stub = t.mock.method(XPEvent, "create", async () => { throw failure; });
	try {
		await assert.rejects(awardXp(input()), error => error === failure);
	} finally {
		stub.mock.restore();
	}
	await assertState(0, 0);
});

test("database unique index rejects duplicate events even outside the service", async () => {
	await awardXp(input());
	const event = await XPEvent.findOne().lean();
	delete event._id;
	await assert.rejects(XPEvent.create(event), { code: 11000 });
	await assertState(10, 1);
});

test("deleting accounts cannot receive new or duplicate awards in either transaction mode", async () => {
	await awardXp(input());
	await User.updateOne({ _id: user._id }, { $set: { lifecycleState: "deleting" } });
	for (const data of [input(), input({ awardKey: "other", sourceId: "other" })]) {
		await assert.rejects(awardXp(data), error => error.statusCode === 401);
		await assert.rejects(mongoose.connection.transaction(session => awardXp(data, { session })), error => error.statusCode === 401);
	}
	await assertState(10, 1);
});

test("existing session commits the fence and award together, and caller rollback undoes both", async () => {
	await assert.rejects(mongoose.connection.transaction(async session => {
		assert.equal((await awardXp(input(), { session })).awarded, 10);
		throw new Error("rollback caller");
	}), /rollback caller/);
	await assertState(0, 0);
	assert.equal((await User.findById(user.id).select("+accountWriteFence")).accountWriteFence, 0);
	await mongoose.connection.transaction(async session => {
		assert.equal((await awardXp(input(), { session })).awarded, 10);
		assert.equal((await awardXp(input(), { session })).awarded, 0);
	});
	await assertState(10, 1);
});

test("a standalone award waiting behind deletion cannot commit an event", async () => {
	let entered, release;
	const enteredTransition = new Promise(resolve => { entered = resolve; });
	const releaseTransition = new Promise(resolve => { release = resolve; });
	const transition = mongoose.connection.transaction(async session => {
		await User.updateOne({ _id: user._id }, { $set: { lifecycleState: "deleting" } }, { session });
		entered(); await releaseTransition;
	});
	await enteredTransition;
	const client = mongoose.connection.getClient();
	const sent = new Promise(resolve => {
		const listener = event => {
			if (event.commandName === "findAndModify" && event.command.findAndModify === User.collection.name) {
				client.off("commandStarted", listener); resolve();
			}
		};
		client.on("commandStarted", listener);
	});
	const rejected = assert.rejects(awardXp(input()), error => error.statusCode === 401);
	try { await sent; } finally { release(); }
	await Promise.all([transition, rejected]);
	await assertState(0, 0);
});

test("an award holding the fence commits before a racing deletion", async t => {
	let entered, release;
	const enteredWrite = new Promise(resolve => { entered = resolve; });
	const releaseWrite = new Promise(resolve => { release = resolve; });
	const original = XPEvent.create;
	const stub = t.mock.method(XPEvent, "create", async function (...args) {
		const event = await original.apply(this, args); entered(); await releaseWrite; return event;
	});
	const order = [];
	try {
		const award = awardXp(input()).then(() => order.push("award"));
		await enteredWrite;
		const client = mongoose.connection.getClient();
		const sent = new Promise(resolve => {
			const listener = event => {
				if (event.commandName === "findAndModify" && event.command.findAndModify === User.collection.name) {
					client.off("commandStarted", listener); resolve();
				}
			};
			client.on("commandStarted", listener);
		});
		const deletion = mongoose.connection.transaction(async session => {
			await User.findOneAndUpdate({ _id: user._id }, { $set: { lifecycleState: "deleting" } }, { session });
		}).then(() => order.push("deletion"));
		await sent; release();
		await Promise.all([award, deletion]);
		assert.deepEqual(order, ["award", "deletion"]);
		await assertState(10, 1);
	} finally { release(); stub.mock.restore(); }
});

test("duplicate-key recovery rechecks the fence and preserves the winner", async t => {
	const winner = await awardXp(input());
	const find = XPEvent.findOne;
	let calls = 0;
	const lookup = t.mock.method(XPEvent, "findOne", function (filter, ...args) {
		return find.call(this, ++calls === 1 ? { _id: new mongoose.Types.ObjectId() } : filter, ...args);
	});
	const failure = Object.assign(new Error("duplicate winner"), { code: 11000, keyPattern: { user: 1, awardKey: 1 } });
	const insert = t.mock.method(XPEvent, "create", async () => { throw failure; });
	try {
		const retry = await awardXp(input());
		assert.equal(retry.reason, "already_awarded");
		assert.equal(String(retry.eventId), String(winner.eventId));
		await assertState(10, 1);
	} finally { lookup.mock.restore(); insert.mock.restore(); }
});

test("duplicate-key recovery rejects a deletion committed after the failed attempt", async t => {
	await awardXp(input());
	const find = XPEvent.findOne;
	let calls = 0;
	const lookup = t.mock.method(XPEvent, "findOne", function (filter, ...args) {
		return find.call(this, ++calls === 1 ? { _id: new mongoose.Types.ObjectId() } : filter, ...args);
	});
	const failure = Object.assign(new Error("duplicate winner"), { code: 11000, keyPattern: { user: 1, awardKey: 1 } });
	const insert = t.mock.method(XPEvent, "create", async () => { throw failure; });
	const transaction = mongoose.connection.transaction;
	let first = true;
	const wrapper = t.mock.method(mongoose.connection, "transaction", async function (...args) {
		try { return await transaction.apply(this, args); }
		catch (error) {
			if (first && error === failure) { first = false; await User.updateOne({ _id: user._id }, { $set: { lifecycleState: "deleting" } }); }
			throw error;
		}
	});
	try { await assert.rejects(awardXp(input()), error => error.statusCode === 401); await assertState(10, 1); }
	finally { lookup.mock.restore(); insert.mock.restore(); wrapper.mock.restore(); }
});

test("duplicate-key recovery does not insert when the winning event is missing", async t => {
	const failure = Object.assign(new Error("duplicate winner missing"), { code: 11000, keyPattern: { user: 1, awardKey: 1 } });
	const insert = t.mock.method(XPEvent, "create", async () => { throw failure; });
	try { await assert.rejects(awardXp(input()), error => error === failure); await assertState(0, 0); }
	finally { insert.mock.restore(); }
});

test("a supplied session must be in an active transaction", async () => {
	const session = await mongoose.startSession();
	try { await assert.rejects(awardXp(input(), { session }), { code: "XP_INVALID_SESSION" }); }
	finally { await session.endSession(); }
	await assertState(0, 0);
});
