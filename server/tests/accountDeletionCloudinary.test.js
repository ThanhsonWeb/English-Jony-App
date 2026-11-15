const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { after, before, beforeEach, test } = require("node:test");
const mongoose = require("mongoose");
const path = require("node:path");
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
const { finalizeAccountDeletion } = require("../services/finalizeAccountDeletion");
const { runAvatarCleanupBatch } = require("../services/avatarCleanupWorker");
const { localAvatarDirectory } = require("../services/avatarUpload");
const { reserveAvatarUpload, beginAvatarUpload, recordUploadOutcome, attachAvatarUpload } = require("../services/avatarUploadIntent");
const { receiptIdForEmail } = require("../utils/accountDeletionReceipt");

const receiptSecretName = "ACCOUNT_DELETION_RECEIPT_HMAC_SECRET";
const previousReceiptSecret = process.env[receiptSecretName];
const receiptSecret = "test-only-cloudinary-deletion-receipt-secret-32-bytes";
const cloudConfig = {
	CLOUDINARY_CLOUD_NAME: "studyjony-test",
	CLOUDINARY_API_KEY: "test-api-key",
	CLOUDINARY_API_SECRET: "test-api-secret",
};
const ownedModels = [AvatarUploadIntent, DialogueAttempt, DialogueProgress, StudyActivity, Topic, Vocab, VocabularyReviewEvent, XPEvent];
let db, target, blocked;

before(async () => {
	process.env[receiptSecretName] = receiptSecret;
	db = await MongoMemoryReplSet.create({ binary: { version: "7.0.14" }, replSet: { count: 1, storageEngine: "wiredTiger" } });
	await mongoose.connect(db.getUri(), { dbName: "account_deletion_cloudinary" });
	await Promise.all([User, AccountDeletionReceipt, ...ownedModels].map(Model => Model.init()));
}, { timeout: 180000 });
after(async () => {
	await mongoose.disconnect();
	await db?.stop();
	if (previousReceiptSecret === undefined) delete process.env[receiptSecretName];
	else process.env[receiptSecretName] = previousReceiptSecret;
});

async function createCloudinaryAvatar(user, attach) {
	const intent = await reserveAvatarUpload(user._id, {
		operationId: randomUUID(), provider: "cloudinary", cloudName: cloudConfig.CLOUDINARY_CLOUD_NAME, contentType: "image/jpeg",
	});
	assert.equal((await beginAvatarUpload(user._id, intent._id)).claimed, true);
	if (attach) {
		const avatar = `https://res.cloudinary.com/${cloudConfig.CLOUDINARY_CLOUD_NAME}/image/upload/v123/${intent.storageKey}.jpg`;
		await attachAvatarUpload(user._id, intent._id, avatar);
	} else {
		await recordUploadOutcome(user._id, intent._id, "success");
	}
	return intent;
}

beforeEach(async () => {
	await Promise.all([User.deleteMany({}), AccountDeletionReceipt.deleteMany({}), ...ownedModels.map(Model => Model.deleteMany({}))]);
	[target, blocked] = await User.create([
		{ name: "Target learner", email: "cloudinary-target@example.test", googleId: "cloudinary-target" },
		{ name: "Blocked learner", email: "cloudinary-blocked@example.test", googleId: "cloudinary-blocked" },
	]);
});

