const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { before, after, beforeEach, test } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const User = require("../models/userModel");
const Intent = require("../models/avatarUploadIntentModel");
const DialogueAttempt = require("../models/dialogueAttemptModel");
const DialogueProgress = require("../models/dialogueProgressModel");
const StudyActivity = require("../models/studyActivityModel");
const Topic = require("../models/topicModel");
const Vocab = require("../models/vocabModel");
const VocabularyReviewEvent = require("../models/vocabularyReviewEventModel");
const XPEvent = require("../models/xpEventModel");
const { initiateAccountDeletion } = require("../services/accountDeletion");
const { checkAccountDeletionReadiness } = require("../services/accountDeletionReadiness");
const { reserveAvatarUpload, queueAvatarCleanup, claimAvatarCleanup } = require("../services/avatarUploadIntent");

let db, user;
const legacy = "https://legacy.example.test/avatar.jpg";
const ownedModels = [Intent, DialogueAttempt, DialogueProgress, StudyActivity, Topic, Vocab, VocabularyReviewEvent, XPEvent];
const emptyCounts = {
	avatarUploadIntents: 0,
	dialogueAttempts: 0,
	dialogueProgress: 0,
	studyActivities: 0,
	topics: 0,
	vocabularies: 0,
	vocabularyReviewEvents: 0,
	xpEvents: 0,
};
before(async () => {
	db = await MongoMemoryReplSet.create({ binary: { version: "7.0.14" }, replSet: { count: 1, storageEngine: "wiredTiger" } });
	await mongoose.connect(db.getUri(), { dbName: "account_deletion_readiness", monitorCommands: true });
	await Promise.all([User, ...ownedModels].map(Model => Model.init()));
}, { timeout: 180000 });
after(async () => { await mongoose.disconnect(); await db?.stop(); });
beforeEach(async () => {
	await Promise.all([User.deleteMany({}), ...ownedModels.map(Model => Model.deleteMany({}))]);
	user = await User.create({ name: "Learner", email: "readiness@example.test", googleId: "readiness", avatar: legacy });
});

async function deletingAccount({ keepLegacy = false } = {}) {
	await User.updateOne({ _id: user.id }, { $set: { avatar: "" } });
	await initiateAccountDeletion(user.id);
	if (keepLegacy) await User.updateOne({ _id: user.id }, { $set: { avatar: legacy } });
}
async function createIntent({ uploadStatus = "reserved", uploadResult = null, cleanupStatus = "none", attachmentStatus = "unattached", provider = "local", cloudName = "studyjony-test" } = {}) {
	const intent = await reserveAvatarUpload(user.id, { operationId: randomUUID(), provider, cloudName, contentType: "image/jpeg" });
	const fields = { uploadStatus, uploadResult, cleanupStatus, attachmentStatus };
	await Intent.updateOne({ _id: intent.id }, { $set: fields });
	return Intent.findById(intent.id).lean();
}
async function blockers() { return (await checkAccountDeletionReadiness(user.id)).blockers; }

test("reports ready after deletion when no tracked or legacy avatar remains", async () => {
	await deletingAccount();
	assert.deepEqual(await checkAccountDeletionReadiness(user.id), { ready: true, blockers: [], remainingCounts: emptyCounts });
});

test("an unresolved legacy avatar blocks readiness", async () => {
	await deletingAccount({ keepLegacy: true });
	assert.deepEqual(await blockers(), ["legacy_avatar_unresolved"]);
});

test("an account that has not entered deletion is not ready", async () => {
	assert.deepEqual(await blockers(), ["account_not_deleting", "legacy_avatar_unresolved"]);
});

test("unfinished and uncertain upload outcomes block readiness", async () => {
	const intent = await createIntent();
	await deletingAccount();
	for (const [uploadStatus, uploadResult] of [["reserved", null], ["uploading", null], ["uncertain", "unknown"], ["finished", "unknown"]]) {
		await Intent.updateOne({ _id: intent._id }, { $set: { uploadStatus, uploadResult, cleanupStatus: "pending" } });
		const found = await blockers();
		assert.ok(found.includes("avatar_upload_unfinished"), `${uploadStatus}/${uploadResult}`);
		assert.ok(found.includes("avatar_cleanup_pending"), `${uploadStatus}/${uploadResult}`);
	}
});

