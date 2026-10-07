// Deployment-only checks. Never load .env or print PM2/environment documents.
const fs = require("node:fs");

function assertNodeVersion(version) {
	const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version || "");
	if (!match || Number(match[1]) !== 22 || Number(match[2]) < 14) {
		throw new Error("Deployment requires the tested Node 22.x line, at least 22.14.0. Use a current patched 22.x release.");
	}
}

function healthURL(value) {
	const match = typeof value === "string" && /^http:\/\/(127\.0\.0\.1|\[::1\]):([1-9][0-9]{0,4})\/health$/.exec(value);
	let url;
	try { url = new URL(value); } catch { throw new Error("Configure a verified loopback /health URL with an explicit port."); }
	if (!match || Number(match[2]) > 65535 || url.pathname !== "/health") {
		throw new Error("Health checks require an exact HTTP loopback /health URL with an explicit port.");
	}
	return value;
}

function checkPm2(value) {
	let processes;
	try { processes = JSON.parse(value); } catch { throw new Error("Invalid PM2 process metadata."); }
	if (!Array.isArray(processes)) throw new Error("Invalid PM2 process metadata.");
	const workers = processes.filter(item => item?.name === "studyjony-api");
	if (!workers.length || workers.some(item => item.pm2_env?.status !== "online" || item.pm2_env?.watch)) {
		throw new Error("Expected online studyjony-api workers with PM2 watch disabled.");
	}
	for (const worker of workers) assertNodeVersion(worker.pm2_env.node_version);
	return workers.length;
}

async function checkHealth(value, { attempts = 10, delayMs = 1000, fetchImpl = fetch } = {}) {
	const url = healthURL(value);
	for (let attempt = 0; attempt < attempts; attempt++) {
		try {
			const response = await fetchImpl(url, { redirect: "error", signal: AbortSignal.timeout(3000), headers: { "Cache-Control": "no-store" } });
			if (response.status === 200 && (await response.json()).status === "ok") return;
		} catch { /* Retry startup, without exposing response bodies or transport errors. */ }
		if (attempt + 1 < attempts) await new Promise(resolve => setTimeout(resolve, delayMs));
	}
	throw new Error("Post-start health verification failed. PM2 state was not saved.");
}

async function main(mode) {
	if (mode === "--runtime") { assertNodeVersion(process.versions.node); return; }
	if (mode === "--health-url") { healthURL(process.env.DEPLOY_HEALTH_URL); return; }
	if (mode === "--pm2") {
		const count = checkPm2(fs.readFileSync(0, "utf8"));
		console.log(`Verified ${count} online worker(s); in-memory rate limits remain per worker.`);
		return;
	}
	if (mode === "--health") { await checkHealth(process.env.DEPLOY_HEALTH_URL); return; }
	if (mode === "--dependencies") {
		for (const name of ["express", "mongoose", "google-auth-library", "nodemailer"]) require(name);
		const bcrypt = require("bcrypt"), input = "local-deployment-bcrypt-check";
		if (!bcrypt.compareSync(input, bcrypt.hashSync(input, 4))) throw new Error("Native bcrypt verification failed.");
		return;
	}
	throw new Error("Unknown deployment verification mode.");
}

if (require.main === module) main(process.argv[2]).catch(() => {
	console.error("Deployment verification failed. Check Node 22.x, PM2 metadata and loopback health configuration.");
	process.exitCode = 1;
});
module.exports = { assertNodeVersion, healthURL, checkPm2, checkHealth };