test("Cloudinary cleanup gates account finalization until deletion is verified", async () => {
	const targetAvatar = await createCloudinaryAvatar(target, true);
	await initiateAccountDeletion(target._id);
	await assert.rejects(finalizeAccountDeletion(target._id), error => {
		assert.equal(error.statusCode, 409);
		assert.ok(error.blockers.includes("account_owned_data_remaining"));
		assert.ok(error.blockers.includes("avatar_cleanup_pending"));
		return true;
	});
	assert.ok(await User.exists({ _id: target._id }));
	assert.equal(await AccountDeletionReceipt.countDocuments({}), 0);

	let targetDeleteCalls = 0;
	const successfulDelete = async (url, options) => {
		targetDeleteCalls++;
		assert.equal(url, `https://api.cloudinary.com/v1_1/${cloudConfig.CLOUDINARY_CLOUD_NAME}/image/destroy`);
		assert.equal(options.method, "POST");
		assert.equal(options.body.get("public_id"), targetAvatar.storageKey);
		return { ok: true, json: async () => ({ result: "ok" }) };
	};
	assert.deepEqual(await runAvatarCleanupBatch({ config: cloudConfig, fetchImpl: successfulDelete }), {
		complete: 1, retry: 0, held: 0, skipped: 0,
	});
	assert.equal(targetDeleteCalls, 1);
	assert.equal((await AvatarUploadIntent.findById(targetAvatar._id)).cleanupStatus, "complete");
	assert.deepEqual(await deleteCompletedAvatarIntents(target._id), { deletedCount: 1, hasMore: false });

	const finalized = await finalizeAccountDeletion(target._id);
	assert.equal(finalized.deleted, true);
	assert.equal(finalized.receipt._id, receiptIdForEmail(target.email));
	assert.equal(await User.exists({ _id: target._id }), null);
	assert.equal(await AccountDeletionReceipt.countDocuments({}), 1);

	const blockedAttached = await createCloudinaryAvatar(blocked, true);
	const retryable = await createCloudinaryAvatar(blocked, false);
	const uncertain = await createCloudinaryAvatar(blocked, false);
	await initiateAccountDeletion(blocked._id);
	const keys = new Map([
		[blockedAttached.storageKey, "success"],
		[retryable.storageKey, "retry"],
		[uncertain.storageKey, "uncertain"],
	]);
	const mixedResults = await runAvatarCleanupBatch({
		config: cloudConfig,
		fetchImpl: async (_url, options) => {
			const key = options.body.get("public_id");
			if (keys.get(key) === "retry") return { ok: false, status: 429 };
			if (keys.get(key) === "uncertain") throw new Error("mock Cloudinary timeout");
			return { ok: true, json: async () => ({ result: "ok" }) };
		},
	});
	assert.deepEqual(mixedResults, { complete: 1, retry: 1, held: 1, skipped: 0 });
	assert.deepEqual(await deleteCompletedAvatarIntents(blocked._id), { deletedCount: 1, hasMore: false });
	await assert.rejects(finalizeAccountDeletion(blocked._id), error => {
		assert.equal(error.statusCode, 409);
		assert.ok(error.blockers.includes("avatar_cleanup_pending"));
		assert.ok(error.blockers.includes("avatar_cleanup_claim_held"));
		return true;
	});
	assert.ok(await User.exists({ _id: blocked._id }));
	assert.equal(await AccountDeletionReceipt.countDocuments({}), 1);
});

