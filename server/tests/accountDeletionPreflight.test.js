const assert = require("node:assert/strict");
const { before, after, beforeEach, test } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const User = require("../models/userModel");
const Intent = require("../models/avatarUploadIntentModel");
const Topic = require("../models/topicModel");
const { initiateAccountDeletion } = require("../services/accountDeletion");
const { preflightAccountDeletion } = require("../services/accountDeletionPreflight");
const { fenceActiveAccountWrite } = require("../utils/accountLifecycle");

let db, user;
before(async () => {
	db = await MongoMemoryReplSet.create({ binary: { version: "7.0.14" }, replSet: { count: 1, storageEngine: "wiredTiger" } });
	await mongoose.connect(db.getUri(), { dbName: "account_deletion_preflight", monitorCommands: true });
	await Promise.all([User.init(), Intent.init(), Topic.init()]);
}, { timeout: 180000 });
after(async () => { await mongoose.disconnect(); await db?.stop(); });
beforeEach(async () => {
	await Promise.all([User.deleteMany({}), Intent.deleteMany({}), Topic.deleteMany({})]);
	user = await User.create({ name: "Learner", email: "preflight@example.test", googleId: "preflight" });
});

async function deletingAccount() {
	await initiateAccountDeletion(user.id);
	return User.findById(user.id).select("+accountWriteFence").lean();
}

function waitForUserWrite() {
	const client = mongoose.connection.getClient();
	return new Promise(resolve => {
		const listener = event => {
			if (event.commandName !== "findAndModify" || event.command.findAndModify !== User.collection.name) return;
			client.off("commandStarted", listener);
			resolve();
		};
		client.on("commandStarted", listener);
	});
}

test("fences a deleting account and checks readiness on the same transaction session", async () => {
	const beforeFence = await deletingAccount();
	const originalTransaction = mongoose.connection.transaction;
	let nestedTransactionCalled = false;
	const client = mongoose.connection.getClient();
	const commands = [];
	const collections = mongoose.modelNames().map(name => mongoose.model(name).collection.name);
	const listener = event => {
		const command = event.command;
		const collection = command?.findAndModify || command?.find || command?.aggregate;
		if (collection && collections.includes(collection)) {
			commands.push({ collection, lsid: command.lsid });
		}
	};
	client.on("commandStarted", listener);
	try {
		await mongoose.connection.transaction(async session => {
			const sessionId = session.id;
			mongoose.connection.transaction = () => {
				nestedTransactionCalled = true;
				throw new Error("preflight attempted a nested transaction");
			};
			try {
				assert.deepEqual(await preflightAccountDeletion(user.id, { session }), {
					ready: true,
					blockers: [],
					remainingCounts: {
						avatarUploadIntents: 0,
						dialogueAttempts: 0,
						dialogueProgress: 0,
						studyActivities: 0,
						topics: 0,
						vocabularies: 0,
						vocabularyReviewEvents: 0,
						xpEvents: 0,
					},
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
	assert.ok(commands.length >= 11, "the fence and readiness reads use the caller's transaction session");
	const saved = await User.findById(user.id).select("+accountWriteFence");
	assert.equal(saved.accountWriteFence, beforeFence.accountWriteFence + 1);
});

test("fails closed for a non-deleting account, remaining account data, and unresolved avatar", async () => {
	await assert.rejects(
		mongoose.connection.transaction(session => preflightAccountDeletion(user.id, { session })),
		error => error.statusCode === 409,
	);
	await User.updateOne({ _id: user._id }, { $set: { lifecycleState: "deleting", avatar: "https://legacy.example/avatar.jpg" } });
	await Topic.create({ name: "Remaining topic", user: user._id });
	const result = await mongoose.connection.transaction(session => preflightAccountDeletion(user.id, { session }));
	assert.equal(result.ready, false);
	assert.ok(result.blockers.includes("account_owned_data_remaining"));
	assert.ok(result.blockers.includes("legacy_avatar_unresolved"));
	assert.equal(result.remainingCounts.topics, 1);
	assert.equal(await User.countDocuments({ _id: user._id }), 1, "preflight never deletes the User");
});

test("requires a valid active transaction session", async () => {
	await deletingAccount();
	await assert.rejects(preflightAccountDeletion(user.id), /active transaction/);
	const session = await mongoose.startSession();
	try {
		await assert.rejects(preflightAccountDeletion(user.id, { session }), /active transaction/);
	} finally { await session.endSession(); }
	await assert.rejects(preflightAccountDeletion("invalid", { session: { inTransaction: () => true } }), error => error.statusCode === 400);
});

test("rolls back the account fence when the caller aborts the transaction", async () => {
	const beforeFence = await deletingAccount();
	await assert.rejects(mongoose.connection.transaction(async session => {
		const result = await preflightAccountDeletion(user.id, { session });
		assert.equal(result.ready, true);
		throw new Error("abort caller transaction");
	}), /abort caller transaction/);
	const afterFence = await User.findById(user.id).select("+accountWriteFence +lifecycleState").lean();
	assert.equal(afterFence.accountWriteFence, beforeFence.accountWriteFence);
	assert.equal(afterFence.lifecycleState, "deleting");
	assert.equal(await User.countDocuments({ _id: user._id }), 1);
});

test("waits for an in-flight fenced account write and reports its committed data", async () => {
	let entered, release;
	const enteredFence = new Promise(resolve => { entered = resolve; });
	const releaseFence = new Promise(resolve => { release = resolve; });
	const writing = mongoose.connection.transaction(async session => {
		await fenceActiveAccountWrite(user._id, session);
		entered();
		await releaseFence;
		await Topic.create([{ name: "Committed during race", user: user._id }], { session });
	}, { readPreference: "primary", readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
	await enteredFence;
	const deletionAttempted = waitForUserWrite();
	const deleting = initiateAccountDeletion(user.id);
	try {
		await deletionAttempted;
	} finally {
		release();
	}
	await Promise.all([writing, deleting]);
	const result = await mongoose.connection.transaction(session => preflightAccountDeletion(user.id, { session }));
	assert.equal(result.ready, false);
	assert.ok(result.blockers.includes("account_owned_data_remaining"));
	assert.equal(result.remainingCounts.topics, 1);
});
