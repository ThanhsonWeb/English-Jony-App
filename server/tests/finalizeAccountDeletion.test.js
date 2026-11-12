const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { after, before, beforeEach, test } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const User = require("../models/userModel");
const AccountDeletionReceipt = require("../models/accountDeletionReceiptModel");
const AvatarUploadIntent = require("../models/avatarUploadIntentModel");
const DialogueAttempt = require("../models/dialogueAttemptModel");
const DialogueProgress = require("../models/dialogueProgressModel");
const StudyActivity = require("../models/studyActivityModel");
const Topic = require("../models/topicModel");
const Vocab = require("../models/vocabModel");
const VocabularyReviewEvent = require("../models/vocabularyReviewEventModel");
const XPEvent = require("../models/xpEventModel");
const { initiateAccountDeletion } = require("../services/accountDeletion");
const { deleteCompletedAvatarIntents } = require("../services/deleteCompletedAvatarIntents");
const { deleteDialogueAttempts } = require("../services/deleteDialogueAttempts");
const { deleteDialogueProgress } = require("../services/deleteDialogueProgress");
const { deleteStudyActivities } = require("../services/deleteStudyActivities");
const { deleteTopics } = require("../services/deleteTopics");
const { deleteVocabularies } = require("../services/deleteVocabularies");
const { deleteVocabularyReviewEvents } = require("../services/deleteVocabularyReviewEvents");
const { deleteXpEvents } = require("../services/deleteXpEvents");
const { finalizeAccountDeletion } = require("../services/finalizeAccountDeletion");
const { reserveAvatarUpload, beginAvatarUpload, recordUploadOutcome, claimAvatarCleanup, recordCleanupResult } = require("../services/avatarUploadIntent");
const { receiptIdForEmail } = require("../utils/accountDeletionReceipt");

const receiptSecret = "test-only-finalization-receipt-secret-32-bytes";
const receiptSecretName = "ACCOUNT_DELETION_RECEIPT_HMAC_SECRET";
const originalReceiptSecret = process.env[receiptSecretName];
const ownedModels = [AvatarUploadIntent, DialogueAttempt, DialogueProgress, StudyActivity, Topic, Vocab, VocabularyReviewEvent, XPEvent];
let db, user;

before(async () => {
	process.env[receiptSecretName] = receiptSecret;
	db = await MongoMemoryReplSet.create({ binary: { version: "7.0.14" }, replSet: { count: 1, storageEngine: "wiredTiger" } });
	await mongoose.connect(db.getUri(), { dbName: "account_deletion_finalization" });
	await Promise.all([User, AccountDeletionReceipt, ...ownedModels].map(Model => Model.init()));
}, { timeout: 180000 });
after(async () => {
	await mongoose.disconnect();
	await db?.stop();
	if (originalReceiptSecret === undefined) delete process.env[receiptSecretName];
	else process.env[receiptSecretName] = originalReceiptSecret;
});
beforeEach(async () => {
	await Promise.all([User.deleteMany({}), AccountDeletionReceipt.deleteMany({}), ...ownedModels.map(Model => Model.deleteMany({}))]);
	user = await User.create({ name: "Learner", email: "finalize@example.test", googleId: "finalize" });
	await initiateAccountDeletion(user._id);
});

test("preflights, creates the privacy-safe receipt, and deletes the deleting User atomically", async () => {
	const result = await finalizeAccountDeletion(user._id);
	assert.equal(result.deleted, true);
	assert.equal(result.receipt._id, receiptIdForEmail(user.email));
	assert.deepEqual(Object.keys(result.receipt).sort(), ["_id", "completedAt", "expiresAt"]);
	assert.equal(await User.exists({ _id: user._id }), null);
	assert.equal(await AccountDeletionReceipt.countDocuments({}), 1);
	assert.equal(await Promise.all(ownedModels.map(Model => Model.countDocuments({ user: user._id }))).then(counts => counts.reduce((a, b) => a + b, 0)), 0);
});

test("blockers prevent receipt creation and User deletion", async () => {
	await Topic.create({ name: "Still owned", user: user._id });
	await User.updateOne({ _id: user._id }, { $set: { avatar: "https://legacy.example/avatar.jpg" } });
	await assert.rejects(finalizeAccountDeletion(user._id), error => {
		assert.equal(error.statusCode, 409);
		assert.ok(error.blockers.includes("account_owned_data_remaining"));
		assert.ok(error.blockers.includes("legacy_avatar_unresolved"));
		return true;
	});
	assert.ok(await User.exists({ _id: user._id }));
	assert.equal(await AccountDeletionReceipt.countDocuments({}), 0);
});

test("an active account cannot receive a completion receipt or be deleted", async () => {
	await User.updateOne({ _id: user._id }, { $set: { lifecycleState: "active" } });
	await assert.rejects(finalizeAccountDeletion(user._id), error => error.statusCode === 409);
	assert.ok(await User.exists({ _id: user._id }));
	assert.equal(await AccountDeletionReceipt.countDocuments({}), 0);
});

test("receipt and User deletion roll back together when the delete operation fails", async t => {
	const before = await User.findById(user._id).select("+accountWriteFence");
	const originalDeleteOne = User.deleteOne;
	t.mock.method(User, "deleteOne", async function (...args) {
		await originalDeleteOne.apply(this, args);
		throw new Error("simulated finalization failure");
	});
	await assert.rejects(finalizeAccountDeletion(user._id), /simulated finalization failure/);
	assert.ok(await User.exists({ _id: user._id }));
	assert.equal(await AccountDeletionReceipt.countDocuments({}), 0);
	const surviving = await User.findById(user._id).select("+accountWriteFence +lifecycleState");
	assert.equal(surviving.lifecycleState, "deleting");
	assert.equal(surviving.accountWriteFence, before.accountWriteFence, "the preflight fence increment also rolls back");
});