test("Cloudinary account mismatch and missing identity block cleanup and finalization", async () => {
	const mismatched = await createCloudinaryAvatar(target, true);
	await initiateAccountDeletion(target._id);
	let calls = 0;
	assert.deepEqual(await runAvatarCleanupBatch({
		config: { ...cloudConfig, CLOUDINARY_CLOUD_NAME: "other-account" },
		fetchImpl: async () => { calls++; return { ok: true, json: async () => ({ result: "not found" }) }; },
	}), { complete: 0, retry: 1, held: 0, skipped: 0 });
	assert.equal(calls, 0);
	assert.equal((await AvatarUploadIntent.findById(mismatched._id)).cleanupStatus, "retry");
	await assert.rejects(finalizeAccountDeletion(target._id), error => {
		assert.equal(error.statusCode, 409);
		assert.ok(error.blockers.includes("avatar_cleanup_pending"));
		return true;
	});
	assert.ok(await User.exists({ _id: target._id }));
	assert.equal(await AccountDeletionReceipt.countDocuments({}), 0);
	assert.deepEqual(await runAvatarCleanupBatch({
		config: cloudConfig,
		fetchImpl: async () => ({ ok: true, json: async () => ({ result: "ok" }) }),
	}), { complete: 1, retry: 0, held: 0, skipped: 0 });
	assert.deepEqual(await deleteCompletedAvatarIntents(target._id), { deletedCount: 1, hasMore: false });

	const legacy = await createCloudinaryAvatar(blocked, true);
	await initiateAccountDeletion(blocked._id);
	await AvatarUploadIntent.collection.updateOne({ _id: legacy._id }, { $unset: { cloudName: "" } });
	assert.deepEqual(await runAvatarCleanupBatch({ config: cloudConfig, fetchImpl: async () => { calls++; } }), {
		complete: 0, retry: 0, held: 1, skipped: 0,
	});
	assert.equal(calls, 0);
	await assert.rejects(finalizeAccountDeletion(blocked._id), error => {
		assert.equal(error.statusCode, 409);
		assert.ok(error.blockers.includes("avatar_tracking_inconsistent"));
		assert.ok(error.blockers.includes("avatar_cleanup_claim_held"));
		return true;
	});
	assert.ok(await User.exists({ _id: blocked._id }));
	assert.equal(await AccountDeletionReceipt.countDocuments({}), 0);
});

test("local avatar cleanup requires opt-in and gates finalization on mocked file deletion", async () => {
	async function createLocalAvatar(user) {
		const intent = await reserveAvatarUpload(user._id, {
			operationId: randomUUID(), provider: "local", contentType: "image/jpeg",
		});
		assert.equal((await beginAvatarUpload(user._id, intent._id)).claimed, true);
		await attachAvatarUpload(user._id, intent._id, `/api/v1/users/avatar-files/${intent.storageKey}`);
		return intent;
	}

	const successfulIntent = await createLocalAvatar(target);
	await initiateAccountDeletion(target._id);
	let unlinkCalls = 0;
	const mockedUnlink = async filePath => {
		unlinkCalls++;
		assert.equal(filePath, path.join(localAvatarDirectory, successfulIntent.storageKey));
	};
	assert.deepEqual(await runAvatarCleanupBatch({ unlink: mockedUnlink }), {
		complete: 0, retry: 0, held: 0, skipped: 0,
	});
	assert.equal(unlinkCalls, 0);
	await assert.rejects(finalizeAccountDeletion(target._id), error => {
		assert.equal(error.statusCode, 409);
		assert.ok(error.blockers.includes("avatar_cleanup_pending"));
		return true;
	});

	assert.deepEqual(await runAvatarCleanupBatch({ allowLocal: true, unlink: mockedUnlink }), {
		complete: 1, retry: 0, held: 0, skipped: 0,
	});
	assert.equal(unlinkCalls, 1);
	assert.deepEqual(await deleteCompletedAvatarIntents(target._id), { deletedCount: 1, hasMore: false });
	assert.equal((await finalizeAccountDeletion(target._id)).deleted, true);

	const failedIntent = await createLocalAvatar(blocked);
	await initiateAccountDeletion(blocked._id);
	const failedUnlink = async filePath => {
		assert.equal(filePath, path.join(localAvatarDirectory, failedIntent.storageKey));
		const error = new Error("mocked local file deletion failure");
		error.code = "EIO";
		throw error;
	};
	assert.deepEqual(await runAvatarCleanupBatch({ allowLocal: true, unlink: failedUnlink }), {
		complete: 0, retry: 1, held: 0, skipped: 0,
	});
	await assert.rejects(finalizeAccountDeletion(blocked._id), error => {
		assert.equal(error.statusCode, 409);
		assert.ok(error.blockers.includes("avatar_cleanup_pending"));
		return true;
	});
	assert.ok(await User.exists({ _id: blocked._id }));
	assert.equal(await AccountDeletionReceipt.countDocuments({}), 1);
});
