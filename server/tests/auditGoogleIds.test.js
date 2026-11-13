const assert = require("node:assert/strict");
const { after, before, beforeEach, test } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const User = require("../models/userModel");
const { auditGoogleIds } = require("../scripts/audit-google-ids");

let db;

before(async () => {
	db = await MongoMemoryReplSet.create({ binary: { version: "7.0.14" }, replSet: { count: 1, storageEngine: "wiredTiger" } });
	await mongoose.connect(db.getUri(), { dbName: "google_id_audit_test", autoIndex: false, autoCreate: false });
}, { timeout: 180000 });
after(async () => {
	await mongoose.disconnect();
	await db?.stop();
});
beforeEach(async () => { await User.collection.deleteMany({}); });

test("reports duplicate and malformed Google ID aggregates without revealing record data", async () => {
	const duplicateId = "private-google-subject-duplicate";
	const whitespaceOnlyGoogleId = "  \t";
	await User.collection.insertMany([
		{ email: "safe-audit-one@example.test", googleId: duplicateId },
		{ email: "safe-audit-two@example.test", googleId: duplicateId },
		{ email: "safe-audit-valid@example.test", googleId: "valid-google-subject" },
		{ email: "safe-audit-missing@example.test" },
		{ email: "safe-audit-null@example.test", googleId: null },
		{ email: "safe-audit-number@example.test", googleId: 42 },
		{ email: "safe-audit-empty@example.test", googleId: "" },
		{ email: "safe-audit-whitespace@example.test", googleId: whitespaceOnlyGoogleId },
		{ email: "safe-audit-whitespace-duplicate@example.test", googleId: whitespaceOnlyGoogleId },
		{ email: "safe-audit-padded@example.test", googleId: " padded-subject " },
		{ email: "safe-audit-long@example.test", googleId: "x".repeat(256) },
	]);
	const before = await User.collection.find({}).sort({ email: 1 }).toArray();
	const indexesBefore = await User.collection.indexes();
	const output = [];
	const result = await auditGoogleIds({ collection: User.collection, output: { log: value => output.push(value) } });
	const after = await User.collection.find({}).sort({ email: 1 }).toArray();
	const indexesAfter = await User.collection.indexes();

	assert.deepEqual(result, {
		totalUsers: 11,
		googleIds: {
			valid: 3,
			missing: 2,
			malformed: {
				nonString: 1,
				empty: 1,
				whitespaceOnly: 2,
				surroundingWhitespace: 1,
				tooLong: 1,
			},
		},
		duplicates: { groups: 2, users: 4, extraRecords: 2 },
	});
	assert.equal(output.length, 1);
	assert.deepEqual(JSON.parse(output[0]), result);
	for (const privateValue of ["safe-audit-one@example.test", "safe-audit-two@example.test", duplicateId, whitespaceOnlyGoogleId, "valid-google-subject", "padded-subject"]) {
		assert.equal(output[0].includes(privateValue), false);
	}
	assert.deepEqual(after, before, "the audit must not modify User records");
	assert.deepEqual(indexesAfter, indexesBefore, "the audit must not add or modify indexes");
});

test("returns zero counts for an empty User collection", async () => {
	const output = [];
	const result = await auditGoogleIds({ collection: User.collection, output: { log: value => output.push(value) } });
	assert.deepEqual(result, {
		totalUsers: 0,
		googleIds: { valid: 0, missing: 0, malformed: { nonString: 0, empty: 0, whitespaceOnly: 0, surroundingWhitespace: 0, tooLong: 0 } },
		duplicates: { groups: 0, users: 0, extraRecords: 0 },
	});
	assert.equal(output.length, 1);
});
