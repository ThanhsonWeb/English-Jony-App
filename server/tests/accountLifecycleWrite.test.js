const assert = require("node:assert/strict");
const { after, before, beforeEach, test } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const User = require("../models/userModel");
const { withActiveAccountWrite } = require("../utils/accountLifecycle");

const probeSchema = new mongoose.Schema({
	user: { type: mongoose.Schema.Types.ObjectId, required: true },
	value: { type: String, required: true },
}, { versionKey: false });
const AccountWriteProbe = mongoose.models.AccountWriteProbe || mongoose.model("AccountWriteProbe", probeSchema);

let replicaSet;
let user;

before(async () => {
	replicaSet = await MongoMemoryReplSet.create({
		binary: { version: "7.0.14" },
		replSet: { count: 1, storageEngine: "wiredTiger" },
	});
	await mongoose.connect(replicaSet.getUri(), { dbName: "account_lifecycle_write_test" });
	await Promise.all([User.init(), AccountWriteProbe.init()]);
}, { timeout: 180000 });

after(async () => {
	await mongoose.disconnect();
	await replicaSet?.stop();
});

beforeEach(async () => {
	await Promise.all([User.deleteMany({}), AccountWriteProbe.deleteMany({})]);
	user = await User.create({
		name: "Lifecycle learner",
		email: `learner-${new mongoose.Types.ObjectId()}@example.test`,
		googleId: `google-${new mongoose.Types.ObjectId()}`,
	});
});

test("an active account is fenced in the same transaction as its writes", async () => {
	const updatedAt = user.updatedAt.getTime();
	await withActiveAccountWrite(user._id, async session => {
		await AccountWriteProbe.create([{ user: user._id, value: "written" }], { session });
	});

	const stored = await User.findById(user._id).select("+accountWriteFence");
	assert.equal(stored.accountWriteFence, 1);
	assert.equal(stored.updatedAt.getTime(), updatedAt, "internal fencing must not change profile timestamps");
	assert.equal(await AccountWriteProbe.countDocuments({ user: user._id }), 1);
});

test("legacy accounts with no lifecycle field remain writable", async () => {
	await User.collection.updateOne({ _id: user._id }, { $unset: { lifecycleState: "" } });
	await withActiveAccountWrite(user._id, session => AccountWriteProbe.create([
		{ user: user._id, value: "legacy" },
	], { session }));

	const rawUser = await User.collection.findOne({ _id: user._id });
	assert.equal(rawUser.lifecycleState, undefined);
	assert.equal(rawUser.accountWriteFence, 1);
	assert.equal(await AccountWriteProbe.countDocuments({ user: user._id }), 1);
});

test("deleting, malformed, and missing accounts cannot run the write callback", async () => {
	await User.updateOne({ _id: user._id }, { $set: { lifecycleState: "deleting" } });
	let callbackCalled = false;
	await assert.rejects(
		withActiveAccountWrite(user._id, async () => { callbackCalled = true; }),
		error => error.statusCode === 401,
	);
	assert.equal(callbackCalled, false);
	assert.equal(await AccountWriteProbe.countDocuments({ user: user._id }), 0);

	for (const state of [null, "unknown"]) {
		await User.collection.updateOne({ _id: user._id }, { $set: { lifecycleState: state } });
		await assert.rejects(withActiveAccountWrite(user._id, async () => { callbackCalled = true; }), error => error.statusCode === 401);
	}
	await assert.rejects(withActiveAccountWrite(new mongoose.Types.ObjectId(), async () => { callbackCalled = true; }), error => error.statusCode === 401);
	assert.equal(callbackCalled, false);
});

test("the helper joins an existing transaction instead of nesting one", async () => {
	let callbackSession;
	await mongoose.connection.transaction(async session => {
		await withActiveAccountWrite(user._id, async suppliedSession => {
			callbackSession = suppliedSession;
			await AccountWriteProbe.create([{ user: user._id, value: "joined" }], { session: suppliedSession });
		}, { session });
		assert.equal(callbackSession, session);
	});
	assert.equal(await AccountWriteProbe.countDocuments({ user: user._id, value: "joined" }), 1);

	const inactiveSession = await mongoose.startSession();
	try {
		await assert.rejects(
			withActiveAccountWrite(user._id, async () => {}, { session: inactiveSession }),
			/The supplied account-write session must have an active transaction/,
		);
	} finally {
		await inactiveSession.endSession();
	}
});

test("a write racing with deletion commits before the state transition", async () => {
	let enteredWrite;
	const writeEntered = new Promise(resolve => { enteredWrite = resolve; });
	let releaseWrite;
	const writeRelease = new Promise(resolve => { releaseWrite = resolve; });
	let enteredTransition;
	const transitionEntered = new Promise(resolve => { enteredTransition = resolve; });
	const order = [];

	const write = withActiveAccountWrite(user._id, async session => {
		await AccountWriteProbe.create([{ user: user._id, value: "before-delete" }], { session });
		enteredWrite();
		await writeRelease;
	});
	await writeEntered;

	const transition = mongoose.connection.transaction(async session => {
		enteredTransition();
		const result = await User.findOneAndUpdate(
			{ _id: user._id, lifecycleState: "active" },
			{ $set: { lifecycleState: "deleting" } },
			{ session, returnDocument: "after", timestamps: false },
		);
		assert.ok(result, "transition retries after the active writer commits");
	});
	await transitionEntered;
	releaseWrite();
	await write;
	order.push("write committed");
	await transition;
	order.push("deleting committed");

	assert.deepEqual(order, ["write committed", "deleting committed"]);
	assert.equal((await User.findById(user._id).select("+lifecycleState")).lifecycleState, "deleting");
	assert.equal(await AccountWriteProbe.countDocuments({ user: user._id, value: "before-delete" }), 1);
	await assert.rejects(withActiveAccountWrite(user._id, async () => {}), error => error.statusCode === 401);
});

test("a failed callback rolls back both its data writes and the account fence", async () => {
	await assert.rejects(withActiveAccountWrite(user._id, async session => {
		await AccountWriteProbe.create([{ user: user._id, value: "rolled-back" }], { session });
		throw new Error("abort this write");
	}), /abort this write/);
	assert.equal(await AccountWriteProbe.countDocuments({ user: user._id }), 0);
	assert.equal((await User.findById(user._id).select("+accountWriteFence")).accountWriteFence, 0);
});
