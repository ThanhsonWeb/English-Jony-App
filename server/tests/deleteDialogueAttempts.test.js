const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const { before, after, beforeEach, test } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const User = require("../models/userModel");
const DialogueAttempt = require("../models/dialogueAttemptModel");
const XPEvent = require("../models/xpEventModel");
const Topic = require("../models/topicModel");
const StudyActivity = require("../models/studyActivityModel");
const DialogueProgress = require("../models/dialogueProgressModel");
const Intent = require("../models/avatarUploadIntentModel");
const { initiateAccountDeletion } = require("../services/accountDeletion");
const { deleteXpEvents } = require("../services/deleteXpEvents");
const { deleteDialogueAttempts } = require("../services/deleteDialogueAttempts");

let db, user, other, topic;
const models = [User, DialogueAttempt, XPEvent, Topic, StudyActivity, DialogueProgress, Intent];
before(async () => {
	db = await MongoMemoryReplSet.create({ binary: { version: "7.0.14" }, replSet: { count: 1, storageEngine: "wiredTiger" } });
	await mongoose.connect(db.getUri(), { dbName: "delete_dialogue_attempts" });
	await Promise.all(models.map(Model => Model.init()));
}, { timeout: 180000 });
after(async () => { await mongoose.disconnect(); await db?.stop(); });
beforeEach(async () => {
	await Promise.all(models.map(Model => Model.deleteMany({})));
	[user, other] = await User.create([
		{ name: "Learner", email: "attempt-delete@example.test", googleId: "attempt-delete" },
		{ name: "Other", email: "other-attempt-delete@example.test", googleId: "other-attempt-delete" },
	]);
	topic = await Topic.create({ name: "Retained topic", user: user._id });
});

async function createAttempt(owner, taskKey = "dialogue-task") {
	return DialogueAttempt.create({
		_id: randomBytes(32).toString("hex"), user: owner._id, taskKey,
		startedAt: new Date(), expiresAt: new Date(Date.now() + 600000),
	});
}
async function createXpEvent(owner, key = "attempt-xp") {
	return XPEvent.create({ user: owner._id, awardKey: key, sourceType: "dialogue_task", sourceId: key, amount: 3, earnedAt: new Date(), dayKey: "2026-11-12", ruleVersion: 1 });
}
async function markDeleting() { await initiateAccountDeletion(user.id); }

test("requires deleting account and removal of all target XP events", async () => {
	await assert.rejects(deleteDialogueAttempts("invalid"), error => error.statusCode === 400);
	await assert.rejects(deleteDialogueAttempts(user.id), error => error.statusCode === 409);
	await assert.rejects(deleteDialogueAttempts(new mongoose.Types.ObjectId()), error => error.statusCode === 404);

	const attempt = await createAttempt(user);
	await createXpEvent(user);
	await markDeleting();
	await assert.rejects(deleteDialogueAttempts(user.id), error => error.statusCode === 409);
	assert.ok(await DialogueAttempt.exists({ _id: attempt._id, user: user._id }));
	assert.equal(await DialogueAttempt.countDocuments({ user: user._id }), 1);
});

test("deletes only target attempts in bounded batches after XP cleanup and supports retries", async () => {
	const ownAttempts = await Promise.all([
		createAttempt(user, "own-task-1"),
		createAttempt(user, "own-task-2"),
		createAttempt(user, "own-task-3"),
	]);
	const foreignAttempt = await createAttempt(other, "foreign-task");
	const xp = await createXpEvent(user);
	await Topic.create({ name: "Retained other topic", user: user._id });
	await StudyActivity.create({ user: user._id, date: "2026-11-12", count: 1, hasQualifiedStudy: true });
	await DialogueProgress.create({ user: user._id, lessonId: "lesson", dialogueId: "dialogue", completedTaskIds: ["task"] });
	await Intent.create({ user: user._id, operationId: "attempt-cleanup-test", provider: "local", contentType: "image/jpeg", storageKey: `user_${user.id}_00000000-0000-4000-8000-000000000001.jpg` });
	await markDeleting();

	await assert.rejects(deleteDialogueAttempts(user.id), error => error.statusCode === 409);
	assert.equal(await XPEvent.countDocuments({ user: user._id }), 1);
	await deleteXpEvents(user.id);
	assert.equal(await XPEvent.countDocuments({ user: user._id }), 0);
	assert.deepEqual(await deleteDialogueAttempts(user.id, { batchSize: 2 }), { deletedCount: 2, hasMore: true });
	assert.deepEqual(await deleteDialogueAttempts(user.id, { batchSize: 2 }), { deletedCount: 1, hasMore: false });
	assert.deepEqual(await deleteDialogueAttempts(user.id, { batchSize: 2 }), { deletedCount: 0, hasMore: false });
	assert.equal(await DialogueAttempt.countDocuments({ user: user._id }), 0);
	assert.ok(await DialogueAttempt.exists({ _id: foreignAttempt._id, user: other._id }));
	assert.ok(await User.exists({ _id: user._id }));
	assert.ok(await Topic.exists({ user: user._id }));
	assert.equal(await StudyActivity.countDocuments({ user: user._id }), 1);
	assert.equal(await DialogueProgress.countDocuments({ user: user._id }), 1);
	assert.equal(await Intent.countDocuments({ user: user._id }), 1);
	assert.equal(ownAttempts.length, 3);
	assert.ok(xp._id);
});

test("concurrent retries remain isolated and idempotent", async () => {
	await Promise.all(Array.from({ length: 4 }, (_, index) => createAttempt(user, `concurrent-task-${index}`)));
	await createAttempt(other, "foreign-concurrent-task");
	await markDeleting();
	await deleteXpEvents(user.id);
	const results = await Promise.all([
		deleteDialogueAttempts(user.id, { batchSize: 4 }),
		deleteDialogueAttempts(user.id, { batchSize: 4 }),
	]);
	assert.equal(results.reduce((sum, result) => sum + result.deletedCount, 0), 4);
	assert.equal(await DialogueAttempt.countDocuments({ user: user._id }), 0);
	assert.equal(await DialogueAttempt.countDocuments({ user: other._id }), 1);
});

test("a transaction failure rolls back the selected attempt batch", async t => {
	const records = await Promise.all([createAttempt(user, "rollback-1"), createAttempt(user, "rollback-2")]);
	await markDeleting();
	const original = DialogueAttempt.deleteMany;
	const stub = t.mock.method(DialogueAttempt, "deleteMany", async function (...args) {
		assert.ok(args[1]?.session?.inTransaction());
		await original.apply(this, args);
		throw new Error("simulated dialogue attempt cleanup failure");
	});
	try { await assert.rejects(deleteDialogueAttempts(user.id, { batchSize: 2 }), /simulated dialogue attempt cleanup failure/); }
	finally { stub.mock.restore(); }
	assert.equal(await DialogueAttempt.countDocuments({ _id: { $in: records.map(record => record._id) }, user: user._id }), 2);
});

test("rejects invalid batch sizes", async () => {
	await markDeleting();
	await deleteXpEvents(user.id);
	for (const batchSize of [0, -1, 1.5, 1001]) {
		await assert.rejects(deleteDialogueAttempts(user.id, { batchSize }), error => error.statusCode === 400);
	}
});

