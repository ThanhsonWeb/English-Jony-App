// Deployment-only checks. Never load .env or print PM2/environment documents.
const fs = require("node:fs");
const path = require("node:path");
const { createRequire } = require("node:module");
const { sourcePath, hash } = require("./release-artifact");


// Only fixed stages/categories/codes reach deployment logs; never stringify errors.
const CHECK_STAGES = new Map([
	['--runtime', 'check.runtime'], ['--health-url', 'check.health_url'],
	['--pm2', 'check.pm2'], ['--health', 'check.health'], ['--release', 'check.release'],
	['--config', 'check.config'], ['--database', 'check.database'],
	['--private-api', 'check.private_api'], ['--public-api', 'check.public_api'],
	['--dependencies', 'check.dependencies'],
]);
const DIAGNOSTIC_STAGES = new Set([...CHECK_STAGES.values(), 'check.unknown',
	'db.config', 'db.connection_setup', 'db.connect', 'db.ping', 'db.mobile_readiness',
	'db.collection', 'db.indexes', 'db.permissions', 'db.close',
]);
const ERROR_CATEGORIES = new Map([
	['MongoServerSelectionError', 'server_selection'], ['MongooseServerSelectionError', 'server_selection'],
	['MongoNetworkError', 'network'], ['MongoNetworkTimeoutError', 'network_timeout'],
	['MongoServerError', 'database'], ['MongoParseError', 'connection_options'],
	['MongooseError', 'database_client'], ['TypeError', 'invalid_input'],
]);
const DIAGNOSTIC_CODES = new Set([
	13, 18, 26, 27, 50, 59, 73, 85, 86, 91, 8000, 11600, 11602,
	'ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT',
	'EACCES', 'ENOENT', 'ENOTDIR', 'ELOOP', 'MODULE_NOT_FOUND',
	'CERT_HAS_EXPIRED', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
	'ERR_TLS_CERT_ALTNAME_INVALID',
	'MOBILE_COLLECTION_NOT_READY', 'MOBILE_INDEXES_NOT_READY',
	'MOBILE_PERMISSIONS_UNAVAILABLE', 'MOBILE_COUNTER_PERMISSIONS_MISSING',
]);
const NO_DIAGNOSTICS = { sync: (_stage, operation) => operation(), run: (_stage, operation) => operation() };

function diagnosticError(error) {
	const result = { category: 'check_failed' };
	try {
		const name = error?.name, code = error?.code, cause = error?.cause, servers = error?.reason?.servers;
		result.category = ERROR_CATEGORIES.get(name) || 'check_failed';
		if (DIAGNOSTIC_CODES.has(code)) result.code = code;
		const codes = new Set();
		const inspect = value => {
			const code = value?.code, causeCode = value?.cause?.code;
			if (DIAGNOSTIC_CODES.has(code)) codes.add(code);
			if (DIAGNOSTIC_CODES.has(causeCode)) codes.add(causeCode);
		};
		inspect(cause);
		if (servers instanceof Map) {
			let count = 0;
			for (const server of servers.values()) {
				if (count++ === 8) break;
				inspect(server?.error);
			}
		}
		if (codes.size) result.causeCodes = [...codes];
	} catch { /* Untrusted error properties must not affect the original failure. */ }
	return result;
}

function createDeploymentDiagnostics({ output = line => console.error(line), now = () => performance.now() } = {}) {
	const timestamp = () => { try { const value = now(); return Number.isFinite(value) ? value : 0; } catch { return 0; } };
	function emit(stage, status, start, error) {
		try {
			const event = { event: 'deployment_check', stage: DIAGNOSTIC_STAGES.has(stage) ? stage : 'check.unknown',
				status, elapsedMs: Math.max(0, Math.round(timestamp() - start)) };
			if (status === 'failed') Object.assign(event, diagnosticError(error));
			output(JSON.stringify(event));
		} catch { /* Logging must never change check results or cleanup/rollback behavior. */ }
	}
	return {
		sync(stage, operation) {
			const start = timestamp(); emit(stage, 'started', start);
			try { const value = operation(); emit(stage, 'passed', start); return value; }
			catch (error) { emit(stage, 'failed', start, error); throw error; }
		},
		async run(stage, operation) {
			const start = timestamp(); emit(stage, 'started', start);
			try { const value = await operation(); emit(stage, 'passed', start); return value; }
			catch (error) { emit(stage, 'failed', start, error); throw error; }
		},
	};
}

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

