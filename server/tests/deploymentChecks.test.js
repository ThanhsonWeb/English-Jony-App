const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
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
		db: {
			databaseName: "fixture",
			command: async input => {
				if (input.ping) { assert.deepEqual(input, { ping: 1 }); calls.push("ping"); return; }
				assert.deepEqual(input, { connectionStatus: 1, showPrivileges: true }); calls.push("permissions");
				return { authInfo: { authenticatedUsers: [{ user: "fixture" }], authenticatedUserPrivileges: [
					{ resource: { db: "fixture", collection: "mobileloginwindows" }, actions: ["find", "insert", "update"] },
				] } };
			},
			listCollections: () => ({ toArray: async () => { calls.push("collections"); return [{ name: "mobileloginwindows", type: "collection" }]; } }),
			runCursorCommand: () => ({ toArray: async () => { calls.push("indexes"); return [
				{ name: "_id_", key: { _id: 1 } }, { key: { expiresAt: 1 }, expireAfterSeconds: 0 },
			]; } }),
		},
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
	assert.deepEqual(calls, fail ? ["connect", "close"] : ["connect", "ping", "collections", "indexes", "permissions", "close"]);
});

for (const mode of ["legacy", "mobile", "not-ready", "missing-check"]) test(`selected-release database gate preserves rollback and fails closed (${mode})`, async t => {
	const release = fs.mkdtempSync(path.join(os.tmpdir(), "studyjony-mobile-gate-"));
	t.after(() => {
		assert.equal(path.dirname(path.resolve(release)), path.resolve(os.tmpdir()));
		assert.ok(path.basename(release).startsWith("studyjony-mobile-gate-"));
		fs.rmSync(release, { recursive: true, force: true });
	});
	if (mode !== "legacy") {
		const model = path.join(release, "server/models/mobileLoginWindowModel.js");
		fs.mkdirSync(path.dirname(model), { recursive: true }); fs.writeFileSync(model, "// fixture marker\n");
	}
	const calls = [];
	const connection = {
		asPromise: async () => calls.push("connect"),
		db: { command: async input => { assert.deepEqual(input, { ping: 1 }); calls.push("ping"); } },
		destroy: async () => calls.push("close"),
	};
	const options = {
		loadConfig: () => ({ DATABASE: "mongodb://fixture.test/not-production" }),
		load: name => {
			if (name === "mongoose") return { createConnection: () => connection };
			assert.equal(name, path.join(release, "server/utils/mobileLoginReadiness.js"));
			if (mode === "missing-check") throw new Error("Missing readiness module");
			return { assertMobileLoginReady: async db => {
				assert.equal(db, connection.db); calls.push("readiness");
				if (mode === "not-ready") throw new Error("Indexes not ready");
			} };
		},
	};
	if (["not-ready", "missing-check"].includes(mode)) await assert.rejects(checkDatabase("unused", release, options));
	else await checkDatabase("unused", release, options);
	assert.deepEqual(calls, ["connect", "ping", ...(["mobile", "not-ready"].includes(mode) ? ["readiness"] : []), "close"]);
});
