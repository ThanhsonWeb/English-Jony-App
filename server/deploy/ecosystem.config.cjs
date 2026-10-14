// Secrets live in shared/backend.env, linked to each release's server/.env.
const path = require("node:path");
const release = process.env.STUDYJONY_RELEASE;
if (!release || !path.isAbsolute(release)) throw new Error("An absolute release directory is required");
module.exports = {
	apps: [{
		name: "studyjony-api",
		cwd: path.join(release, "server"),
		script: path.join(release, "server/server.js"),
		interpreter: process.execPath,
		exec_mode: "fork",
		instances: 1,
		watch: false,
		autorestart: true,
		restart_delay: 1000,
		kill_timeout: 5000,
		env: { NODE_ENV: "production" },
	}],
};
