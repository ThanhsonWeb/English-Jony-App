const assert = require("node:assert/strict");
const { after, before, beforeEach, test } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
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
	db = await MongoMemoryServer.create({ binary: { version: "7.0.14" } });
	await mongoose.connect(db.getUri(), { dbName: "account_deletion_receipts" });
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

test("defines a zero-second expiresAt TTL index", async () => {
	const indexes = await AccountDeletionReceipt.collection.indexes();
	assert.ok(indexes.some(index => index.key?.expiresAt === 1 && index.expireAfterSeconds === 0));
});
