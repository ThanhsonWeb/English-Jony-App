const assert = require("node:assert/strict");
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
const { finalizeAccountDeletion } = require("../services/finalizeAccountDeletion");
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
