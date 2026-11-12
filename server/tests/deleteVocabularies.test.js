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
const { deleteVocabularyReviewEvents } = require("../services/deleteVocabularyReviewEvents");
const { deleteVocabularies } = require("../services/deleteVocabularies");

let db, user, other, topic, otherTopic;
const models = [User, VocabularyReviewEvent, Topic, Vocab, XPEvent, Intent];
before(async () => {
	db = await MongoMemoryReplSet.create({ binary: { version: "7.0.14" }, replSet: { count: 1, storageEngine: "wiredTiger" } });
	await mongoose.connect(db.getUri(), { dbName: "delete_vocabularies" });
	await Promise.all(models.map(Model => Model.init()));
}, { timeout: 180000 });
after(async () => { await mongoose.disconnect(); await db?.stop(); });
beforeEach(async () => {
	await Promise.all(models.map(Model => Model.deleteMany({})));
	[user, other] = await User.create([
		{ name: "Learner", email: "vocab-delete@example.test", googleId: "vocab-delete" },
		{ name: "Other", email: "other-vocab-delete@example.test", googleId: "other-vocab-delete" },
	]);
	[topic, otherTopic] = await Topic.create([
		{ name: "Learner words", user: user._id },
		{ name: "Other words", user: other._id },
	]);
});

async function createVocab(owner, ownerTopic, english = "word") {
	return Vocab.create({ user: owner._id, topic: ownerTopic._id, english, vietnamese: "từ" });
}
async function markDeleting() { await initiateAccountDeletion(user.id); }

test("requires a valid deleting account and no remaining review receipts", async () => {
	await assert.rejects(deleteVocabularies("invalid"), error => error.statusCode === 400);
	await assert.rejects(deleteVocabularies(user.id), error => error.statusCode === 409);
	await assert.rejects(deleteVocabularies(new mongoose.Types.ObjectId()), error => error.statusCode === 404);
	const word = await createVocab(user, topic);
	await VocabularyReviewEvent.create({ _id: "receipt-remains", user: user._id, word: word._id, inputHash: "hash", correct: true, completedAt: new Date() });
	await markDeleting();
	await assert.rejects(deleteVocabularies(user.id), error => error.statusCode === 409);
	assert.ok(await Vocab.exists({ _id: word._id, user: user._id }));
});

test("deletes only target vocabularies in bounded batches and supports retries", async () => {
	const ownWords = await Promise.all([
		createVocab(user, topic, "one"),
		createVocab(user, topic, "two"),
		createVocab(user, topic, "three"),
	]);
	const foreignWord = await createVocab(other, otherTopic, "foreign");
	const xp = await XPEvent.create({ user: user._id, awardKey: "keep", sourceType: "vocabulary_review", sourceId: "keep", amount: 1, earnedAt: new Date(), dayKey: "2026-11-12", ruleVersion: 1 });
	await Intent.create({ user: user._id, operationId: "vocab-cleanup-test", provider: "local", contentType: "image/jpeg", storageKey: `user_${user.id}_00000000-0000-4000-8000-000000000001.jpg` });
	await markDeleting();

	assert.deepEqual(await deleteVocabularies(user.id, { batchSize: 2 }), { deletedCount: 2, hasMore: true });
	assert.equal(await Vocab.countDocuments({ user: user._id }), 1);
	assert.deepEqual(await deleteVocabularies(user.id, { batchSize: 2 }), { deletedCount: 1, hasMore: false });
	assert.deepEqual(await deleteVocabularies(user.id, { batchSize: 2 }), { deletedCount: 0, hasMore: false });
	assert.equal(await Vocab.countDocuments({ user: user._id }), 0);
	assert.ok(await Vocab.exists({ _id: foreignWord._id, user: other._id }));
	assert.ok(await User.exists({ _id: user._id }));
	assert.ok(await Topic.exists({ _id: topic._id, user: user._id }));
	assert.ok(await XPEvent.exists({ user: user._id, _id: xp._id }));
	assert.equal(await Intent.countDocuments({ user: user._id }), 1);
	assert.equal(await VocabularyReviewEvent.countDocuments({ user: user._id }), 0);
	assert.equal(ownWords.length, 3);
});

test("concurrent batch retries remain isolated and idempotent", async () => {
	await Promise.all(Array.from({ length: 4 }, (_, index) => createVocab(user, topic, `word-${index}`)));
	await markDeleting();
	const results = await Promise.all([
		deleteVocabularies(user.id, { batchSize: 4 }),
		deleteVocabularies(user.id, { batchSize: 4 }),
	]);
	assert.equal(results.reduce((sum, result) => sum + result.deletedCount, 0), 4);
	assert.equal(await Vocab.countDocuments({ user: user._id }), 0);
});

test("a transaction failure rolls back the selected vocabulary batch", async t => {
	const words = await Promise.all([
		createVocab(user, topic, "rollback-one"),
		createVocab(user, topic, "rollback-two"),
	]);
	await markDeleting();
	const original = Vocab.deleteMany;
	const stub = t.mock.method(Vocab, "deleteMany", async function (...args) {
		assert.ok(args[1]?.session?.inTransaction());
		await original.apply(this, args);
		throw new Error("simulated vocabulary cleanup failure");
	});
	try { await assert.rejects(deleteVocabularies(user.id, { batchSize: 2 }), /simulated vocabulary cleanup failure/); }
	finally { stub.mock.restore(); }
	assert.equal(await Vocab.countDocuments({ _id: { $in: words.map(word => word._id) }, user: user._id }), 2);
});

test("rejects invalid batch sizes", async () => {
	await markDeleting();
	for (const batchSize of [0, -1, 1.5, 1001]) {
		await assert.rejects(deleteVocabularies(user.id, { batchSize }), error => error.statusCode === 400);
	}
});