function checkPm2(value, release, { uid = process.getuid?.(), owner = pid => fs.statSync(`/proc/${pid}`).uid } = {}) {
	let processes;
	try { processes = JSON.parse(value); } catch { throw new Error("Invalid PM2 process metadata."); }
	if (!Array.isArray(processes)) throw new Error("Invalid PM2 process metadata.");
	const workers = processes.filter(item => item?.name === "studyjony-api");
	if (!workers.length || workers.some(item => item.pm2_env?.status !== "online" || item.pm2_env?.watch)) {
		throw new Error("Expected online studyjony-api workers with PM2 watch disabled.");
	}
	for (const worker of workers) assertNodeVersion(worker.pm2_env.node_version);
	if (release && (workers.length !== 1 || workers.some(worker =>
		worker.pm2_env.exec_mode !== "fork_mode" ||
		path.resolve(worker.pm2_env.pm_cwd || "") !== path.join(release, "server") ||
		path.resolve(worker.pm2_env.pm_exec_path || "") !== path.join(release, "server/server.js")))) {
		throw new Error("PM2 is not running the selected release in the configured single-worker mode.");
	}
	if (release && uid !== undefined && workers.some(worker =>
		!Number.isInteger(worker.pid) || worker.pid < 1 || owner(worker.pid) !== uid)) {
		throw new Error("API process is not owned by the deployment account");
	}
	return workers.length;
}

function checkRelease(base, release) {
	const resolvedBase = fs.realpathSync(base);
	const resolved = fs.realpathSync(release);
	if (path.dirname(resolved) !== path.join(resolvedBase, "releases") ||
		fs.lstatSync(release).isSymbolicLink() || !/^[a-f0-9]{40}\.[A-Za-z0-9]{8}$/.test(path.basename(resolved))) {
		throw new Error("Release is outside the release directory");
	}
	const metadata = JSON.parse(fs.readFileSync(path.join(resolved, ".release.json"), "utf8"));
	if (metadata.version !== 1 || metadata.commit !== path.basename(resolved).split(".")[0] ||
		!/^[a-f0-9]{64}$/.test(metadata.artifactHash) || !Array.isArray(metadata.files) || !metadata.files.length) throw new Error("Invalid release metadata");
	const seen = new Set();
	for (const file of metadata.files) {
		if (!sourcePath(file.path) || seen.has(file.path)) throw new Error("Unsafe release manifest");
		const filename = path.join(resolved, ...file.path.split("/"));
		if (!fs.realpathSync(filename).startsWith(resolved + path.sep) || !fs.lstatSync(filename).isFile() ||
			hash(fs.readFileSync(filename)) !== file.sha256) throw new Error("Release source changed after packaging");
		seen.add(file.path);
	}
	return resolved;
}

function releaseRequire(release) {
	return release ? createRequire(path.join(release, "server/package.json")) : require;
}

function assertPrivateConfig(stat, uid) {
	if (!stat.isFile() || (stat.mode & 0o077) !== 0 || (uid !== undefined && stat.uid !== uid)) {
		throw new Error("Shared environment must be a private file owned by the deployment account");
	}
}

