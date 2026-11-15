const assert = require("node:assert/strict");
const { before, after, beforeEach, test } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const User = require("../models/userModel");
const DialogueAttempt = require("../models/dialogueAttemptModel");
const { fenceActiveAccountWrite } = require("../utils/accountLifecycle");
const { startDialogueAttempt } = require("../services/dialogueAttempt");

const ids = ["asking-for-directions", "finding-a-cafe", "1"];
let db, user;

before(async () => {
	db = await MongoMemoryReplSet.create({ binary: { version: "7.0.14" }, replSet: { count: 1, storageEngine: "wiredTiger" } });
	await mongoose.connect(db.getUri(), { dbName: "account_write_fence", monitorCommands: true });
	await Promise.all([User.init(), DialogueAttempt.init()]);
}, { timeout: 180000 });

after(async () => {
	await mongoose.disconnect();
	await db?.stop();
});

beforeEach(async () => {
	await Promise.all([User.deleteMany({}), DialogueAttempt.deleteMany({})]);
	user = await User.create({ name: "Learner", email: "learner@example.test", googleId: "learner" });
});

test("fence requires an active transaction", async () => {
	await assert.rejects(fenceActiveAccountWrite(user.id), /active transaction/);
	const session = await mongoose.startSession();
	try {
		await assert.rejects(fenceActiveAccountWrite(user.id, session), /active transaction/);
	} finally { await session.endSession(); }
});

test("attempt start reuses an existing attempt for active and legacy accounts", async () => {
	const first = await startDialogueAttempt(user.id, ids);
	const second = await startDialogueAttempt(user.id, ids);
	assert.equal(first.attemptId, second.attemptId);
	assert.equal(await DialogueAttempt.countDocuments({ user: user.id }), 1);
	await User.collection.updateOne({ _id: user._id }, { $unset: { lifecycleState: "" } });
	assert.equal((await startDialogueAttempt(user.id, ids)).attemptId, first.attemptId);
});

test("deleting, invalid-state, and missing accounts cannot start or reuse an attempt", async () => {
	await startDialogueAttempt(user.id, ids);
	for (const state of ["deleting", null, "unknown"]) {
		await User.collection.updateOne({ _id: user._id }, { $set: { lifecycleState: state } });
		await assert.rejects(startDialogueAttempt(user.id, ids), error => error.statusCode === 401);
	}
	await assert.rejects(startDialogueAttempt(new mongoose.Types.ObjectId(), ids), error => error.statusCode === 401);
	assert.equal(await DialogueAttempt.countDocuments(), 1);
});

test("an attempt creation failure rolls back its write and the fence", async () => {
	const original = DialogueAttempt.create;
	DialogueAttempt.create = async function (...args) {
		assert.ok(args[1].session.inTransaction());
		await original.apply(this, args);
		throw new Error("abort attempt");
	};
	try {
		await assert.rejects(startDialogueAttempt(user.id, ids), /abort attempt/);
	} finally { DialogueAttempt.create = original; }
	assert.equal(await DialogueAttempt.countDocuments(), 0);
	assert.equal((await User.findById(user.id).select("+accountWriteFence")).accountWriteFence, 0);
});

test("attempt creation and deletion transition serialize on the account fence", async () => {
	let entered, release;
	const enteredWrite = new Promise(resolve => { entered = resolve; });
	const releaseWrite = new Promise(resolve => { release = resolve; });
	const original = DialogueAttempt.create;
	const order = [];
	DialogueAttempt.create = async function (...args) {
		const result = await original.apply(this, args);
		entered();
		await releaseWrite;
		return result;
	};
	try {
		const write = startDialogueAttempt(user.id, ids).then(() => { order.push("attempt"); });
		await enteredWrite;
		const sent = new Promise(resolve => {
			const client = mongoose.connection.getClient();
			const onCommand = event => {
				if (event.commandName !== "findAndModify" || event.command.findAndModify !== User.collection.name) return;
				client.off("commandStarted", onCommand);
				resolve();
			};
			client.on("commandStarted", onCommand);
		});
		const transition = mongoose.connection.transaction(async session => {
			const account = await User.findOneAndUpdate({ _id: user._id, lifecycleState: "active" }, { $set: { lifecycleState: "deleting" } }, { session, returnDocument: "after" });
			assert.ok(account);
		}).then(() => { order.push("deleting"); });
		await sent;
		release();
		await Promise.all([write, transition]);
		assert.deepEqual(order, ["attempt", "deleting"]);
		await assert.rejects(startDialogueAttempt(user.id, ids), error => error.statusCode === 401);
		assert.equal(await DialogueAttempt.countDocuments(), 1);
	} finally {
		release();
		DialogueAttempt.create = original;
	}
});

test("an attempt racing behind a deleting transition is rejected", async () => {
	let entered, release;
	const enteredTransition = new Promise(resolve => { entered = resolve; });
	const releaseTransition = new Promise(resolve => { release = resolve; });
	const transition = mongoose.connection.transaction(async session => {
		await User.updateOne({ _id: user._id, lifecycleState: "active" }, { $set: { lifecycleState: "deleting" } }, { session });
		entered();
		await releaseTransition;
	});
	await enteredTransition;
	const sent = new Promise(resolve => {
		const client = mongoose.connection.getClient();
		const onCommand = event => {
			if (event.commandName !== "findAndModify" || event.command.findAndModify !== User.collection.name) return;
			client.off("commandStarted", onCommand);
			resolve();
		};
		client.on("commandStarted", onCommand);
	});
	const rejected = assert.rejects(startDialogueAttempt(user.id, ids), error => error.statusCode === 401);
	try {
		await sent;
	} finally {
		release();
	}
	await Promise.all([transition, rejected]);
	assert.equal(await DialogueAttempt.countDocuments(), 0);
});
