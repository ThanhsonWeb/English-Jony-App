"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const { once } = require("node:events");
const { spawn, spawnSync } = require("node:child_process");
const { test } = require("node:test");
const { launchSupervisor, LOCK_DIRECTORY, WORKER_ARG } = require("../scripts/run-account-deletion-scheduler");

const schedulerFile = path.resolve(__dirname, "../scripts/run-account-deletion-scheduler.js");
const configFile = path.resolve(__dirname, "../deploy/account-deletion-scheduler.config.cjs");

function readConfig(env) {
	const module = { exports: {} };
	vm.runInNewContext(fs.readFileSync(configFile, "utf8"), {
		module, require, process: { env, execPath: process.execPath },
	}, { filename: configFile });
	return module.exports;
}

test("production scheduler config is a separate, disabled singleton by default", () => {
	const release = path.resolve(os.tmpdir(), "disposable-release");
	const app = readConfig({ STUDYJONY_RELEASE: release,
		ACCOUNT_DELETION_SCHEDULER_ENABLED: "true",
		ACCOUNT_DELETION_AVATAR_CLEANUP_SCHEDULER_ENABLED: "true",
	}).apps[0];
	assert.equal(app.name, "studyjony-deletion-scheduler");
	assert.equal(app.cwd, path.join(release, "server"));
	assert.equal(app.script, path.join(release, "server/scripts/run-account-deletion-scheduler.js"));
	assert.equal(app.instances, 1);
	assert.equal(app.exec_mode, "fork");
	assert.equal(app.watch, false);
	assert.equal(app.env.NODE_ENV, "production");
	assert.equal(app.env.ACCOUNT_DELETION_SCHEDULER_ENABLED, "false");
	assert.equal(app.env.ACCOUNT_DELETION_AVATAR_CLEANUP_SCHEDULER_ENABLED, "false");
	assert.deepEqual(Array.from(app.stop_exit_codes), [0]);
	const enabled = readConfig({ STUDYJONY_RELEASE: release, STUDYJONY_ENABLE_ACCOUNT_DELETION_SCHEDULER: "true" }).apps[0];
	assert.equal(enabled.env.ACCOUNT_DELETION_SCHEDULER_ENABLED, "true");
	assert.equal(enabled.env.ACCOUNT_DELETION_AVATAR_CLEANUP_SCHEDULER_ENABLED, "true");
	assert.throws(() => readConfig({}), /absolute release directory/);
});

test("every enabled supervisor uses the same non-expiring flock and IPC worker", () => {
	const calls = [];
	const spawnImpl = (...args) => { calls.push(args); return {}; };
	assert.equal(launchSupervisor({ env: {}, spawnImpl }), null);
	assert.equal(launchSupervisor({ env: { ACCOUNT_DELETION_SCHEDULER_ENABLED: "true" }, spawnImpl }), null);
	const env = { ACCOUNT_DELETION_SCHEDULER_ENABLED: "true",
		ACCOUNT_DELETION_AVATAR_CLEANUP_SCHEDULER_ENABLED: "true", DATABASE: "secret-test-canary" };
	launchSupervisor({ env, spawnImpl, execPath: "node-test", scriptPath: "worker-test" });
	launchSupervisor({ env, spawnImpl, execPath: "node-test", scriptPath: "worker-test" });
	assert.equal(calls.length, 2);
	for (const [file, args, options] of calls) {
		assert.equal(file, "/usr/bin/flock");
		assert.deepEqual(args, ["--exclusive", "--nonblock", "--no-fork", LOCK_DIRECTORY,
			"node-test", "worker-test", WORKER_ARG]);
		assert.deepEqual(options.stdio, ["ignore", "inherit", "inherit", "ipc"]);
		assert.equal(args.join(" ").includes("secret-test-canary"), false);
	}
});

test("a direct worker invocation cannot start or connect", () => {
	const env = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot,
		ACCOUNT_DELETION_SCHEDULER_ENABLED: "true",
		ACCOUNT_DELETION_AVATAR_CLEANUP_SCHEDULER_ENABLED: "true",
		DATABASE: "secret-test-canary" };
	const result = spawnSync(process.execPath, [schedulerFile, WORKER_ARG], { env, cwd: path.dirname(schedulerFile), encoding: "utf8", timeout: 5000 });
	assert.equal(result.status, 1);
	assert.equal(result.stdout.includes("secret-test-canary"), false);
	assert.equal(result.stderr.includes("secret-test-canary"), false);
});

test("disabled supervisor exits without connecting or spawning a worker", () => {
	const env = { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot,
		ACCOUNT_DELETION_SCHEDULER_ENABLED: "false",
		ACCOUNT_DELETION_AVATAR_CLEANUP_SCHEDULER_ENABLED: "false",
		DATABASE: "secret-test-canary" };
	const result = spawnSync(process.execPath, [schedulerFile], { env, cwd: path.dirname(schedulerFile), encoding: "utf8", timeout: 5000 });
	assert.equal(result.status, 0);
	assert.equal(result.stdout, "");
	assert.equal(result.stderr.includes("secret-test-canary"), false);
});

test("Linux flock keeps one IPC worker and releases the lock after exit", { timeout: 15000 }, async t => {
	if (process.platform !== "linux") return t.skip("requires Linux flock");
	try { fs.accessSync("/usr/bin/flock", fs.constants.X_OK); } catch { return t.skip("flock is unavailable"); }
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "studyjony-scheduler-lock-"));
	const args = ["--exclusive", "--nonblock", "--no-fork", dir, process.execPath];
	const child = spawn("/usr/bin/flock", [...args, "-e", "process.on('message', m => process.send(m))"],
		{ stdio: ["ignore", "ignore", "ignore", "ipc"] });
	try {
		const acknowledged = new Promise((resolve, reject) => {
			child.once("message", resolve);
			child.once("error", reject);
			child.once("exit", code => reject(new Error("first worker exited: " + code)));
		});
		child.once("spawn", () => child.send("ready"));
		assert.equal(await acknowledged, "ready");
		const duplicate = spawnSync("/usr/bin/flock", [...args, "-e", "process.stdout.write('unsafe')"], { encoding: "utf8", timeout: 5000 });
		assert.equal(duplicate.status, 1);
		assert.equal(duplicate.stdout, "");
		const exited = once(child, "exit");
		child.kill("SIGTERM");
		await exited;
		const retry = spawnSync("/usr/bin/flock", [...args, "-e", "process.stdout.write('ready')"], { encoding: "utf8", timeout: 5000 });
		assert.equal(retry.status, 0);
		assert.equal(retry.stdout, "ready");
	} finally {
		if (child.exitCode === null && child.signalCode === null) child.kill("SIGTERM");
		fs.rmdirSync(dir);
	}
});
