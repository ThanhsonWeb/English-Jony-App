const assert = require("node:assert/strict");
const { before, after, beforeEach, test } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const User = require("../models/userModel");
const VocabularyReviewEvent = require("../models/vocabularyReviewEventModel");
const Topic = require("../models/topicModel");
const Vocab = require("../models/vocabModel");
const XPEvent = require("../models/xpEventModel");
const Intent = require("../models/avatarUploadIntentModel");
const { initiateAccountDeletion } = require("../services/accountDeletion");
const { deleteTopics } = require("../services/deleteTopics");

let db, user, other, topic, otherTopic;
const models = [User, VocabularyReviewEvent, Topic, Vocab, XPEvent, Intent];
before(async () => {
	db = await MongoMemoryReplSet.create({ binary: { version: "7.0.14" }, replSet: { count: 1, storageEngine: "wiredTiger" } });
	await mongoose.connect(db.getUri(), { dbName: "delete_topics" });
	await Promise.all(models.map(Model => Model.init()));
}, { timeout: 180000 });
after(async () => { await mongoose.disconnect(); await db?.stop(); });
beforeEach(async () => {
	await Promise.all(models.map(Model => Model.deleteMany({})));
	[user, other] = await User.create([
		{ name: "Learner", email: "topic-delete@example.test", googleId: "topic-delete" },
		{ name: "Other", email: "other-topic-delete@example.test", googleId: "other-topic-delete" },
	]);
	[topic, otherTopic] = await Topic.create([
		{ name: "Learner words", user: user._id },
		{ name: "Other words", user: other._id },
	]);
});

async function markDeleting() { await initiateAccountDeletion(user.id); }
async function createVocab(owner, ownerTopic, english = "word") {
	return Vocab.create({ user: owner._id, topic: ownerTopic._id, english, vietnamese: "từ" });
}

test("requires a valid deleting account with receipts and vocabularies already removed", async () => {
	await assert.rejects(deleteTopics("invalid"), error => error.statusCode === 400);
	await assert.rejects(deleteTopics(user.id), error => error.statusCode === 409);
	await assert.rejects(deleteTopics(new mongoose.Types.ObjectId()), error => error.statusCode === 404);

	await markDeleting();
	const word = await createVocab(user, topic);
	await assert.rejects(deleteTopics(user.id), error => error.statusCode === 409);
	assert.ok(await Topic.exists({ _id: topic._id, user: user._id }));
	await Vocab.deleteOne({ _id: word._id, user: user._id });
	await VocabularyReviewEvent.create({ _id: "receipt-remains", user: user._id, word: word._id, inputHash: "hash", correct: true, completedAt: new Date() });
	await assert.rejects(deleteTopics(user.id), error => error.statusCode === 409);
	assert.ok(await Topic.exists({ _id: topic._id, user: user._id }));
});

test("deletes only target topics in bounded batches and supports retries", async () => {
	const ownTopics = await Topic.create([
		{ name: "One", user: user._id },
		{ name: "Two", user: user._id },
		{ name: "Three", user: user._id },
	]);
	const xp = await XPEvent.create({ user: user._id, awardKey: "keep", sourceType: "vocabulary_review", sourceId: "keep", amount: 1, earnedAt: new Date(), dayKey: "2026-11-12", ruleVersion: 1 });
	await Intent.create({ user: user._id, operationId: "topic-cleanup-test", provider: "local", contentType: "image/jpeg", storageKey: `user_${user.id}_00000000-0000-4000-8000-000000000001.jpg` });
	await markDeleting();

	assert.deepEqual(await deleteTopics(user.id, { batchSize: 2 }), { deletedCount: 2, hasMore: true });
	assert.equal(await Topic.countDocuments({ user: user._id }), 2); // initial topic plus one remaining in this batch sequence
	assert.deepEqual(await deleteTopics(user.id, { batchSize: 2 }), { deletedCount: 2, hasMore: false });
	assert.deepEqual(await deleteTopics(user.id, { batchSize: 2 }), { deletedCount: 0, hasMore: false });
	assert.equal(await Topic.countDocuments({ user: user._id }), 0);
	assert.ok(await Topic.exists({ _id: otherTopic._id, user: other._id }));
	assert.ok(await User.exists({ _id: user._id }));
	assert.ok(await XPEvent.exists({ user: user._id, _id: xp._id }));
	assert.equal(await Vocab.countDocuments({ user: user._id }), 0);
	assert.equal(await VocabularyReviewEvent.countDocuments({ user: user._id }), 0);
	assert.equal(await Intent.countDocuments({ user: user._id }), 1);
	assert.equal(ownTopics.length, 3);
});

test("concurrent batch retries remain isolated and idempotent", async () => {
	await Topic.create(Array.from({ length: 4 }, (_, index) => ({ name: `Topic ${index}`, user: user._id })));
	await markDeleting();
	const results = await Promise.all([
		deleteTopics(user.id, { batchSize: 4 }),
		deleteTopics(user.id, { batchSize: 4 }),
	]);
	assert.equal(results.reduce((sum, result) => sum + result.deletedCount, 0), 5);
	assert.equal(await Topic.countDocuments({ user: user._id }), 0);
});

test("a transaction failure rolls back the selected topic batch", async t => {
	const ownTopics = await Topic.create([
		{ name: "Rollback one", user: user._id },
		{ name: "Rollback two", user: user._id },
	]);
	await markDeleting();
	const original = Topic.deleteMany;
	const stub = t.mock.method(Topic, "deleteMany", async function (...args) {
		assert.ok(args[1]?.session?.inTransaction());
		await original.apply(this, args);
		throw new Error("simulated topic cleanup failure");
	});
	try { await assert.rejects(deleteTopics(user.id, { batchSize: 2 }), /simulated topic cleanup failure/); }
	finally { stub.mock.restore(); }
	assert.equal(await Topic.countDocuments({ _id: { $in: ownTopics.map(item => item._id) }, user: user._id }), 2);
});

test("rejects invalid batch sizes", async () => {
	await markDeleting();
	for (const batchSize of [0, -1, 1.5, 1001]) {
		await assert.rejects(deleteTopics(user.id, { batchSize }), error => error.statusCode === 400);
	}
});
