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
	await mongoose.connect(replicaSet.getUri(), { dbName: "xp_foundation_test" });
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
	const stub = t.mock.method(User, "findOneAndUpdate", () => { throw failure; });
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
