const assert = require("node:assert/strict");
const { before, after, beforeEach, test } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const User = require("../models/userModel");
const StudyActivity = require("../models/studyActivityModel");
const Topic = require("../models/topicModel");
const XPEvent = require("../models/xpEventModel");
const DialogueProgress = require("../models/dialogueProgressModel");
const Intent = require("../models/avatarUploadIntentModel");
const { initiateAccountDeletion } = require("../services/accountDeletion");
const { deleteStudyActivities } = require("../services/deleteStudyActivities");

let db, user, other, topic;
const models = [User, StudyActivity, Topic, XPEvent, DialogueProgress, Intent];
before(async () => {
	db = await MongoMemoryReplSet.create({ binary: { version: "7.0.14" }, replSet: { count: 1, storageEngine: "wiredTiger" } });
	await mongoose.connect(db.getUri(), { dbName: "delete_study_activities" });
	await Promise.all(models.map(Model => Model.init()));
}, { timeout: 180000 });
after(async () => { await mongoose.disconnect(); await db?.stop(); });
beforeEach(async () => {
	await Promise.all(models.map(Model => Model.deleteMany({})));
	[user, other] = await User.create([
		{ name: "Learner", email: "activity-delete@example.test", googleId: "activity-delete" },
		{ name: "Other", email: "other-activity-delete@example.test", googleId: "other-activity-delete" },
	]);
	topic = await Topic.create({ name: "Retained topic", user: user._id });
});

async function createActivity(owner, date) {
	return StudyActivity.create({ user: owner._id, date, count: 1, hasQualifiedStudy: true });
}
async function markDeleting() { await initiateAccountDeletion(user.id); }

test("requires a valid existing account in deleting state", async () => {
	await assert.rejects(deleteStudyActivities("invalid"), error => error.statusCode === 400);
	await assert.rejects(deleteStudyActivities(user.id), error => error.statusCode === 409);
	await assert.rejects(deleteStudyActivities(new mongoose.Types.ObjectId()), error => error.statusCode === 404);
});

test("deletes only target activity and streak history in bounded retryable batches", async () => {
	await Promise.all([
		createActivity(user, "2026-11-01"),
		createActivity(user, "2026-11-02"),
		createActivity(user, "2026-11-03"),
		createActivity(other, "2026-11-01"),
	]);
	const xp = await XPEvent.create({ user: user._id, awardKey: "keep", sourceType: "vocabulary_review", sourceId: "keep", amount: 1, earnedAt: new Date(), dayKey: "2026-11-12", ruleVersion: 1 });
	await DialogueProgress.create({ user: user._id, lessonId: "lesson", dialogueId: "dialogue", completedTaskIds: ["task"] });
	await Intent.create({ user: user._id, operationId: "activity-cleanup-test", provider: "local", contentType: "image/jpeg", storageKey: `user_${user.id}_00000000-0000-4000-8000-000000000001.jpg` });
	await markDeleting();

	assert.deepEqual(await deleteStudyActivities(user.id, { batchSize: 2 }), { deletedCount: 2, hasMore: true });
	assert.deepEqual(await deleteStudyActivities(user.id, { batchSize: 2 }), { deletedCount: 1, hasMore: false });
	assert.deepEqual(await deleteStudyActivities(user.id, { batchSize: 2 }), { deletedCount: 0, hasMore: false });
	assert.equal(await StudyActivity.countDocuments({ user: user._id }), 0);
	assert.equal(await StudyActivity.countDocuments({ user: other._id }), 1);
	assert.ok(await User.exists({ _id: user._id }));
	assert.ok(await Topic.exists({ _id: topic._id, user: user._id }));
	assert.ok(await XPEvent.exists({ _id: xp._id, user: user._id }));
	assert.equal(await DialogueProgress.countDocuments({ user: user._id }), 1);
	assert.equal(await Intent.countDocuments({ user: user._id }), 1);
});

test("concurrent retries remain isolated and idempotent", async () => {
	await Promise.all(Array.from({ length: 4 }, (_, index) => createActivity(user, `2026-11-0${index + 1}`)));
	await createActivity(other, "2026-11-01");
	await markDeleting();
	const results = await Promise.all([
		deleteStudyActivities(user.id, { batchSize: 4 }),
		deleteStudyActivities(user.id, { batchSize: 4 }),
	]);
	assert.equal(results.reduce((sum, result) => sum + result.deletedCount, 0), 4);
	assert.equal(await StudyActivity.countDocuments({ user: user._id }), 0);
	assert.equal(await StudyActivity.countDocuments({ user: other._id }), 1);
});

test("a transaction failure rolls back the selected activity batch", async t => {
	const records = await Promise.all([
		createActivity(user, "2026-11-01"),
		createActivity(user, "2026-11-02"),
	]);
	await markDeleting();
	const original = StudyActivity.deleteMany;
	const stub = t.mock.method(StudyActivity, "deleteMany", async function (...args) {
		assert.ok(args[1]?.session?.inTransaction());
		await original.apply(this, args);
		throw new Error("simulated study activity cleanup failure");
	});
	try { await assert.rejects(deleteStudyActivities(user.id, { batchSize: 2 }), /simulated study activity cleanup failure/); }
	finally { stub.mock.restore(); }
	assert.equal(await StudyActivity.countDocuments({ _id: { $in: records.map(record => record._id) }, user: user._id }), 2);
});

test("rejects invalid batch sizes", async () => {
	await markDeleting();
	for (const batchSize of [0, -1, 1.5, 1001]) {
		await assert.rejects(deleteStudyActivities(user.id, { batchSize }), error => error.statusCode === 400);
	}
});