test("concurrent finalization calls produce one receipt and delete the User once", async () => {
	const results = await Promise.allSettled([
		finalizeAccountDeletion(user._id),
		finalizeAccountDeletion(user._id),
	]);
	assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
	const rejected = results.find(result => result.status === "rejected");
	assert.ok(rejected);
	assert.equal(rejected.reason.statusCode, 409);
	assert.equal(await User.exists({ _id: user._id }), null);
	assert.equal(await AccountDeletionReceipt.countDocuments({}), 1);
});

test("runs the internal account deletion lifecycle without touching another account's data", async () => {
	await User.updateOne({ _id: user._id }, { $set: { lifecycleState: "active" } });
	const other = await User.create({ name: "Other learner", email: "other-finalize@example.test", googleId: "other-finalize" });

	const [targetTopic, otherTopic] = await Topic.create([
		{ name: "Target topic", user: user._id },
		{ name: "Other topic", user: other._id },
	]);
	const [targetWord, otherWord] = await Vocab.create([
		{ english: "target-word", vietnamese: "target meaning", user: user._id, topic: targetTopic._id },
		{ english: "other-word", vietnamese: "other meaning", user: other._id, topic: otherTopic._id },
	]);
	const now = new Date();
	await VocabularyReviewEvent.create([
		{ _id: "target-review", user: user._id, word: targetWord._id, inputHash: "target-hash", correct: true, completedAt: now },
		{ _id: "other-review", user: other._id, word: otherWord._id, inputHash: "other-hash", correct: true, completedAt: now },
	]);
	await DialogueAttempt.create([
		{ _id: randomUUID().replaceAll("-", ""), user: user._id, taskKey: "target-task", startedAt: now, expiresAt: new Date(now.getTime() + 60000) },
		{ _id: randomUUID().replaceAll("-", ""), user: other._id, taskKey: "other-task", startedAt: now, expiresAt: new Date(now.getTime() + 60000) },
	]);
	await DialogueProgress.create([
		{ user: user._id, lessonId: "target-lesson", dialogueId: "target-dialogue" },
		{ user: other._id, lessonId: "other-lesson", dialogueId: "other-dialogue" },
	]);
	await StudyActivity.create([
		{ user: user._id, date: "2026-11-12", count: 1, hasQualifiedStudy: true },
		{ user: other._id, date: "2026-11-12", count: 1, hasQualifiedStudy: true },
	]);
	await XPEvent.create([
		{ user: user._id, awardKey: "target-award", sourceType: "dialogue_task", sourceId: "target-source", amount: 1, earnedAt: now, dayKey: "2026-11-12", ruleVersion: 1 },
		{ user: other._id, awardKey: "other-award", sourceType: "dialogue_task", sourceId: "other-source", amount: 1, earnedAt: now, dayKey: "2026-11-12", ruleVersion: 1 },
	]);

	const targetIntent = await reserveAvatarUpload(user._id, { operationId: randomUUID(), provider: "local", contentType: "image/png" });
	const otherIntent = await reserveAvatarUpload(other._id, { operationId: randomUUID(), provider: "local", contentType: "image/png" });
	await beginAvatarUpload(user._id, targetIntent._id);
	await recordUploadOutcome(user._id, targetIntent._id, "failure");

	await initiateAccountDeletion(user._id);
	assert.equal((await User.findById(user._id).select("+lifecycleState")).lifecycleState, "deleting");
	await assert.rejects(finalizeAccountDeletion(user._id), error => {
		assert.equal(error.statusCode, 409);
		assert.ok(error.blockers.includes("account_owned_data_remaining"));
		return true;
	});
	assert.ok(await User.exists({ _id: user._id }));
	assert.equal(await AccountDeletionReceipt.countDocuments({}), 0);

	await deleteVocabularyReviewEvents(user._id);
	await deleteVocabularies(user._id);
	await deleteTopics(user._id);
	await deleteDialogueProgress(user._id);
	await deleteStudyActivities(user._id);
	await deleteXpEvents(user._id);
	await deleteDialogueAttempts(user._id);
	const claim = await claimAvatarCleanup(user._id, targetIntent._id);
	assert.equal(claim.claimed, true);
	await recordCleanupResult(user._id, targetIntent._id, claim.intent.cleanupGeneration, claim.claimToken, true);
	assert.deepEqual(await deleteCompletedAvatarIntents(user._id), { deletedCount: 1, hasMore: false });

	for (const Model of ownedModels) assert.equal(await Model.countDocuments({ user: user._id }), 0, `${Model.modelName} target rows are cleared`);
	for (const Model of ownedModels) assert.equal(await Model.countDocuments({ user: other._id }), 1, `${Model.modelName} other-account row remains`);
	assert.ok(await AvatarUploadIntent.exists({ _id: otherIntent._id, user: other._id }));

	const result = await finalizeAccountDeletion(user._id);
	assert.equal(result.deleted, true);
	assert.equal(result.receipt._id, receiptIdForEmail(user.email));
	assert.equal(await User.exists({ _id: user._id }), null);
	assert.ok(await User.exists({ _id: other._id }));
	assert.equal(await AccountDeletionReceipt.countDocuments({}), 1);
	for (const Model of ownedModels) assert.equal(await Model.countDocuments({ user: other._id }), 1, `${Model.modelName} other-account row remains after finalization`);
});
