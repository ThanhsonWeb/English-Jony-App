const assert = require("node:assert/strict");
const { after, before, beforeEach, test } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const AccountDeletionReceipt = require("../models/accountDeletionReceiptModel");
const {
	createAccountDeletionReceipt,
	receiptIdForEmail,
	MAX_RETENTION_MS,
} = require("../utils/accountDeletionReceipt");

const secretEnv = "ACCOUNT_DELETION_RECEIPT_HMAC_SECRET";
const testSecret = "test-only-account-deletion-receipt-secret-32-bytes";
const originalSecret = process.env[secretEnv];
const originalJwtSecret = process.env.JWT_SECRET;
let db;

before(async () => {
	process.env[secretEnv] = testSecret;
	db = await MongoMemoryReplSet.create({ binary: { version: "7.0.14" }, replSet: { count: 1, storageEngine: "wiredTiger" } });
	await mongoose.connect(db.getUri(), { dbName: "account_deletion_receipts", monitorCommands: true });
	await AccountDeletionReceipt.init();
}, { timeout: 180000 });
after(async () => {
	await mongoose.disconnect();
	await db?.stop();
	if (originalSecret === undefined) delete process.env[secretEnv];
	else process.env[secretEnv] = originalSecret;
	if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
	else process.env.JWT_SECRET = originalJwtSecret;
});
beforeEach(async () => { await AccountDeletionReceipt.deleteMany({}); });

test("stores only a versioned email HMAC and the two timestamps", async () => {
	const receipt = await createAccountDeletionReceipt("  Learner@Example.Test ");
	assert.match(receipt._id, /^v1:[a-f0-9]{64}$/);
	assert.deepEqual(Object.keys(receipt).sort(), ["_id", "completedAt", "expiresAt"]);
	assert.equal(receipt.expiresAt.getTime() - receipt.completedAt.getTime(), MAX_RETENTION_MS);
	assert.equal(receipt._id, receiptIdForEmail("learner@example.test"));
	for (const privateValue of ["learner@example.test", testSecret, "google-user-123", new mongoose.Types.ObjectId().toString()]) {
		assert.equal(JSON.stringify(receipt).includes(privateValue), false);
	}
});

test("normalizes email before HMAC and does not extend an unexpired retry", async () => {
	const first = await createAccountDeletionReceipt("Learner@Example.Test");
	const retried = await createAccountDeletionReceipt(" learner@example.test ");
	assert.equal(retried._id, first._id);
	assert.equal(retried.completedAt.getTime(), first.completedAt.getTime());
	assert.equal(retried.expiresAt.getTime(), first.expiresAt.getTime());
	assert.equal(await AccountDeletionReceipt.countDocuments({}), 1);
});

