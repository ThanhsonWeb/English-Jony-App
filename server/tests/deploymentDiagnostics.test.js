const assert = require("node:assert/strict");
const { test } = require("node:test");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { createDeploymentDiagnostics, checkDatabase } = require("../scripts/check-deployment");

// Synthetic private values only; no environment files, external services or real accounts.
const PRIVATE = "SYNTHETIC_PRIVATE_DATA_MUST_NOT_APPEAR";
const privateUri = ["mongodb+srv:", "", `fixture-user:${PRIVATE}@fixture-host.invalid/private-database`].join("/");
const collection = "mobileloginwindows";
const database = "diagnostics_fixture";
function capture(options = {}) {
	const lines = [];
	return { lines, diagnostics: createDeploymentDiagnostics({ output: line => lines.push(line), ...options }),
		events: () => lines.map(line => JSON.parse(line)) };
}
function privateError(name = "MongoServerError", code = 13) {
	const error = new Error(privateUri);
	error.name = name; error.code = code; error.stack = PRIVATE; error.path = PRIVATE;
	return error;
}
function fixture(failure, closeFailure = false) {
	const report = capture(), calls = [];
	const original = privateError(failure === "connect" ? "MongooseServerSelectionError" : "MongoServerError", failure === "connect" ? "ETIMEDOUT" : 13);
	const closeError = privateError("MongoNetworkError", "ECONNRESET");
	function step(name) { calls.push(name); if (name === failure) throw original; }
	const db = {
		databaseName: database,
		command: async input => {
			if (input.ping) { assert.deepEqual(input, { ping: 1 }); step("ping"); return; }
			assert.deepEqual(input, { connectionStatus: 1, showPrivileges: true }); step("permissions");
			return { authInfo: {
				authenticatedUsers: failure === "unauthenticated" ? [] : [{ user: PRIVATE }],
				authenticatedUserPrivileges: failure === "privileges-unavailable" ? undefined : [{
					resource: { db: database, collection }, actions: failure === "grants" ? ["find"] : ["find", "insert", "update"],
				}],
			} };
		},
		listCollections: (filter, options) => {
			assert.deepEqual(filter, { name: collection }); assert.deepEqual(options, { nameOnly: false });
			return { toArray: async () => { step("collection"); return failure === "missing-collection" ? [] : [{ name: collection, type: "collection", privateValue: PRIVATE }]; } };
		},
		runCursorCommand: input => {
			assert.deepEqual(input, { listIndexes: collection, includeBuildUUIDs: true, cursor: {} });
			return { toArray: async () => { step("indexes"); return [
				{ name: "_id_", key: { _id: 1 } },
				{ name: "expiresAt_1", key: { expiresAt: 1 }, expireAfterSeconds: failure === "bad-ttl" ? 900 : 0 },
			]; } };
		},
	};
	const options = {
		diagnostics: report.diagnostics,
		loadConfig: () => { step("config"); return { DATABASE: privateUri }; },
		load: name => {
			assert.equal(name, "mongoose"); step("load");
			return { createConnection(uri, options) {
				assert.equal(uri, privateUri);
				assert.deepEqual(options, { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 5000 });
				step("setup");
				return { db, asPromise: async () => step("connect"), destroy: async () => { calls.push("close"); if (failure === "close" || closeFailure) throw closeError; } };
			} };
		},
	};
	return { ...report, calls, original, closeError, run: () => checkDatabase("unused", undefined, options) };
}
const failures = new Map([
	["config", "db.config"], ["load", "db.connection_setup"], ["setup", "db.connection_setup"],
	["connect", "db.connect"], ["ping", "db.ping"], ["collection", "db.collection"],
	["indexes", "db.indexes"], ["permissions", "db.permissions"],
	["missing-collection", "db.collection"], ["bad-ttl", "db.indexes"],
	["unauthenticated", "db.permissions"], ["privileges-unavailable", "db.permissions"],
	["grants", "db.permissions"], ["close", "db.close"],
]);
for (const [failure, stage] of failures) test(`database fault reports ${stage} and remains fail-closed: ${failure}`, async () => {
	const item = fixture(failure);
	await assert.rejects(item.run());
	const failed = item.events().filter(event => event.status === "failed");
	assert.equal(failed[0].stage, stage);
	assert.ok(!item.lines.join("\n").includes(PRIVATE));
	assert.ok(!item.lines.join("\n").includes("fixture-host.invalid"));
	assert.ok(!item.lines.join("\n").includes("fixture-user"));
	assert.ok(!item.lines.join("\n").includes("private-database"));
	const created = !["config", "load", "setup"].includes(failure);
	assert.equal(item.calls.filter(call => call === "close").length, created ? 1 : 0);
	if (["config", "load", "setup", "connect", "ping"].includes(failure)) assert.ok(!item.calls.includes("collection"));
	if (["missing-collection", "bad-ttl"].includes(failure)) assert.ok(!item.calls.includes("permissions"));
	if (failure === "connect") assert.equal(failed[0].category, "server_selection");
	if (failure === "missing-collection") assert.equal(failed[0].code, "MOBILE_COLLECTION_NOT_READY");
	if (failure === "bad-ttl") assert.equal(failed[0].code, "MOBILE_INDEXES_NOT_READY");
	if (failure === "unauthenticated" || failure === "privileges-unavailable") assert.equal(failed[0].code, "MOBILE_PERMISSIONS_UNAVAILABLE");
	if (failure === "grants") assert.equal(failed[0].code, "MOBILE_COUNTER_PERMISSIONS_MISSING");
});

