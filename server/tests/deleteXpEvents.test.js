const assert = require("node:assert/strict");
const { before, after, beforeEach, test } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const User = require("../models/userModel");
const XPEvent = require("../models/xpEventModel");
const Topic = require("../models/topicModel");
const StudyActivity = require("../models/studyActivityModel");
const DialogueProgress = require("../models/dialogueProgressModel");
const Intent = require("../models/avatarUploadIntentModel");
const { initiateAccountDeletion } = require("../services/accountDeletion");
const { deleteXpEvents } = require("../services/deleteXpEvents");
const awardXp = require("../services/awardXp");

let db, user, other, topic;
const models = [User, XPEvent, Topic, StudyActivity, DialogueProgress, Intent];
before(async () => {
	db = await MongoMemoryReplSet.create({ binary: { version: "7.0.14" }, replSet: { count: 1, storageEngine: "wiredTiger" } });
	await mongoose.connect(db.getUri(), { dbName: "delete_xp_events" });
	await Promise.all(models.map(Model => Model.init()));
}, { timeout: 180000 });
after(async () => { await mongoose.disconnect(); await db?.stop(); });
beforeEach(async () => {
	await Promise.all(models.map(Model => Model.deleteMany({})));
	[user, other] = await User.create([
		{ name: "Learner", email: "xp-delete@example.test", googleId: "xp-delete" },
		{ name: "Other", email: "other-xp-delete@example.test", googleId: "other-xp-delete" },
	]);
	topic = await Topic.create({ name: "Retained topic", user: user._id });
});

async function createEvent(owner, key) {
	return XPEvent.create({ user: owner._id, awardKey: key, sourceType: "dialogue_task", sourceId: key, amount: 3, earnedAt: new Date(), dayKey: "2026-11-12", ruleVersion: 1 });
}
async function markDeleting() { await initiateAccountDeletion(user.id); }

test("requires a valid existing account in deleting state", async () => {
	await assert.rejects(deleteXpEvents("invalid"), error => error.statusCode === 400);
	await assert.rejects(deleteXpEvents(user.id), error => error.statusCode === 409);
	await assert.rejects(deleteXpEvents(new mongoose.Types.ObjectId()), error => error.statusCode === 404);
});

test("deletes only target XP events in bounded batches and supports retries", async () => {
	await Promise.all([
		createEvent(user, "own-1"),
		createEvent(user, "own-2"),
		createEvent(user, "own-3"),
		createEvent(other, "foreign-1"),
	]);
	await User.updateOne({ _id: user._id }, { $set: { totalXp: 9 } });
	await Topic.create({ name: "Retained other topic", user: user._id });
	await StudyActivity.create({ user: user._id, date: "2026-11-12", count: 1, hasQualifiedStudy: true });
	await DialogueProgress.create({ user: user._id, lessonId: "lesson", dialogueId: "dialogue", completedTaskIds: ["task"] });
	await Intent.create({ user: user._id, operationId: "xp-cleanup-test", provider: "local", contentType: "image/jpeg", storageKey: `user_${user.id}_00000000-0000-4000-8000-000000000001.jpg` });
	await markDeleting();

	assert.deepEqual(await deleteXpEvents(user.id, { batchSize: 2 }), { deletedCount: 2, hasMore: true });
	assert.deepEqual(await deleteXpEvents(user.id, { batchSize: 2 }), { deletedCount: 1, hasMore: false });
	assert.deepEqual(await deleteXpEvents(user.id, { batchSize: 2 }), { deletedCount: 0, hasMore: false });
	assert.equal(await XPEvent.countDocuments({ user: user._id }), 0);
	assert.equal(await XPEvent.countDocuments({ user: other._id }), 1);
	assert.ok(await User.exists({ _id: user._id }));
	assert.equal((await User.findById(user._id).select("+totalXp")).totalXp, 9);
	assert.ok(await Topic.exists({ user: user._id }));
	assert.equal(await StudyActivity.countDocuments({ user: user._id }), 1);
	assert.equal(await DialogueProgress.countDocuments({ user: user._id }), 1);
	assert.equal(await Intent.countDocuments({ user: user._id }), 1);
});

test("concurrent retries remain isolated and idempotent", async () => {
	await Promise.all(Array.from({ length: 4 }, (_, index) => createEvent(user, `concurrent-${index}`)));
	await createEvent(other, "foreign-concurrent");
	await markDeleting();
	const results = await Promise.all([
		deleteXpEvents(user.id, { batchSize: 4 }),
		deleteXpEvents(user.id, { batchSize: 4 }),
	]);
	assert.equal(results.reduce((sum, result) => sum + result.deletedCount, 0), 4);
	assert.equal(await XPEvent.countDocuments({ user: user._id }), 0);
	assert.equal(await XPEvent.countDocuments({ user: other._id }), 1);
});

test("a transaction failure rolls back the selected XP event batch", async t => {
	const records = await Promise.all([createEvent(user, "rollback-1"), createEvent(user, "rollback-2")]);
	await markDeleting();
	const original = XPEvent.deleteMany;
	const stub = t.mock.method(XPEvent, "deleteMany", async function (...args) {
		assert.ok(args[1]?.session?.inTransaction());
		await original.apply(this, args);
		throw new Error("simulated XP event cleanup failure");
	});
	try { await assert.rejects(deleteXpEvents(user.id, { batchSize: 2 }), /simulated XP event cleanup failure/); }
	finally { stub.mock.restore(); }
	assert.equal(await XPEvent.countDocuments({ _id: { $in: records.map(record => record._id) }, user: user._id }), 2);
});

test("rejects invalid batch sizes", async () => {
	await markDeleting();
	for (const batchSize of [0, -1, 1.5, 1001]) {
		await assert.rejects(deleteXpEvents(user.id, { batchSize }), error => error.statusCode === 400);
	}
});

test("active accounts can still receive XP through the existing award service", async () => {
	const result = await awardXp({ userId: user.id, awardKey: "normal-active-award", sourceType: "dialogue_task", sourceId: "task-1", amount: 7, ruleVersion: 1 });
	assert.deepEqual({ awarded: result.awarded, totalXp: result.totalXp, reason: result.reason }, { awarded: 7, totalXp: 7, reason: "awarded" });
	assert.ok(await XPEvent.exists({ user: user._id, awardKey: "normal-active-award" }));
});

