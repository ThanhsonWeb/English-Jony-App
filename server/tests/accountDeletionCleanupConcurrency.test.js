const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { after, before, test } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const User = require("../models/userModel");
const AccountDeletionReceipt = require("../models/accountDeletionReceiptModel");
const AvatarUploadIntent = require("../models/avatarUploadIntentModel");
const { initiateAccountDeletion } = require("../services/accountDeletion");
const { deleteCompletedAvatarIntents } = require("../services/deleteCompletedAvatarIntents");
const { finalizeAccountDeletion } = require("../services/finalizeAccountDeletion");
const { runAvatarCleanupBatch } = require("../services/avatarCleanupWorker");
const { reserveAvatarUpload, beginAvatarUpload, attachAvatarUpload } = require("../services/avatarUploadIntent");
const { receiptIdForEmail } = require("../utils/accountDeletionReceipt");

const cloudConfig = {
	CLOUDINARY_CLOUD_NAME: "studyjony-test",
	CLOUDINARY_API_KEY: "test-api-key",
	CLOUDINARY_API_SECRET: "test-api-secret",
};
const receiptSecretName = "ACCOUNT_DELETION_RECEIPT_HMAC_SECRET";
const previousReceiptSecret = process.env[receiptSecretName];
let db;

before(async () => {
	process.env[receiptSecretName] = "test-only-cleanup-concurrency-receipt-secret-32-bytes";
	db = await MongoMemoryReplSet.create({ binary: { version: "7.0.14" }, replSet: { count: 1, storageEngine: "wiredTiger" } });
	await mongoose.connect(db.getUri(), { dbName: "account_deletion_cleanup_concurrency" });
	await Promise.all([User, AccountDeletionReceipt, AvatarUploadIntent].map(Model => Model.init()));
}, { timeout: 180000 });

after(async () => {
	await mongoose.disconnect();
	await db?.stop();
	if (previousReceiptSecret === undefined) delete process.env[receiptSecretName];
	else process.env[receiptSecretName] = previousReceiptSecret;
});

test("finalization waits for an in-progress Cloudinary cleanup worker", async () => {
	const user = await User.create({ name: "Cleanup race learner", email: "cleanup-race@example.test", googleId: "cleanup-race" });
	const intent = await reserveAvatarUpload(user._id, {
		operationId: randomUUID(), provider: "cloudinary", cloudName: cloudConfig.CLOUDINARY_CLOUD_NAME, contentType: "image/jpeg",
	});
	assert.equal((await beginAvatarUpload(user._id, intent._id)).claimed, true);
	await attachAvatarUpload(user._id, intent._id,
		`https://res.cloudinary.com/${cloudConfig.CLOUDINARY_CLOUD_NAME}/image/upload/v123/${intent.storageKey}.jpg`);
	await initiateAccountDeletion(user._id);

	let signalRequestStarted;
	const requestStarted = new Promise(resolve => { signalRequestStarted = resolve; });
	let releaseDeletion;
	const deletionResponse = new Promise(resolve => { releaseDeletion = resolve; });
	const workerPromise = runAvatarCleanupBatch({
		config: cloudConfig,
		fetchImpl: async (_url, options) => {
			assert.equal(options.body.get("public_id"), intent.storageKey);
			signalRequestStarted();
			return deletionResponse;
		},
	});

	await requestStarted;
	assert.equal((await AvatarUploadIntent.findById(intent._id)).cleanupStatus, "claimed");
	await assert.rejects(finalizeAccountDeletion(user._id), error => {
		assert.equal(error.statusCode, 409);
		assert.ok(error.blockers.includes("avatar_cleanup_claim_held"));
		return true;
	});
	assert.ok(await User.exists({ _id: user._id }));
	assert.equal(await AccountDeletionReceipt.countDocuments({}), 0);

	releaseDeletion({ ok: true, json: async () => ({ result: "ok" }) });
	assert.deepEqual(await workerPromise, { complete: 1, retry: 0, held: 0, skipped: 0 });
	assert.equal((await AvatarUploadIntent.findById(intent._id)).cleanupStatus, "complete");
	assert.deepEqual(await deleteCompletedAvatarIntents(user._id), { deletedCount: 1, hasMore: false });

	const finalized = await finalizeAccountDeletion(user._id);
	assert.equal(finalized.deleted, true);
	assert.equal(finalized.receipt._id, receiptIdForEmail(user.email));
	assert.equal(await User.exists({ _id: user._id }), null);
	assert.equal(await AccountDeletionReceipt.countDocuments({}), 1);
});
