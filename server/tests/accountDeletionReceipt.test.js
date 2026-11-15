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
const transactionOptions = {
	readPreference: "primary",
	readConcern: { level: "snapshot" },
	writeConcern: { w: "majority" },
};
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

test("handles a real duplicate-key race only through an active transaction or transaction retry", async t => {
	const email = "real-duplicate@example.test";
	const originalFindOne = AccountDeletionReceipt.findOne;
	let releaseRead;
	let reachedRead;
	const readReached = new Promise(resolve => { reachedRead = resolve; });
	const resumeRead = new Promise(resolve => { releaseRead = resolve; });
	let paused = false;
	const findOneStub = t.mock.method(AccountDeletionReceipt, "findOne", function (...args) {
		const query = originalFindOne.apply(this, args);
		if (!paused && args[0]?._id && !args[0]?.expiresAt) {
			paused = true;
			const originalLean = query.lean.bind(query);
			query.lean = async (...leanArgs) => {
				const result = await originalLean(...leanArgs);
				if (!result) { reachedRead(); await resumeRead; }
				return result;
			};
		}
		return query;
	});
	const failedCommands = [];
	const listener = event => {
		if (event.failure && event.commandName === "findAndModify" && event.command?.findAndModify === AccountDeletionReceipt.collection.name) {
			failedCommands.push(event.failure?.code);
		}
	};
	const client = mongoose.connection.getClient();
	client.on("commandFailed", listener);
	let transactionPromise;
	let callbackRuns = 0;
	const activeAtHelperReturn = [];
	try {
		transactionPromise = mongoose.connection.transaction(async session => {
			callbackRuns += 1;
			const receipt = await createAccountDeletionReceipt(email, { session });
			activeAtHelperReturn.push(session.inTransaction());
			return receipt;
		});
		await readReached;
		const committedByOtherWriter = await createAccountDeletionReceipt(email);
		releaseRead();
		const outcome = await Promise.allSettled([transactionPromise]);
		assert.ok(await AccountDeletionReceipt.exists({ _id: committedByOtherWriter._id }));
		assert.equal(await AccountDeletionReceipt.countDocuments({ _id: committedByOtherWriter._id }), 1);
		if (outcome[0].status === "fulfilled") {
			assert.equal(outcome[0].value._id, committedByOtherWriter._id);
			assert.ok(callbackRuns >= 1);
			assert.ok(activeAtHelperReturn.every(Boolean), "the helper must not return successfully from an aborted session");
		} else {
			assert.ok(callbackRuns >= 1);
		}
	} finally {
		releaseRead();
		client.off("commandFailed", listener);
		findOneStub.mock.restore();
	}
});

test("concurrent transactions never return an uncommitted receipt as successful", async t => {
	const email = "two-transactions@example.test";
	const originalFindOne = AccountDeletionReceipt.findOne;
	let initialReads = 0;
	let releaseReads;
	let reachedReads;
	const bothReadsReached = new Promise(resolve => { reachedReads = resolve; });
	const resumeReads = new Promise(resolve => { releaseReads = resolve; });
	const findOneStub = t.mock.method(AccountDeletionReceipt, "findOne", function (...args) {
		const query = originalFindOne.apply(this, args);
		if (initialReads < 2 && args[0]?._id && !args[0]?.expiresAt) {
			initialReads += 1;
			const originalLean = query.lean.bind(query);
			query.lean = async (...leanArgs) => {
				const result = await originalLean(...leanArgs);
				if (!result && initialReads <= 2) {
					if (initialReads === 2) reachedReads();
					await resumeReads;
				}
				return result;
			};
		}
		return query;
	});
	let outcomes;
	try {
		const transaction = () => mongoose.connection.transaction(async session =>
			createAccountDeletionReceipt(email, { session }), transactionOptions);
		const first = transaction();
		const second = transaction();
		await bothReadsReached;
		releaseReads();
		outcomes = await Promise.allSettled([first, second]);
	} finally {
		releaseReads();
		findOneStub.mock.restore();
	}
	assert.ok(outcomes.some(outcome => outcome.status === "fulfilled"), "at least one competing transaction must commit the receipt");
	const id = receiptIdForEmail(email);
	const stored = await AccountDeletionReceipt.findById(id).lean();
	assert.ok(stored);
	for (const outcome of outcomes) {
		if (outcome.status === "fulfilled") assert.equal(outcome.value._id, stored._id);
	}
	assert.equal(await AccountDeletionReceipt.countDocuments({ _id: id }), 1);
});

