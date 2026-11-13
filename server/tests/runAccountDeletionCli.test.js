const test = require("node:test");
const assert = require("node:assert/strict");
const { runAccountDeletionCli, CONFIRMATION_FLAG } = require("../scripts/run-account-deletion");

const testDatabase = "mongodb://127.0.0.1:27017/account-deletion-cli-test";

test("CLI refuses to connect without the exact explicit confirmation", async () => {
	let connects = 0;
	let runs = 0;
	await assert.rejects(runAccountDeletionCli([], {
		env: { DATABASE: testDatabase },
		connect: async () => { connects += 1; },
		runOnce: async () => { runs += 1; },
	}), /Explicit confirmation required/);
	await assert.rejects(runAccountDeletionCli([CONFIRMATION_FLAG, "--extra"], {
		env: { DATABASE: testDatabase },
		connect: async () => { connects += 1; },
		runOnce: async () => { runs += 1; },
	}), /Explicit confirmation required/);
	assert.equal(connects, 0);
	assert.equal(runs, 0);
});

test("CLI requires database configuration after confirmation and before connecting", async () => {
	let connects = 0;
	await assert.rejects(runAccountDeletionCli([CONFIRMATION_FLAG], {
		env: {},
		connect: async () => { connects += 1; },
	}), /DATABASE is required/);
	assert.equal(connects, 0);
});

test("confirmed CLI connects, invokes the runner once, and disconnects", async () => {
	const calls = [];
	const result = { status: "in_progress", step: "vocabularies" };
	const actual = await runAccountDeletionCli([CONFIRMATION_FLAG], {
		env: { DATABASE: testDatabase },
		connect: async uri => { calls.push(["connect", uri]); },
		runOnce: async () => { calls.push(["runner"]); return result; },
		disconnect: async () => { calls.push(["disconnect"]); },
	});

	assert.deepEqual(actual, result);
	assert.deepEqual(calls, [
		["connect", testDatabase],
		["runner"],
		["disconnect"],
	]);
});

test("CLI disconnects after a runner failure so the operation can be retried", async () => {
	let disconnected = false;
	await assert.rejects(runAccountDeletionCli([CONFIRMATION_FLAG], {
		env: { DATABASE: testDatabase },
		connect: async () => {},
		runOnce: async () => { throw new Error("temporary failure"); },
		disconnect: async () => { disconnected = true; },
	}), /temporary failure/);
	assert.equal(disconnected, true);
});

test("CLI does not disconnect when connection setup fails", async () => {
	let disconnected = false;
	await assert.rejects(runAccountDeletionCli([CONFIRMATION_FLAG], {
		env: { DATABASE: testDatabase },
		connect: async () => { throw new Error("connection failed"); },
		disconnect: async () => { disconnected = true; },
	}), /connection failed/);
	assert.equal(disconnected, false);
});
