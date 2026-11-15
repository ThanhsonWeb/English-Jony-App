// Separate, explicitly enabled scheduler. Deployment starts only studyjony-api.
const path = require("node:path");
const release = process.env.STUDYJONY_RELEASE;
if (!release || !path.isAbsolute(release)) throw new Error("An absolute release directory is required");
const enabled = process.env.STUDYJONY_ENABLE_ACCOUNT_DELETION_SCHEDULER === "true";
module.exports = {
	apps: [{
		name: "studyjony-deletion-scheduler",
		cwd: path.join(release, "server"),
		script: path.join(release, "server/scripts/run-account-deletion-scheduler.js"),
		interpreter: process.execPath,
		exec_mode: "fork",
		instances: 1,
		watch: false,
		autorestart: true,
		stop_exit_codes: [0],
		restart_delay: 10000,
		kill_timeout: 30000,
		env: {
			NODE_ENV: "production",
			ACCOUNT_DELETION_SCHEDULER_ENABLED: enabled ? "true" : "false",
			ACCOUNT_DELETION_AVATAR_CLEANUP_SCHEDULER_ENABLED: enabled ? "true" : "false",
		},
	}],
};