test("MongoDB reports and retries a real concurrent transaction write conflict", async t => {
	const receipt = await createAccountDeletionReceipt("real-write-conflict@example.test");
	let firstReads = 0;
	let releaseReads;
	let bothReads;
	const bothReadsReached = new Promise(resolve => { bothReads = resolve; });
	const resumeReads = new Promise(resolve => { releaseReads = resolve; });
	const originalFindById = AccountDeletionReceipt.findById;
	const findStub = t.mock.method(AccountDeletionReceipt, "findById", function (...args) {
		const query = originalFindById.apply(this, args);
		if (firstReads < 2) {
			firstReads += 1;
			const originalLean = query.lean.bind(query);
			query.lean = async (...leanArgs) => {
				const result = await originalLean(...leanArgs);
				if (firstReads === 2) bothReads();
				if (firstReads <= 2) await resumeReads;
				return result;
			};
		}
		return query;
	});
	const conflicts = [];
	const client = mongoose.connection.getClient();
	const listener = event => {
		if (event.failure?.code === 112) conflicts.push(event.failure.code);
	};
	client.on("commandFailed", listener);
	let callbacks = 0;
	try {
		const writer = value => mongoose.connection.transaction(async session => {
			callbacks += 1;
			await AccountDeletionReceipt.findById(receipt._id).session(session).lean();
			await AccountDeletionReceipt.updateOne(
				{ _id: receipt._id },
				{ $set: { completedAt: new Date(value) } },
				{ session },
			);
		}, transactionOptions);
		const first = writer("2026-11-12T00:00:00.000Z");
		const second = writer("2026-11-12T00:00:01.000Z");
		await bothReadsReached;
		releaseReads();
		const results = await Promise.allSettled([first, second]);
		assert.ok(results.every(result => result.status === "fulfilled"), "MongoDB transaction wrapper retries a transient write conflict");
		assert.ok(callbacks >= 3, "one transaction callback reran after the server conflict");
		assert.ok(conflicts.includes(112), `expected actual MongoDB WriteConflict code 112; got ${JSON.stringify(conflicts)}`);
	} finally {
		releaseReads();
		client.off("commandFailed", listener);
		findStub.mock.restore();
	}
});

test("MongoDB rejects a duplicate receipt upsert inside a real transaction", async () => {
	const receipt = await createAccountDeletionReceipt("duplicate-upsert@example.test");
	await assert.rejects(mongoose.connection.transaction(async session => {
		const completedAt = new Date();
		return AccountDeletionReceipt.findOneAndUpdate(
			{ _id: receipt._id, expiresAt: { $lte: completedAt } },
			{ $set: { completedAt, expiresAt: new Date(completedAt.getTime() + 1000) } },
			{ upsert: true, returnDocument: "after", session },
		).lean();
	}, transactionOptions), error => error.code === 11000);
	assert.ok(await AccountDeletionReceipt.exists({ _id: receipt._id }));
});

test("keeps real duplicate-key retry reads inside the live caller transaction", async t => {
	const prior = await createAccountDeletionReceipt("real-aborted-duplicate@example.test");
	const originalFindOne = AccountDeletionReceipt.findOne;
	let findOneCalls = 0;
	const stub = t.mock.method(AccountDeletionReceipt, "findOne", function (...args) {
		findOneCalls += 1;
		const query = originalFindOne.apply(this, args);
		if (findOneCalls === 1) query.lean = () => Promise.resolve(null);
		return query;
	});
	const commands = [];
	const client = mongoose.connection.getClient();
	const startedListener = event => {
		const collection = event.commandName === "find" ? event.command?.find
			: event.commandName === "findAndModify" ? event.command?.findAndModify : null;
		if (collection === AccountDeletionReceipt.collection.name) commands.push(event.command);
	};
	client.on("commandStarted", startedListener);
	const activeAtReturn = [];
	let receipt;
	try {
		receipt = await mongoose.connection.transaction(async session => {
			const result = await createAccountDeletionReceipt("real-aborted-duplicate@example.test", { session });
			activeAtReturn.push(session.inTransaction());
			return result;
		}, transactionOptions);
	} finally {
		client.off("commandStarted", startedListener);
		stub.mock.restore();
	}
	assert.ok(findOneCalls >= 2, "the helper performs retry lookups after the actual E11000");
	assert.ok(activeAtReturn.every(Boolean), "the helper must return only while the caller transaction is active");
	assert.ok(commands.length >= 2);
	assert.ok(commands.every(command => assert.deepEqual(command.lsid, commands[0].lsid) === undefined));
	assert.equal(receipt._id, prior._id);
	assert.ok(await AccountDeletionReceipt.exists({ _id: prior._id }));
});

test("a caller abort after helper stages a receipt rejects the transaction and leaves no receipt", async () => {
	let result;
	await assert.rejects(mongoose.connection.transaction(async session => {
		result = await createAccountDeletionReceipt("caller-abort@example.test", { session });
		assert.ok(result);
		throw new Error("caller abort after receipt helper");
	}, transactionOptions), /caller abort after receipt helper/);
	assert.equal(await AccountDeletionReceipt.exists({ _id: receiptIdForEmail("caller-abort@example.test") }), null);
});
