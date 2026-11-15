"use strict";

const { spawn } = require("node:child_process");
const LOCK_DIRECTORY = "/var/www/studyjony/shared";
const WORKER_ARG = "--locked-worker";
const START_MESSAGE = "studyjony-account-deletion-scheduler-v1";

function launchSupervisor({ env = process.env, spawnImpl = spawn, execPath = process.execPath, scriptPath = __filename } = {}) {
	if (env.ACCOUNT_DELETION_SCHEDULER_ENABLED !== "true" ||
		env.ACCOUNT_DELETION_AVATAR_CLEANUP_SCHEDULER_ENABLED !== "true") return null;
	// flock holds this shared-directory lock for the lifetime of the exec'd worker.
	return spawnImpl("/usr/bin/flock", [
		"--exclusive", "--nonblock", "--no-fork", LOCK_DIRECTORY, execPath, scriptPath, WORKER_ARG,
	], { env, stdio: ["ignore", "inherit", "inherit", "ipc"] });
}

function runLockedWorker() {
	// A direct invocation has no supervisor IPC and cannot start the scheduler.
	if (!process.send || !process.connected) throw new Error("Scheduler supervisor required");
	let state = null;
	let stopping = false;
	async function shutdown() {
		if (stopping) return;
		stopping = true;
		if (state) {
			state.scheduler.stop();
			try { await state.mongoose.disconnect(); } catch {}
		}
		process.exit(0);
	}
	process.once("disconnect", () => { void shutdown(); });
	for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => { void shutdown(); });
	process.once("message", async message => {
		if (message !== START_MESSAGE ||
			process.env.ACCOUNT_DELETION_SCHEDULER_ENABLED !== "true" ||
			process.env.ACCOUNT_DELETION_AVATAR_CLEANUP_SCHEDULER_ENABLED !== "true" ||
			!process.env.DATABASE) {
			console.error("Account deletion scheduler configuration is invalid.");
			process.exit(1);
		}
		try {
			const mongoose = require("mongoose");
			const { createAccountDeletionScheduler, startConfiguredAccountDeletionScheduler } = require("../services/accountDeletionScheduler");
			const scheduler = createAccountDeletionScheduler();
			state = { mongoose, scheduler };
			await mongoose.connect(process.env.DATABASE);
			if (stopping) return;
			if (!startConfiguredAccountDeletionScheduler({ env: process.env, scheduler })) throw new Error("Scheduler disabled");
		} catch {
			console.error("Account deletion scheduler failed to start.");
			if (state) { try { await state.mongoose.disconnect(); } catch {} }
			process.exit(1);
		}
	});
}

function main(args = process.argv.slice(2)) {
	if (args.length === 1 && args[0] === WORKER_ARG) return runLockedWorker();
	if (args.length) throw new Error("Invalid scheduler arguments");
	require("dotenv").config({ quiet: true });
	const child = launchSupervisor();
	if (!child) return;
	child.once("spawn", () => {
		child.send(START_MESSAGE, error => { if (error) child.kill(); });
	});
	child.once("error", () => {
		console.error("Account deletion scheduler lock could not start.");
		process.exitCode = 1;
	});
	child.once("exit", (code, signal) => { process.exitCode = signal ? 1 : (code ?? 1); });
	for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => { try { child.kill(signal); } catch {} });
}

if (require.main === module) {
	try { main(); }
	catch { console.error("Account deletion scheduler could not start."); process.exitCode = 1; }
}

module.exports = { launchSupervisor, LOCK_DIRECTORY, WORKER_ARG };
