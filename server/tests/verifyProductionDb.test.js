const assert = require("node:assert/strict");
const { test } = require("node:test");
const { inspectIndexes, transactionSupport } = require("../scripts/verify-production-db");

test("transaction support requires sessions and replica-set or mongos topology", () => {
	assert.deepEqual(transactionSupport({ setName: "rs0", logicalSessionTimeoutMinutes: 30, maxWireVersion: 7 }), {
		sessions: true, transactions: true, topology: "replica set (rs0)",
	});
	assert.equal(transactionSupport({ msg: "isdbgrid", logicalSessionTimeoutMinutes: 30, maxWireVersion: 21 }).transactions, true);
	assert.equal(transactionSupport({ logicalSessionTimeoutMinutes: 30, maxWireVersion: 21 }).transactions, false);
	assert.equal(transactionSupport({ setName: "rs0", maxWireVersion: 21 }).transactions, false);
	assert.equal(transactionSupport({ setName: "rs0", logicalSessionTimeoutMinutes: 30, maxWireVersion: 6 }).transactions, false);
});

test("index inspection checks ordered keys and uniqueness", () => {
	const expected = [{ key: { user: 1, awardKey: 1 }, unique: true, purpose: "dedupe" }];
	assert.equal(inspectIndexes([{ name: "right", key: { user: 1, awardKey: 1 }, unique: true }], expected)[0].status, "ok");
	assert.equal(inspectIndexes([{ name: "wrong-option", key: { user: 1, awardKey: 1 } }], expected)[0].status, "incorrect");
	assert.equal(inspectIndexes([{ name: "wrong-order", key: { awardKey: 1, user: 1 }, unique: true }], expected)[0].status, "missing");
});
