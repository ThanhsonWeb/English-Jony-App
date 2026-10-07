const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { assertNodeVersion, healthURL, checkPm2, checkHealth } = require("../scripts/check-deployment");
const root = path.resolve(__dirname, "../..");

test("deployment accepts tested Node 22.x and rejects incompatible or unknown runtimes", () => {
	for (const value of ["22.14.0", "22.99.1"]) assert.doesNotThrow(() => assertNodeVersion(value));
	for (const value of ["20.19.0", "22.13.9", "23.0.0", "24.0.0", "22.x", "", undefined]) assert.throws(() => assertNodeVersion(value));
});

test("health configuration allows only explicit loopback /health endpoints, never arbitrary hosts or shell input", () => {
	for (const value of ["http://127.0.0.1:5000/health", "http://[::1]:5432/health", "http://127.0.0.1:80/health"]) assert.equal(healthURL(value), value);
	for (const value of [undefined, "http://localhost:5000/health", "https://127.0.0.1:5000/health", "http://127.0.0.1/health", "http://127.0.0.1:5000/health?token=secret", "http://127.0.0.1:5000/health#x", "http://user:secret@127.0.0.1:5000/health", "http://198.51.100.1:5000/health", "http://127.0.0.1:65536/health", "http://127.0.0.1:5000/health'; echo secret"]) assert.throws(() => healthURL(value));
});

const worker = (extra = {}) => ({ name: "studyjony-api", pm2_env: { status: "online", node_version: "22.14.0", watch: false, ...extra } });
test("PM2 verification checks every target worker without returning its secrets", () => {
	assert.equal(checkPm2(JSON.stringify([worker(), worker(), { name: "other" }])), 2);
	for (const value of ["secret-not-json", "{}", "[]", JSON.stringify([worker({ status: "errored" })]), JSON.stringify([worker({ node_version: "20.0.0" })]), JSON.stringify([worker({ watch: true })])]) assert.throws(() => checkPm2(value));
});

test("post-start health rejects redirects, bad status/body and failures, and retries startup", async () => {
	let requests = 0;
	await checkHealth("http://127.0.0.1:5000/health", { attempts: 3, delayMs: 0, fetchImpl: async (url, options) => {
		assert.equal(options.redirect, "error"); assert.equal(options.headers["Cache-Control"], "no-store");
		requests++; return { status: requests < 3 ? 503 : 200, json: async () => ({ status: "ok" }) };
	} }); assert.equal(requests, 3);
	for (const response of [{ status: 302 }, { status: 200, json: async () => ({ status: "wrong" }) }, { status: 200, json: async () => { throw new Error("private response"); } }]) {
		await assert.rejects(checkHealth("http://127.0.0.1:5000/health", { attempts: 1, fetchImpl: async () => response }), /Post-start health verification failed/);
	}
});