test("pending, retry, and held cleanup claims are distinct blockers", async () => {
	const intent = await createIntent({ uploadStatus: "finished", uploadResult: "success", cleanupStatus: "pending" });
	await deletingAccount();
	assert.deepEqual(await blockers(), ["account_owned_data_remaining", "avatar_cleanup_pending"]);
	await queueAvatarCleanup(user.id, intent._id);
	await Intent.updateOne({ _id: intent._id }, { $set: { cleanupStatus: "retry" } });
	assert.deepEqual(await blockers(), ["account_owned_data_remaining", "avatar_cleanup_pending"]);
	await Intent.updateOne({ _id: intent._id }, { $set: { cleanupStatus: "pending" } });
	assert.equal((await claimAvatarCleanup(user.id, intent._id)).claimed, true);
	assert.deepEqual(await blockers(), ["account_owned_data_remaining", "avatar_cleanup_claim_held"]);
});

test("completed avatar intent still counts until its tracking record is purged", async () => {
	await createIntent({ uploadStatus: "finished", uploadResult: "success", cleanupStatus: "complete" });
	await deletingAccount();
	const result = await checkAccountDeletionReadiness(user.id);
	assert.equal(result.ready, false);
	assert.deepEqual(result.blockers, ["account_owned_data_remaining"]);
	assert.equal(result.remainingCounts.avatarUploadIntents, 1);
});

test("counts remaining rows in every account-owned collection and keeps readiness false", async () => {
	const topic = await Topic.create({ name: "Saved words", user: user._id });
	const word = await Vocab.create({ user: user._id, topic: topic._id, english: "snapshot", vietnamese: "ảnh chụp" });
	await Promise.all([
		DialogueAttempt.create({ _id: randomUUID().replaceAll("-", ""), user: user._id, taskKey: "[]", startedAt: new Date(), expiresAt: new Date(Date.now() + 60000) }),
		DialogueProgress.create({ user: user._id, lessonId: "lesson", dialogueId: "dialogue" }),
		StudyActivity.create({ user: user._id, date: "2026-11-12" }),
		XPEvent.create({ user: user._id, awardKey: "audit:1", sourceType: "dialogue_task", sourceId: "audit", amount: 1, earnedAt: new Date(), dayKey: "2026-11-12", ruleVersion: 1 }),
		VocabularyReviewEvent.create({ _id: "review-audit", user: user._id, word: word._id, inputHash: "hash", correct: true, completedAt: new Date() }),
	]);
	await deletingAccount();
	const result = await checkAccountDeletionReadiness(user.id);
	assert.equal(result.ready, false);
	assert.deepEqual(result.blockers, ["account_owned_data_remaining"]);
	assert.deepEqual(result.remainingCounts, {
		...emptyCounts,
		dialogueAttempts: 1,
		dialogueProgress: 1,
		studyActivities: 1,
		topics: 1,
		vocabularies: 1,
		vocabularyReviewEvents: 1,
		xpEvents: 1,
	});
});

test("inconsistent tracking and attached avatar records fail closed", async () => {
	const intent = await createIntent({ uploadStatus: "finished", uploadResult: "success", attachmentStatus: "attached", cleanupStatus: "none" });
	await deletingAccount();
	await User.updateOne({ _id: user.id }, { $set: { avatarIntent: intent._id, avatar: "https://res.cloudinary.com/demo/image/upload/v123/studyjony/avatars/mismatched.jpg" } });
	assert.ok((await blockers()).includes("avatar_tracking_inconsistent"));
	await User.updateOne({ _id: user.id }, { $unset: { avatarIntent: 1 } });
	assert.ok((await blockers()).includes("avatar_tracking_inconsistent"));
});

test("a tracked Cloudinary URL must name the same account as its intent", async () => {
	const intent = await createIntent({ provider: "cloudinary", uploadStatus: "finished", uploadResult: "success", attachmentStatus: "attached" });
	await User.updateOne({ _id: user.id }, { $set: { lifecycleState: "deleting", avatarIntent: intent._id,
		avatar: `https://res.cloudinary.com/other-account/image/upload/v123/${intent.storageKey}.jpg` } });
	assert.ok((await blockers()).includes("avatar_tracking_inconsistent"));
	await Intent.updateOne({ _id: intent._id }, { $unset: { cloudName: 1 } });
	assert.ok((await blockers()).includes("avatar_tracking_inconsistent"));
});