test("replaces an expired receipt without extending live receipts", async () => {
	const first = await createAccountDeletionReceipt("expired@example.test");
	await AccountDeletionReceipt.updateOne({ _id: first._id }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
	const renewed = await createAccountDeletionReceipt("expired@example.test");
	assert.equal(renewed._id, first._id);
	assert.ok(renewed.completedAt.getTime() > first.completedAt.getTime());
	assert.ok(renewed.expiresAt.getTime() > Date.now());
	assert.equal(renewed.expiresAt.getTime() - renewed.completedAt.getTime(), MAX_RETENTION_MS);
});

test("rejects invalid email inputs", async () => {
	for (const email of [undefined, null, "", "   ", "not-an-email", 12, {}]) {
		await assert.rejects(createAccountDeletionReceipt(email), TypeError);
	}
	assert.equal(await AccountDeletionReceipt.countDocuments({}), 0);
});

test("requires its dedicated secret and never falls back to JWT_SECRET", async () => {
	delete process.env[secretEnv];
	process.env.JWT_SECRET = "a-jwt-secret-that-must-not-be-used-for-receipt-hmacs";
	await assert.rejects(createAccountDeletionReceipt("no-secret@example.test"), /ACCOUNT_DELETION_RECEIPT_HMAC_SECRET/);
	process.env[secretEnv] = "too-short";
	await assert.rejects(createAccountDeletionReceipt("short-secret@example.test"), /at least 32 bytes/);
	process.env[secretEnv] = testSecret;
	assert.equal(await AccountDeletionReceipt.countDocuments({}), 0);
});

test("enforces positive integer retention capped at 30 days", async () => {
	for (const retentionMs of [0, -1, 1.5, Number.MAX_SAFE_INTEGER, MAX_RETENTION_MS + 1]) {
		await assert.rejects(createAccountDeletionReceipt(`invalid-${String(retentionMs)}@example.test`, { retentionMs }), RangeError);
	}
	const receipt = await createAccountDeletionReceipt("maximum-retention@example.test", { retentionMs: MAX_RETENTION_MS });
	assert.equal(receipt.expiresAt.getTime() - receipt.completedAt.getTime(), MAX_RETENTION_MS);
	const short = await createAccountDeletionReceipt("short-retention@example.test", { retentionMs: 1000 });
	assert.equal(short.expiresAt.getTime() - short.completedAt.getTime(), 1000);
});

test("schema rejects raw identifiers and expiry beyond the retention cap", async () => {
	const completedAt = new Date();
	await assert.rejects(AccountDeletionReceipt.create({
		_id: "person@example.test",
		completedAt,
		expiresAt: new Date(completedAt.getTime() + 1000),
	}), error => error.name === "ValidationError");
	await assert.rejects(AccountDeletionReceipt.create({
		_id: `v1:${"a".repeat(64)}`,
		completedAt,
		expiresAt: new Date(completedAt.getTime() + MAX_RETENTION_MS + 1),
		userId: new mongoose.Types.ObjectId(),
	}), error => error.name === "ValidationError");
	assert.equal(await AccountDeletionReceipt.countDocuments({}), 0);
});

test("defines a zero-second expiresAt TTL index", async () => {
	const indexes = await AccountDeletionReceipt.collection.indexes();
	assert.ok(indexes.some(index => index.key?.expiresAt === 1 && index.expireAfterSeconds === 0));
});

test("commits receipt writes made with the caller transaction session", async () => {
	let receipt;
	await mongoose.connection.transaction(async session => {
		receipt = await createAccountDeletionReceipt("committed@example.test", { session });
		assert.equal(session.inTransaction(), true);
	});
	assert.ok(await AccountDeletionReceipt.exists({ _id: receipt._id }));
});

test("rolls back receipt writes with the caller transaction session", async () => {
	let receiptId;
	await assert.rejects(mongoose.connection.transaction(async session => {
		const receipt = await createAccountDeletionReceipt("rolled-back@example.test", { session });
		receiptId = receipt._id;
		assert.ok(await AccountDeletionReceipt.exists({ _id: receiptId }).session(session));
		throw new Error("rollback receipt transaction");
	}), /rollback receipt transaction/);
	assert.equal(await AccountDeletionReceipt.exists({ _id: receiptId }), null);
});

test("retries within the supplied transaction without extending expiry or leaving the session", async () => {
	const client = mongoose.connection.getClient();
	const commands = [];
	const listener = event => {
		const collection = event.commandName === "find" ? event.command?.find
			: event.commandName === "findAndModify" ? event.command?.findAndModify : null;
		if (collection === AccountDeletionReceipt.collection.name) commands.push(event.command);
	};
	client.on("commandStarted", listener);
	let sessionId;
	try {
		await mongoose.connection.transaction(async session => {
			sessionId = session.id;
			const first = await createAccountDeletionReceipt("retry@example.test", { session });
			const retry = await createAccountDeletionReceipt(" retry@example.test ", { session });
			assert.equal(retry._id, first._id);
			assert.equal(retry.expiresAt.getTime(), first.expiresAt.getTime());
			assert.equal(session.inTransaction(), true);
		});
	} finally {
		client.off("commandStarted", listener);
	}
	assert.ok(commands.length >= 2);
	assert.ok(commands.every(command => assert.deepEqual(command.lsid, sessionId) === undefined));
	assert.equal(await AccountDeletionReceipt.countDocuments({ _id: receiptIdForEmail("retry@example.test") }), 1);
});

test("uses the supplied session for duplicate-key retry reads", async t => {
	const priorReceipt = await createAccountDeletionReceipt("duplicate-retry@example.test");
	const originalFindOne = AccountDeletionReceipt.findOne;
	let skipInitialLookup = true;
	const findOneStub = t.mock.method(AccountDeletionReceipt, "findOne", function (...args) {
		const query = originalFindOne.apply(this, args);
		if (skipInitialLookup) {
			skipInitialLookup = false;
			query.lean = () => Promise.resolve(null);
		}
		return query;
	});
	const findOneAndUpdateStub = t.mock.method(AccountDeletionReceipt, "findOneAndUpdate", function (_filter, _update, options) {
		assert.equal(options.session.inTransaction(), true);
		return { lean: async () => {
			const duplicate = new Error("simulated concurrent receipt insert");
			duplicate.code = 11000;
			throw duplicate;
		} };
	});
	const client = mongoose.connection.getClient();
	const commands = [];
	const listener = event => {
		if (event.commandName === "find" && event.command?.find === AccountDeletionReceipt.collection.name) commands.push(event.command);
	};
	client.on("commandStarted", listener);
	try {
		await mongoose.connection.transaction(async session => {
			const result = await createAccountDeletionReceipt("duplicate-retry@example.test", { session });
			assert.equal(result._id, priorReceipt._id);
			assert.ok(commands.some(command => assert.deepEqual(command.lsid, session.id) === undefined));
		});
	} finally {
		client.off("commandStarted", listener);
		findOneStub.mock.restore();
		findOneAndUpdateStub.mock.restore();
	}
});

test("rejects a missing or inactive supplied session", async () => {
	await assert.rejects(createAccountDeletionReceipt("invalid-session@example.test", { session: null }), TypeError);
	const inactive = await mongoose.startSession();
	try { await assert.rejects(createAccountDeletionReceipt("inactive-session@example.test", { session: inactive }), TypeError); }
	finally { await inactive.endSession(); }
});
