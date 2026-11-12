const assert = require("node:assert/strict");
const { before, after, beforeEach, test } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const User = require("../models/userModel");
const DialogueProgress = require("../models/dialogueProgressModel");
const Topic = require("../models/topicModel");
const Vocab = require("../models/vocabModel");
const XPEvent = require("../models/xpEventModel");
const Intent = require("../models/avatarUploadIntentModel");
const { initiateAccountDeletion } = require("../services/accountDeletion");
const { deleteDialogueProgress } = require("../services/deleteDialogueProgress");

let db, user, other, topic;
const models = [User, DialogueProgress, Topic, Vocab, XPEvent, Intent];
before(async () => {
	db = await MongoMemoryReplSet.create({ binary: { version: "7.0.14" }, replSet: { count: 1, storageEngine: "wiredTiger" } });
	await mongoose.connect(db.getUri(), { dbName: "delete_dialogue_progress" });
	await Promise.all(models.map(Model => Model.init()));
}, { timeout: 180000 });
after(async () => { await mongoose.disconnect(); await db?.stop(); });
beforeEach(async () => {
	await Promise.all(models.map(Model => Model.deleteMany({})));
	[user, other] = await User.create([
		{ name: "Learner", email: "progress-delete@example.test", googleId: "progress-delete" },
		{ name: "Other", email: "other-progress-delete@example.test", googleId: "other-progress-delete" },
	]);
	topic = await Topic.create({ name: "Retained topic", user: user._id });
});

async function createProgress(owner, lessonId, dialogueId = "dialogue") {
	return DialogueProgress.create({ user: owner._id, lessonId, dialogueId, completedTaskIds: ["task"] });
}
async function markDeleting() { await initiateAccountDeletion(user.id); }

test("requires a valid existing account in deleting state", async () => {
	await assert.rejects(deleteDialogueProgress("invalid"), error => error.statusCode === 400);
	await assert.rejects(deleteDialogueProgress(user.id), error => error.statusCode === 409);
	await assert.rejects(deleteDialogueProgress(new mongoose.Types.ObjectId()), error => error.statusCode === 404);
});

test("deletes only target progress in bounded batches and supports retries", async () => {
	await Promise.all([
		createProgress(user, "lesson-1"),
		createProgress(user, "lesson-2"),
		createProgress(user, "lesson-3"),
		createProgress(other, "foreign-lesson"),
	]);
	const word = await Vocab.create({ user: user._id, topic: topic._id, english: "keep", vietnamese: "giữ" });
	const xp = await XPEvent.create({ user: user._id, awardKey: "keep", sourceType: "dialogue_task", sourceId: "keep", amount: 1, earnedAt: new Date(), dayKey: "2026-11-12", ruleVersion: 1 });
	await Intent.create({ user: user._id, operationId: "progress-cleanup-test", provider: "local", contentType: "image/jpeg", storageKey: `user_${user.id}_00000000-0000-4000-8000-000000000001.jpg` });
	await markDeleting();

	assert.deepEqual(await deleteDialogueProgress(user.id, { batchSize: 2 }), { deletedCount: 2, hasMore: true });
	assert.equal(await DialogueProgress.countDocuments({ user: user._id }), 1);
	assert.deepEqual(await deleteDialogueProgress(user.id, { batchSize: 2 }), { deletedCount: 1, hasMore: false });
	assert.deepEqual(await deleteDialogueProgress(user.id, { batchSize: 2 }), { deletedCount: 0, hasMore: false });
	assert.equal(await DialogueProgress.countDocuments({ user: user._id }), 0);
	assert.equal(await DialogueProgress.countDocuments({ user: other._id }), 1);
	assert.ok(await User.exists({ _id: user._id }));
	assert.ok(await Topic.exists({ _id: topic._id, user: user._id }));
	assert.ok(await Vocab.exists({ _id: word._id, user: user._id }));
	assert.ok(await XPEvent.exists({ _id: xp._id, user: user._id }));
	assert.equal(await Intent.countDocuments({ user: user._id }), 1);
});

test("concurrent batch retries remain isolated and idempotent", async () => {
	await Promise.all(Array.from({ length: 4 }, (_, index) => createProgress(user, `retry-${index}`)));
	await markDeleting();
	const results = await Promise.all([
		deleteDialogueProgress(user.id, { batchSize: 4 }),
		deleteDialogueProgress(user.id, { batchSize: 4 }),
	]);
	assert.equal(results.reduce((sum, result) => sum + result.deletedCount, 0), 4);
	assert.equal(await DialogueProgress.countDocuments({ user: user._id }), 0);
});

test("a transaction failure rolls back the selected progress batch", async t => {
	const records = await Promise.all([
		createProgress(user, "rollback-1"),
		createProgress(user, "rollback-2"),
	]);
	await markDeleting();
	const original = DialogueProgress.deleteMany;
	const stub = t.mock.method(DialogueProgress, "deleteMany", async function (...args) {
		assert.ok(args[1]?.session?.inTransaction());
		await original.apply(this, args);
		throw new Error("simulated dialogue progress cleanup failure");
	});
	try { await assert.rejects(deleteDialogueProgress(user.id, { batchSize: 2 }), /simulated dialogue progress cleanup failure/); }
	finally { stub.mock.restore(); }
	assert.equal(await DialogueProgress.countDocuments({ _id: { $in: records.map(record => record._id) }, user: user._id }), 2);
});

test("rejects invalid batch sizes", async () => {
	await markDeleting();
	for (const batchSize of [0, -1, 1.5, 1001]) {
		await assert.rejects(deleteDialogueProgress(user.id, { batchSize }), error => error.statusCode === 400);
	}
});