test("successful diagnostics preserve the read-only operation order and connection options", async () => {
	const item = fixture(); await item.run();
	assert.deepEqual(item.calls, ["config", "load", "setup", "connect", "ping", "collection", "indexes", "permissions", "close"]);
	assert.ok(!item.events().some(event => event.status === "failed"));
	assert.ok(item.events().every(event => Number.isInteger(event.elapsedMs) && event.elapsedMs >= 0));
	assert.ok(!item.lines.join("\n").includes(PRIVATE));
});

test("cleanup retains the existing error precedence when connection and close both fail", async () => {
	const item = fixture("connect", true);
	await assert.rejects(item.run(), error => error === item.closeError);
	assert.deepEqual(item.events().filter(event => event.status === "failed").map(event => event.stage), ["db.connect", "db.close"]);
	assert.equal(item.calls.filter(call => call === "close").length, 1);
});

test("logging output/clock failures do not change successful checks or replace original errors", async () => {
	for (const options of [
		{ output: () => { throw new Error(PRIVATE); } },
		{ now: () => { throw new Error(PRIVATE); } },
		{ now: () => Infinity },
	]) {
		const { diagnostics } = capture(options), original = privateError();
		assert.equal(diagnostics.sync("db.config", () => 17), 17);
		assert.equal(await diagnostics.run("db.connect", async () => 29), 29);
		assert.throws(() => diagnostics.sync("db.config", () => { throw original; }), error => error === original);
		await assert.rejects(diagnostics.run("db.connect", async () => { throw original; }), error => error === original);
	}
});

test("only whitelisted error fields and fixed stages are emitted, including nested network failures", async () => {
	const item = capture(), error = privateError("MongoServerSelectionError", PRIVATE);
	error.cause = { code: "ENOTFOUND", message: privateUri };
	error.reason = { servers: new Map([[PRIVATE, { error: { code: "ETIMEDOUT", message: privateUri, cause: { code: PRIVATE } } }]]) };
	error.self = error;
	await assert.rejects(item.diagnostics.run(PRIVATE, async () => { throw error; }));
	const failed = item.events().find(event => event.status === "failed");
	assert.equal(failed.stage, "check.unknown"); assert.equal(failed.category, "server_selection");
	assert.equal(failed.code, undefined); assert.deepEqual(failed.causeCodes, ["ENOTFOUND", "ETIMEDOUT"]);
	assert.ok(!item.lines.join("\n").includes(PRIVATE));
	assert.deepEqual(Object.keys(failed).sort(), ["event", "stage", "status", "elapsedMs", "category", "causeCodes"].sort());
});

test("changing or throwing error getters cannot bypass redaction or mask the original failure", async () => {
	const item = capture(); let reads = 0, causeReads = 0;
	const error = new Error(PRIVATE);
	Object.defineProperty(error, "code", { get: () => ++reads === 1 ? 13 : PRIVATE });
	error.cause = {};
	Object.defineProperty(error.cause, "code", { get: () => ++causeReads === 1 ? "ETIMEDOUT" : PRIVATE });
	await assert.rejects(item.diagnostics.run("db.ping", async () => { throw error; }), value => value === error);
	assert.equal(reads, 1); assert.equal(causeReads, 1); assert.ok(!item.lines.join("\n").includes(PRIVATE));
	const hostile = Object.defineProperty({}, "name", { get() { throw new Error(PRIVATE); } });
	await assert.rejects(item.diagnostics.run("db.ping", async () => { throw hostile; }), value => value === hostile);
	assert.ok(!item.lines.join("\n").includes(PRIVATE));
});

const script = path.join(__dirname, "../scripts/check-deployment.js");
for (const mode of ["unknown", "health-url", "pm2"]) test(`CLI hides private input and preserves exit 1: ${mode}`, () => {
	const args = mode === "unknown" ? [PRIVATE] : ["--" + mode];
	const result = spawnSync(process.execPath, [script, ...args], {
		env: { ...process.env, DEPLOY_HEALTH_URL: privateUri },
		input: JSON.stringify([{ name: "studyjony-api", pm2_env: { status: PRIVATE, secret: PRIVATE } }]),
		encoding: "utf8", timeout: 10000,
	});
	assert.equal(result.status, 1); assert.equal(result.stdout, "");
	assert.ok(!result.stderr.includes(PRIVATE)); assert.ok(!result.stderr.includes("fixture-host.invalid"));
	const events = result.stderr.split("\n").filter(line => line.startsWith("{")).map(line => JSON.parse(line));
	assert.equal(events.at(-1).status, "failed");
	assert.equal(events.at(-1).stage, mode === "unknown" ? "check.unknown" : "check." + mode.replace("-", "_"));
});

test("shell stage logging failure does not abort a deployment check", () => {
	const fs = require("node:fs");
	const source = fs.readFileSync(path.join(__dirname, "../scripts/deploy-backend.sh"), "utf8");
	const helper = source.match(/^mark_stage\(\) \{[\s\S]*?^\}/m)?.[0];
	assert.ok(helper);
	const bash = process.platform === "win32" ? "C:/Program Files/Git/bin/bash.exe" : "/bin/bash";
	const result = spawnSync(bash, ["--noprofile", "--norc", "-c", `set -Eeuo pipefail\noperation=preparation\nstage=arguments\nprintf() { return 7; }\n${helper}\nmark_stage database\n[[ "$stage" == database ]]`], { encoding: "utf8", timeout: 10000 });
	assert.ifError(result.error); assert.equal(result.status, 0);
});
