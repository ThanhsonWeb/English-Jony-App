const assert = require("node:assert/strict");
const { before, after, beforeEach, test } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const User = require("../models/userModel");
const DialogueAttempt = require("../models/dialogueAttemptModel");
const { claimDialogueAttempt, taskRule } = require("../services/dialogueAttempt");
const { completionFor } = require("./helpers/learningAttempt");

const ids = ["asking-for-directions", "finding-a-cafe", "1"];
let db, user, proof;
before(async () => {
	db = await MongoMemoryReplSet.create({ binary: { version: "7.0.14" }, replSet: { count: 1, storageEngine: "wiredTiger" } });
	await mongoose.connect(db.getUri(), { dbName: "dialogue_claim_fence", monitorCommands: true });
	await Promise.all([User.init(), DialogueAttempt.init()]);
}, { timeout: 180000 });
after(async () => { await mongoose.disconnect(); await db?.stop(); });
beforeEach(async () => {
	await Promise.all([User.deleteMany({}), DialogueAttempt.deleteMany({})]);
	user = await User.create({ name: "Learner", email: "claim@example.test", googleId: "claim" });
	proof = await completionFor(user.id, ids);
});

function waitForUserWrite() {
	const client = mongoose.connection.getClient();
	return new Promise(resolve => {
		const listener = event => {
			if (event.commandName !== "findAndModify" || event.command.findAndModify !== User.collection.name) return;
			client.off("commandStarted", listener); resolve();
		};
		client.on("commandStarted", listener);
	});
}

test("missing, malformed and inactive sessions fail before reading an attempt", async t => {
	const session = await mongoose.startSession();
	const find = t.mock.method(DialogueAttempt, "findOne", () => { throw new Error("unexpected attempt read"); });
	try {
		for (const value of [undefined, null, {}, session, { inTransaction: () => false }]) {
			await assert.rejects(claimDialogueAttempt(user.id, ids, proof, value, new Date()), /active transaction/);
		}
		assert.equal(find.mock.callCount(), 0);
	} finally { find.mock.restore(); await session.endSession(); }
	assert.equal((await DialogueAttempt.findById(proof.attemptId)).consumedAt, undefined);
});

test("deleting accounts cannot read or consume an attempt", async t => {
	await User.updateOne({ _id: user.id }, { $set: { lifecycleState: "deleting" } });
	const find = t.mock.method(DialogueAttempt, "findOne", () => { throw new Error("unexpected attempt read"); });
	try {
		await assert.rejects(mongoose.connection.transaction(session => claimDialogueAttempt(user.id, ids, proof, session, new Date())), error => error.statusCode === 401);
		assert.equal(find.mock.callCount(), 0);
	} finally { find.mock.restore(); }
	assert.equal((await DialogueAttempt.findById(proof.attemptId)).consumedAt, undefined);
});

test("caller rollback restores both consumption and the account fence", async () => {
	const beforeFence = (await User.findById(user.id).select("+accountWriteFence")).accountWriteFence;
	await assert.rejects(mongoose.connection.transaction(async session => {
		assert.equal((await claimDialogueAttempt(user.id, ids, proof, session, new Date())).fresh, true);
		throw new Error("rollback caller");
	}), /rollback caller/);
	assert.equal((await DialogueAttempt.findById(proof.attemptId)).consumedAt, undefined);
	assert.equal((await User.findById(user.id).select("+accountWriteFence")).accountWriteFence, beforeFence);
	await mongoose.connection.transaction(async session => {
		assert.equal((await claimDialogueAttempt(user.id, ids, proof, session, new Date())).fresh, true);
		assert.equal((await claimDialogueAttempt(user.id, ids, proof, session, new Date())).fresh, false);
	});
});

test("answer and expiry validation still reject without consuming", async () => {
	const rule = taskRule(ids);
	const wrong = rule.type === "multipleChoice" ? { ...proof, optionIndex: -1 }
		: rule.type === "review" ? { ...proof, acknowledged: false } : { ...proof, answers: [] };
	await assert.rejects(mongoose.connection.transaction(session => claimDialogueAttempt(user.id, ids, wrong, session, new Date())), error => error.statusCode === 400);
	const attempt = await DialogueAttempt.findById(proof.attemptId).lean();
	await assert.rejects(mongoose.connection.transaction(session => claimDialogueAttempt(user.id, ids, proof, session, new Date(attempt.expiresAt.getTime() + 1))), { code: "studyAttemptExpired" });
	assert.equal((await DialogueAttempt.findById(proof.attemptId)).consumedAt, undefined);
});

test("a claim waiting behind deletion cannot consume the attempt", async () => {
	let entered, release;
	const enteredDeletion = new Promise(resolve => { entered = resolve; });
	const releaseDeletion = new Promise(resolve => { release = resolve; });
	const deletion = mongoose.connection.transaction(async session => {
		await User.updateOne({ _id: user.id }, { $set: { lifecycleState: "deleting" } }, { session });
		entered(); await releaseDeletion;
	});
	await enteredDeletion;
	const sent = waitForUserWrite();
	const rejected = assert.rejects(mongoose.connection.transaction(session => claimDialogueAttempt(user.id, ids, proof, session, new Date())), error => error.statusCode === 401);
	try { await sent; } finally { release(); }
	await Promise.all([deletion, rejected]);
	assert.equal((await DialogueAttempt.findById(proof.attemptId)).consumedAt, undefined);
});

test("a claim holding the fence commits before deletion", async t => {
	let entered, release;
	const enteredWrite = new Promise(resolve => { entered = resolve; });
	const releaseWrite = new Promise(resolve => { release = resolve; });
	const original = DialogueAttempt.prototype.save;
	const stub = t.mock.method(DialogueAttempt.prototype, "save", async function (...args) {
		const result = await original.apply(this, args); entered(); await releaseWrite; return result;
	});
	const order = [];
	try {
		const claim = mongoose.connection.transaction(session => claimDialogueAttempt(user.id, ids, proof, session, new Date())).then(() => order.push("claim"));
		await enteredWrite;
		const sent = waitForUserWrite();
		const deletion = mongoose.connection.transaction(session => User.findOneAndUpdate(
			{ _id: user.id }, { $set: { lifecycleState: "deleting" } }, { session },
		)).then(() => order.push("deletion"));
		await sent; release();
		await Promise.all([claim, deletion]);
		assert.deepEqual(order, ["claim", "deletion"]);
		assert.ok((await DialogueAttempt.findById(proof.attemptId)).consumedAt);
	} finally { release(); stub.mock.restore(); }
});
