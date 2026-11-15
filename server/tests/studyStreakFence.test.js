const assert = require("node:assert/strict");
const { before, after, beforeEach, test } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const User = require("../models/userModel");
const StudyActivity = require("../models/studyActivityModel");
const { markQualifiedStudy, vietnamDay } = require("../services/studyStreak");

let db, user;
before(async () => {
	db = await MongoMemoryReplSet.create({ binary: { version: "7.0.14" }, replSet: { count: 1, storageEngine: "wiredTiger" } });
	await mongoose.connect(db.getUri(), { dbName: "study_streak_fence", monitorCommands: true });
	await Promise.all([User.init(), StudyActivity.init()]);
}, { timeout: 180000 });
after(async () => { await mongoose.disconnect(); await db?.stop(); });
beforeEach(async () => {
	await Promise.all([User.deleteMany({}), StudyActivity.deleteMany({})]);
	user = await User.create({ name: "Learner", email: "streak@example.test", googleId: "streak" });
});

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

test("missing, malformed and inactive sessions cannot write activity", async () => {
	const session = await mongoose.startSession();
	try {
		for (const options of [undefined, {}, { session: {} }, { session }, { session: { inTransaction: () => false } }]) {
			await assert.rejects(markQualifiedStudy(user.id, options), /active transaction/);
		}
	} finally { await session.endSession(); }
	assert.equal(await StudyActivity.countDocuments(), 0);
	assert.equal((await User.findById(user.id).select("+accountWriteFence")).accountWriteFence, 0);
});

test("deleting accounts cannot create or change activity", async () => {
	const date = vietnamDay();
	await StudyActivity.create({ user: user.id, date, count: 3 });
	await User.updateOne({ _id: user.id }, { $set: { lifecycleState: "deleting" } });
	await assert.rejects(mongoose.connection.transaction(session => markQualifiedStudy(user.id, { session })), error => error.statusCode === 401);
	const activity = await StudyActivity.findOne().lean();
	assert.equal(activity.count, 3);
	assert.notEqual(activity.hasQualifiedStudy, true);
	await assert.rejects(mongoose.connection.transaction(session => markQualifiedStudy(user.id, { session, now: new Date("2020-01-01T00:00:00Z") })), error => error.statusCode === 401);
	assert.equal(await StudyActivity.countDocuments(), 1);
});

test("qualification and its fence roll back with the caller's transaction", async () => {
	const now = new Date("2026-10-06T17:00:00Z");
	await assert.rejects(mongoose.connection.transaction(async session => {
		await markQualifiedStudy(user.id, { session, now });
		throw new Error("caller rollback");
	}), /caller rollback/);
	assert.equal(await StudyActivity.countDocuments(), 0);
	assert.equal((await User.findById(user.id).select("+accountWriteFence")).accountWriteFence, 0);
	await mongoose.connection.transaction(session => markQualifiedStudy(user.id, { session, now }));
	const activity = await StudyActivity.findOne().lean();
	assert.equal(activity.date, vietnamDay(now));
	assert.equal(activity.count, 0);
	assert.equal(activity.hasQualifiedStudy, true);
	assert.equal(activity.firstStudyAt.getTime(), now.getTime());
	assert.equal(activity.lastStudyAt.getTime(), now.getTime());
});

test("qualification waiting behind deletion cannot create activity", async () => {
	let entered, release;
	const enteredDeletion = new Promise(resolve => { entered = resolve; });
	const releaseDeletion = new Promise(resolve => { release = resolve; });
	const deletion = mongoose.connection.transaction(async session => {
		await User.updateOne({ _id: user.id }, { $set: { lifecycleState: "deleting" } }, { session });
		entered(); await releaseDeletion;
	});
	await enteredDeletion;
	const sent = waitForUserWrite();
	const rejected = assert.rejects(mongoose.connection.transaction(session => markQualifiedStudy(user.id, { session })), error => error.statusCode === 401);
	try { await sent; } finally { release(); }
	await Promise.all([deletion, rejected]);
	assert.equal(await StudyActivity.countDocuments(), 0);
});

test("qualification holding the fence commits before deletion", async t => {
	let entered, release;
	const enteredWrite = new Promise(resolve => { entered = resolve; });
	const releaseWrite = new Promise(resolve => { release = resolve; });
	const original = StudyActivity.updateOne;
	const stub = t.mock.method(StudyActivity, "updateOne", async function (...args) {
		const result = await original.apply(this, args); entered(); await releaseWrite; return result;
	});
	const order = [];
	try {
		const write = mongoose.connection.transaction(session => markQualifiedStudy(user.id, { session })).then(() => order.push("study"));
		await enteredWrite;
		const sent = waitForUserWrite();
		const deletion = mongoose.connection.transaction(session => User.findOneAndUpdate(
			{ _id: user.id }, { $set: { lifecycleState: "deleting" } }, { session },
		)).then(() => order.push("deletion"));
		await sent; release();
		await Promise.all([write, deletion]);
		assert.deepEqual(order, ["study", "deletion"]);
		assert.equal(await StudyActivity.countDocuments({ user: user.id, hasQualifiedStudy: true }), 1);
	} finally { release(); stub.mock.restore(); }
});