test("workflow requires independently pinned SSH identity and does not interpolate secrets into shell source", () => {
	const source = fs.readFileSync(path.join(root, ".github/workflows/deploy-backend.yml"), "utf8");
	assert.doesNotMatch(source, /ssh-keyscan|npm install/);
	for (const value of ["StrictHostKeyChecking=yes", "UpdateHostKeys=no", "VPS_KNOWN_HOSTS", "VPS_HOST_KEY_SHA256", "persist-credentials: false", "cancel-in-progress: false"]) assert.ok(source.includes(value), value);
	for (const [, block] of source.matchAll(/run: \|\n([\s\S]*?)(?=\n      - name:|$)/g)) assert.doesNotMatch(block, /\$\{\{\s*secrets\./);
});

const bash = process.platform === "win32" ? "C:/Program Files/Git/bin/bash.exe" : "/bin/bash";
const sha = "a".repeat(40);
// Fault injection runs the real shell script with disposable command stubs.
// It never contacts Git, npm, SSH, PM2, providers or a production health endpoint.
function shellFixture(t, fail = "") {
	const folder = fs.mkdtempSync(path.join(os.tmpdir(), "studyjony-deploy-test-"));
	t.after(() => {
		assert.equal(path.dirname(path.resolve(folder)), path.resolve(os.tmpdir()));
		assert.ok(path.basename(folder).startsWith("studyjony-deploy-test-"));
		fs.rmSync(folder, { recursive: true, force: true });
	});
	const bin = path.join(folder, "bin"), server = path.join(folder, "server"); fs.mkdirSync(bin); fs.mkdirSync(server);
	for (const dir of ["controllers", "middleware", "models", "routes", "services", "utils", "scripts"]) fs.mkdirSync(path.join(server, dir));
	fs.copyFileSync(path.join(root, "server/scripts/check-deployment.js"), path.join(server, "scripts/check-deployment.js"));
	for (const file of ["app.js", "server.js"]) fs.writeFileSync(path.join(server, file), "// local fixture\n");
	const log = path.join(folder, "commands.log");
	function command(name, body) { fs.writeFileSync(path.join(bin, name), "#!/usr/bin/env bash\nset -euo pipefail\nprintf '%s\\n' \"" + name + " $*\" >> \"$FIXTURE_LOG\"\n" + body, { mode: 0o755 }); }
	command("git", `case "$1" in
 fetch|merge) [[ "$FAIL_STAGE" != "git-$1" ]] ;;
 diff) [[ "$FAIL_STAGE" != dirty ]] ;;
 rev-parse) if [[ "$FAIL_STAGE" == revision ]]; then printf 'wrong'; else printf '%s' '${sha}'; fi ;;
 ls-files) if [[ "$FAIL_STAGE" == tracked ]]; then printf 'server/node_modules/example'; fi ;;
esac\n`);
	command("npm", 'case "$1" in ci|ls) [[ "$FAIL_STAGE" != "npm-$1" ]] ;; run) [[ "$FAIL_STAGE" != catalogue ]] ;; esac\n');
	command("pm2", `case "$1" in
 jlist) [[ "$FAIL_STAGE" != pm2-list ]];
 if [[ "$FAIL_STAGE" == watch ]]; then printf '%s' '${JSON.stringify([worker({ watch: true })])}';
 elif [[ "$FAIL_STAGE" == post-pm2 ]] && grep -q 'pm2 restart' "$FIXTURE_LOG"; then printf '%s' '${JSON.stringify([worker({ status: "errored" })])}';
 else printf '%s' '${JSON.stringify([worker()])}'; fi ;;
 restart) [[ "$FAIL_STAGE" != restart ]] ;;
 save) [[ "$FAIL_STAGE" != save ]] ;;
esac\n`);
	const realNode = process.execPath.replaceAll("\\", "/");
	command("node", `case "$*" in
 *--dependencies*) [[ "$FAIL_STAGE" != native ]]; exit $? ;;
 *--health) [[ "$FAIL_STAGE" != health ]]; exit $? ;;
 *--check*) [[ "$FAIL_STAGE" != syntax ]]; exit $? ;;
esac
exec "${realNode}" "$@"\n`);
	const result = spawnSync(bash, ["--noprofile", "--norc", "-c", 'if command -v cygpath > /dev/null; then fixture_bin=$(cygpath -u "$FIXTURE_BIN"); else fixture_bin=$FIXTURE_BIN; fi; export PATH="$fixture_bin:$PATH"; exec bash "$FIXTURE_SCRIPT" "$FIXTURE_SHA" "http://127.0.0.1:5000/health"'], {
		env: { ...process.env, FIXTURE_BIN: bin.replaceAll("\\", "/"), FIXTURE_SCRIPT: path.join(root, "server/scripts/deploy-backend.sh").replaceAll("\\", "/"), FIXTURE_SHA: sha, DEPLOY_REPO_DIR: folder.replaceAll("\\", "/"), FIXTURE_LOG: log.replaceAll("\\", "/"), FAIL_STAGE: fail }, encoding: "utf8", timeout: 30000,
	});
	assert.ifError(result.error);
	return { status: result.status, log: fs.existsSync(log) ? fs.readFileSync(log, "utf8") : "", diagnostics: result.stderr };
}

const failureCommands = { dirty: "git diff", "git-fetch": "git fetch", "git-merge": "git merge", revision: "git rev-parse", tracked: "git ls-files", "pm2-list": "pm2 jlist", watch: "pm2 jlist", "npm-ci": "npm ci", "npm-ls": "npm ls", native: "--dependencies", syntax: "--check", catalogue: "npm run" };
for (const fail of Object.keys(failureCommands)) test(`${fail}: failed deployment never reaches PM2 restart/save`, { skip: !fs.existsSync(bash) }, t => {
	const result = shellFixture(t, fail); assert.notEqual(result.status, 0, result.diagnostics);
	assert.ok(result.log.includes(failureCommands[fail]), result.diagnostics);
	assert.doesNotMatch(result.log, /pm2 restart|pm2 save/);
});

for (const fail of ["restart", "post-pm2", "health"]) test(`${fail}: post-start failure does not save PM2 state`, { skip: !fs.existsSync(bash) }, t => {
	const result = shellFixture(t, fail); assert.notEqual(result.status, 0, result.diagnostics);
	assert.match(result.log, /pm2 restart/); assert.doesNotMatch(result.log, /pm2 save/);
});

test("successful deployment installs from the lockfile, verifies, restarts and then saves", { skip: !fs.existsSync(bash) }, t => {
	const result = shellFixture(t); assert.equal(result.status, 0, result.diagnostics);
	assert.match(result.log, /npm ci --omit=dev --engine-strict --no-audit --no-fund/);
	assert.ok(result.log.indexOf("npm run dialogue:catalogue:check") < result.log.indexOf("pm2 restart"));
	assert.ok(result.log.indexOf("--health\n") < result.log.indexOf("pm2 save"));
});
