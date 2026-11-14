const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
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

let db, user, other, topic, word;
before(async () => {
	db = await MongoMemoryReplSet.create({ binary: { version: "7.0.14" }, replSet: { count: 1, storageEngine: "wiredTiger" } });
	await mongoose.connect(db.getUri(), { dbName: "delete_vocabulary_review_events" });
	await Promise.all([User, VocabularyReviewEvent, Topic, Vocab, XPEvent, Intent].map(Model => Model.init()));
}, { timeout: 180000 });
after(async () => { await mongoose.disconnect(); await db?.stop(); });
beforeEach(async () => {
	await Promise.all([User, VocabularyReviewEvent, Topic, Vocab, XPEvent, Intent].map(Model => Model.deleteMany({})));
	[user, other] = await User.create([
		{ name: "Learner", email: "review-delete@example.test", googleId: "review-delete" },
		{ name: "Other", email: "other-review-delete@example.test", googleId: "other-review-delete" },
	]);
	topic = await Topic.create({ name: "Saved words", user: user._id });
	word = await Vocab.create({ user: user._id, topic: topic._id, english: "receipt", vietnamese: "biên nhận" });
});

async function createReview(owner, id = randomUUID(), reviewWord = word) {
	return VocabularyReviewEvent.create({ _id: id, user: owner._id, word: reviewWord._id,
		inputHash: `hash-${id}`, correct: true, completedAt: new Date() });
}

test("requires an existing account in deleting state", async () => {
	await assert.rejects(deleteVocabularyReviewEvents("invalid"), error => error.statusCode === 400);
	await assert.rejects(deleteVocabularyReviewEvents(user.id), error => error.statusCode === 409);
	await assert.rejects(deleteVocabularyReviewEvents(new mongoose.Types.ObjectId()), error => error.statusCode === 404);
});

test("deletes only the target user's review receipts and keeps other account data", async () => {
	const ownA = await createReview(user, "own-a");
	const ownB = await createReview(user, "own-b");
	const otherTopic = await Topic.create({ name: "Other words", user: other._id });
	const otherWord = await Vocab.create({ user: other._id, topic: otherTopic._id, english: "other", vietnamese: "khác" });
	const foreign = await createReview(other, "foreign", otherWord);
	const xp = await XPEvent.create({ user: user._id, awardKey: "retained", sourceType: "vocabulary_review", sourceId: "retained", amount: 1, earnedAt: new Date(), dayKey: "2026-11-12", ruleVersion: 1 });
	await Intent.create({ user: user._id, operationId: randomUUID(), provider: "local", contentType: "image/jpeg", storageKey: `user_${user.id}_${randomUUID()}.jpg` });
	await initiateAccountDeletion(user.id);

	assert.deepEqual(await deleteVocabularyReviewEvents(user.id), { deletedCount: 2 });
	assert.equal(await VocabularyReviewEvent.countDocuments({ user: user._id }), 0);
	assert.equal(await VocabularyReviewEvent.countDocuments({ _id: foreign._id, user: other._id }), 1);
	assert.ok(await User.exists({ _id: user._id }));
	assert.ok(await Vocab.exists({ _id: word._id }));
	assert.ok(await Topic.exists({ _id: topic._id }));
	assert.ok(await XPEvent.exists({ _id: xp._id }));
	assert.equal(await Intent.countDocuments({ user: user._id }), 1);
	assert.ok(ownA && ownB);
});

test("repeated and concurrent invocations are idempotent", async () => {
	await Promise.all([createReview(user, "retry-a"), createReview(user, "retry-b")]);
	await initiateAccountDeletion(user.id);
	const results = await Promise.all([
		deleteVocabularyReviewEvents(user.id),
		deleteVocabularyReviewEvents(user.id),
	]);
	assert.equal(results.reduce((sum, result) => sum + result.deletedCount, 0), 2);
	assert.equal(await VocabularyReviewEvent.countDocuments({ user: user._id }), 0);
	assert.deepEqual(await deleteVocabularyReviewEvents(user.id), { deletedCount: 0 });
});

test("a transaction failure rolls back receipt deletion", async t => {
	const first = await createReview(user, "rollback-a");
	const second = await createReview(user, "rollback-b");
	await initiateAccountDeletion(user.id);
	const original = VocabularyReviewEvent.deleteMany;
	const stub = t.mock.method(VocabularyReviewEvent, "deleteMany", async function (...args) {
		assert.ok(args[1]?.session?.inTransaction());
		await original.apply(this, args);
		throw new Error("simulated receipt cleanup failure");
	});
	try {
		await assert.rejects(deleteVocabularyReviewEvents(user.id), /simulated receipt cleanup failure/);
	} finally { stub.mock.restore(); }
	assert.equal(await VocabularyReviewEvent.countDocuments({ _id: { $in: [first._id, second._id] }, user: user._id }), 2);
});