function readConfig(base, release) {
	const filename = path.join(base, "shared/backend.env");
	assertPrivateConfig(fs.lstatSync(filename), process.getuid?.());
	const load = releaseRequire(release);
	const config = load("dotenv").parse(fs.readFileSync(filename));
	for (const key of ["DATABASE", "JWT_SECRET", "JWT_EXPIRES_IN", "FRONTEND_URL"]) {
		if (!config[key]) throw new Error("Shared production configuration is incomplete");
	}
	if (config.NODE_ENV && config.NODE_ENV !== "production") throw new Error("Shared environment must be production");
	const frontend = new URL(config.FRONTEND_URL);
	if (!/^https:\/\/[^/?#]+\/*$/.test(config.FRONTEND_URL) || frontend.username || frontend.password) throw new Error("A canonical HTTPS frontend origin is required");
	if (process.env.DEPLOY_HEALTH_URL && String(config.PORT || 5000) !== new URL(healthURL(process.env.DEPLOY_HEALTH_URL)).port) {
		throw new Error("Application port does not match the verified health URL");
	}
	const avatar = release ? load(path.join(release, "server/services/avatarUpload.js")) : require("../services/avatarUpload");
	avatar.assertAvatarStorageConfigured({ ...config, NODE_ENV: "production" });
	return config;
}

async function checkDatabase(base, release, { loadConfig = readConfig, load = releaseRequire(release), diagnostics = NO_DIAGNOSTICS } = {}) {
	const config = diagnostics.sync("db.config", () => loadConfig(base, release));
	const connection = diagnostics.sync("db.connection_setup", () => load("mongoose").createConnection(config.DATABASE, {
		autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 5000,
	}));
	try {
		await diagnostics.run("db.connect", () => connection.asPromise());
		await diagnostics.run("db.ping", () => connection.db.command({ ping: 1 }));
		// The incoming guard also verifies rollback releases. Only mobile-enabled
		// releases require this collection; an older website release stays usable.
		const mobileFiles = ["models/mobileLoginWindowModel.js", "middleware/mobileLoginRateLimit.js", "utils/mobileLoginReadiness.js"];
		if (!release || mobileFiles.some(file => fs.existsSync(path.join(release, "server", file)))) {
			await diagnostics.run("db.mobile_readiness", async () => {
				const readiness = release ? load(path.join(release, "server/utils/mobileLoginReadiness.js")) : require("../utils/mobileLoginReadiness");
				await readiness.assertMobileLoginReady(connection.db, { runStage: diagnostics.run });
			});
		}
	} finally { await diagnostics.run("db.close", () => connection.destroy()); }
}

async function checkPrivateApi(value, fetchImpl = fetch) {
	const url = new URL("/api/v1/users/me", healthURL(value));
	await checkPrivateResponse(url, fetchImpl);
}

async function checkPrivateResponse(url, fetchImpl = fetch) {
	const response = await fetchImpl(url, { redirect: "error", signal: AbortSignal.timeout(3000) });
	if (response.status !== 401 || response.headers.get("cache-control") !== "private, no-store") {
		throw new Error("Private unauthenticated response policy failed");
	}
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

async function main(mode, args = [], diagnostics = NO_DIAGNOSTICS) {
	if (mode === "--runtime") { assertNodeVersion(process.versions.node); return; }
	if (mode === "--health-url") { healthURL(process.env.DEPLOY_HEALTH_URL); return; }
	if (mode === "--pm2") {
		const count = checkPm2(fs.readFileSync(0, "utf8"), args[0]);
		console.log(`Verified ${count} online worker(s); in-memory rate limits remain per worker.`);
		return;
	}
	if (mode === "--health") { await checkHealth(process.env.DEPLOY_HEALTH_URL); return; }
	if (mode === "--release") { checkRelease(args[0], args[1]); return; }
	if (mode === "--config") { readConfig(args[0], args[1]); return; }
	if (mode === "--database") { await checkDatabase(args[0], args[1], { diagnostics }); return; }
	if (mode === "--private-api") { await checkPrivateApi(process.env.DEPLOY_HEALTH_URL); return; }
	if (mode === "--public-api") {
		const config = readConfig(args[0], args[1]);
		await checkPrivateResponse(new URL("/api/v1/users/me", config.FRONTEND_URL)); return;
	}
	if (mode === "--dependencies") {
		const load = releaseRequire(args[0]);
		for (const name of ["express", "mongoose", "google-auth-library", "nodemailer"]) load(name);
		const bcrypt = load("bcrypt"), input = "local-deployment-bcrypt-check";
		if (!bcrypt.compareSync(input, bcrypt.hashSync(input, 4))) throw new Error("Native bcrypt verification failed.");
		return;
	}
	throw new Error("Unknown deployment verification mode.");
}

if (require.main === module) {
	const diagnostics = createDeploymentDiagnostics();
	diagnostics.run(CHECK_STAGES.get(process.argv[2]) || "check.unknown", () => main(process.argv[2], process.argv.slice(3), diagnostics)).catch(() => {
		console.error("Deployment verification failed. Check runtime, release, private configuration, database, PM2 and health locally; do not share secrets.");
		process.exitCode = 1;
	});
}
module.exports = { createDeploymentDiagnostics, assertNodeVersion, healthURL, checkPm2, checkHealth, checkRelease, assertPrivateConfig, readConfig, checkDatabase, checkPrivateApi };