test("malformed avatarIntent values fail closed", async () => {
	await deletingAccount();
	for (const avatarIntent of ["", "not-an-object-id", user._id.toString(), 0, false, {}, []]) {
		await User.collection.updateOne({ _id: user._id }, { $set: { avatarIntent } });
		assert.ok((await blockers()).includes("avatar_tracking_inconsistent"), `avatarIntent=${String(avatarIntent)}`);
	}
});

test("non-string and whitespace-only avatar values fail closed", async () => {
	await deletingAccount();
	for (const avatar of [null, 0, false, {}, []]) {
		await User.collection.updateOne({ _id: user._id }, { $set: { avatar } });
		assert.ok((await blockers()).includes("avatar_tracking_inconsistent"), `avatar=${String(avatar)}`);
	}
	await User.collection.updateOne({ _id: user._id }, { $set: { avatar: " \t  " } });
	assert.ok((await blockers()).includes("legacy_avatar_unresolved"));
});

test("uses the caller transaction session without opening or committing a nested transaction", async () => {
	await deletingAccount();
	const originalTransaction = mongoose.connection.transaction;
	const client = mongoose.connection.getClient();
	const commands = [];
	let nestedTransactionCalled = false;
	const listener = event => {
		const collection = event.command?.find || event.command?.aggregate;
		if (collection && [User.collection.name, ...ownedModels.map(Model => Model.collection.name)].includes(collection)) {
			commands.push({ collection, lsid: event.command.lsid });
		}
	};
	client.on("commandStarted", listener);
	try {
		await mongoose.connection.transaction(async session => {
			const sessionId = session.id;
			mongoose.connection.transaction = () => {
				nestedTransactionCalled = true;
				throw new Error("readiness checker opened a nested transaction");
			};
			try {
				assert.deepEqual(await checkAccountDeletionReadiness(user.id, { session }), {
					ready: true, blockers: [], remainingCounts: emptyCounts,
				});
				assert.equal(session.inTransaction(), true);
			} finally {
				mongoose.connection.transaction = originalTransaction;
			}
			assert.deepEqual(commands.map(command => command.lsid), commands.map(() => sessionId));
		}, { readPreference: "primary", readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
	} finally {
		mongoose.connection.transaction = originalTransaction;
		client.off("commandStarted", listener);
	}
	assert.equal(nestedTransactionCalled, false);
	assert.ok(commands.length >= 10, "all owner, intent, and collection-count reads used the caller session");
});

test("rejects a supplied session that has no active transaction", async () => {
	const session = await mongoose.startSession();
	try {
		await assert.rejects(checkAccountDeletionReadiness(user.id, { session }), /active transaction/);
	} finally { await session.endSession(); }
});

test("checker performs only reads and does not change account or intent state", async () => {
	const intent = await createIntent({ uploadStatus: "finished", uploadResult: "success", cleanupStatus: "pending" });
	await deletingAccount();
	const beforeUser = await User.findById(user.id).select("+lifecycleState +avatarIntent").lean();
	const beforeIntent = await Intent.findById(intent._id).lean();
	const writes = [];
	const client = mongoose.connection.getClient();
	const listener = event => {
		const isWrite = ["insert", "update", "delete", "findAndModify", "bulkWrite"].includes(event.commandName);
		const collection = event.command?.insert ?? event.command?.update ?? event.command?.delete ?? event.command?.findAndModify;
		if (isWrite && [User.collection.name, ...ownedModels.map(Model => Model.collection.name)].includes(collection)) writes.push(event.commandName);
	};
	client.on("commandStarted", listener);
	try { await checkAccountDeletionReadiness(user.id); }
	finally { client.off("commandStarted", listener); }
	assert.deepEqual(writes, []);
	assert.deepEqual(await User.findById(user.id).select("+lifecycleState +avatarIntent").lean(), beforeUser);
	assert.deepEqual(await Intent.findById(intent._id).lean(), beforeIntent);
});

test("invalid and missing accounts are rejected", async () => {
	await assert.rejects(checkAccountDeletionReadiness("invalid"), error => error.statusCode === 400);
	await assert.rejects(checkAccountDeletionReadiness(new mongoose.Types.ObjectId()), error => error.statusCode === 404);
});
