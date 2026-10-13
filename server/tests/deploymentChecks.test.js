const assert = require("node:assert/strict");
const { test } = require("node:test");
const { assertPrivateConfig, checkDatabase } = require("../scripts/check-deployment");

test("shared production secrets reject public permissions, another owner and symlinks", () => {
	const valid = { isFile: () => true, mode: 0o100600, uid: 1001 };
	assert.doesNotThrow(() => assertPrivateConfig(valid, 1001));
	for (const changed of [{ mode: 0o100644 }, { mode: 0o100640 }, { uid: 0 }, { isFile: () => false }]) {
		assert.throws(() => assertPrivateConfig({ ...valid, ...changed }, 1001));
	}
});

for (const fail of [false, true]) test(`database readiness probe is read-only and closes its connection (failure=${fail})`, async () => {
	const calls = [];
	const connection = {
		asPromise: async () => { calls.push("connect"); if (fail) throw new Error("disposable failure"); },
		db: { command: async input => { assert.deepEqual(input, { ping: 1 }); calls.push("ping"); } },
		destroy: async () => { calls.push("close"); },
	};
	const options = {
		loadConfig: () => ({ DATABASE: "mongodb://disposable.test/not-production" }),
		load: name => {
			assert.equal(name, "mongoose");
			return { createConnection(uri, config) {
				assert.equal(uri, "mongodb://disposable.test/not-production");
				assert.equal(config.autoIndex, false);
				assert.equal(config.autoCreate, false);
				assert.equal(config.serverSelectionTimeoutMS, 5000);
				return connection;
			} };
		},
	};
	if (fail) await assert.rejects(checkDatabase("unused", undefined, options));
	else await checkDatabase("unused", undefined, options);
	assert.deepEqual(calls, fail ? ["connect", "close"] : ["connect", "ping", "close"]);
});
