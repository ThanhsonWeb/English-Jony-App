const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync, execFileSync } = require("node:child_process");
const { assertNodeVersion, healthURL, checkPm2, checkHealth, checkRelease, checkPrivateApi } = require("../scripts/check-deployment");
const { build, extract, hash, validateBundle, sourcePath } = require("../scripts/release-artifact");
const root = path.resolve(__dirname, "../..");
const sha = "a".repeat(40), oldSha = "b".repeat(40);
const bash = process.platform === "win32" ? "C:/Program Files/Git/bin/bash.exe" : "/bin/bash";

function temporary(t) {
 const folder = fs.mkdtempSync(path.join(os.tmpdir(), "studyjony-release-test-"));
 t.after(() => {
  assert.equal(path.dirname(path.resolve(folder)), path.resolve(os.tmpdir()));
  assert.ok(path.basename(folder).startsWith("studyjony-release-test-"));
  fs.rmSync(folder, { recursive: true, force: true });
 });
 return folder;
}
const worker = (extra = {}) => ({ name: "studyjony-api", pid: process.pid, pm2_env: { status: "online", node_version: "22.23.2", watch: false, ...extra } });

test("runtime and loopback health configuration fail closed", () => {
 for (const value of ["22.14.0", "22.23.2"]) assert.doesNotThrow(() => assertNodeVersion(value));
 for (const value of ["20.19.0", "22.13.9", "23.0.0", "24.0.0", "22.x", "", undefined]) assert.throws(() => assertNodeVersion(value));
 for (const value of ["http://127.0.0.1:5000/health", "http://[::1]:5432/health"]) assert.equal(healthURL(value), value);
 for (const value of [undefined, "http://localhost:5000/health", "https://127.0.0.1:5000/health", "http://127.0.0.1/health", "http://127.0.0.1:5000/health?token=secret", "http://127.0.0.1:5000/health#x", "http://user:secret@127.0.0.1:5000/health", "http://198.51.100.1:5000/health", "http://127.0.0.1:65536/health", "http://127.0.0.1:5000/health'; echo secret"]) assert.throws(() => healthURL(value));
});

test("PM2 verifies runtime, worker count and exact release script/cwd", () => {
 const release = path.resolve("fixture-release");
 const valid = worker({ exec_mode: "fork_mode", pm_cwd: path.join(release, "server"), pm_exec_path: path.join(release, "server/server.js") });
 assert.equal(checkPm2(JSON.stringify([valid, { name: "other" }]), release), 1);
 assert.throws(() => checkPm2(JSON.stringify([valid]), release, { uid: 1001, owner: () => 0 }), /not owned/);
 for (const value of ["secret-not-json", "{}", "[]", JSON.stringify([worker({ status: "errored" })]), JSON.stringify([worker({ node_version: "20.0.0" })]), JSON.stringify([worker({ watch: true })]), JSON.stringify([valid, valid]), JSON.stringify([worker({ ...valid.pm2_env, pm_exec_path: path.join(release, "wrong.js") })])]) assert.throws(() => checkPm2(value, release));
});

test("health rejects redirects/bad bodies and retries bounded startup", async () => {
 let requests = 0;
 await checkHealth("http://127.0.0.1:5000/health", { attempts: 3, delayMs: 0, fetchImpl: async (url, options) => {
  assert.equal(options.redirect, "error"); assert.equal(options.headers["Cache-Control"], "no-store");
  return { status: ++requests < 3 ? 503 : 200, json: async () => ({ status: "ok" }) };
 } });
 assert.equal(requests, 3);
 for (const response of [{ status: 302 }, { status: 200, json: async () => ({ status: "wrong" }) }, { status: 200, json: async () => { throw new Error("private response"); } }]) await assert.rejects(checkHealth("http://127.0.0.1:5000/health", { attempts: 1, fetchImpl: async () => response }));
});

test("private API check requires unauthenticated denial and explicit no-store", async () => {
 await checkPrivateApi("http://127.0.0.1:5000/health", async (url, options) => {
  assert.equal(url.pathname, "/api/v1/users/me"); assert.equal(options.headers, undefined);
  return { status: 401, headers: new Headers({ "cache-control": "private, no-store" }) };
 });
 for (const [status, header] of [[200, "private, no-store"], [401, "public, max-age=0, must-revalidate"]]) await assert.rejects(checkPrivateApi("http://127.0.0.1:5000/health", async () => ({ status, headers: new Headers({ "cache-control": header }) })));
});

test("production job allows only successful main push/manual runs in the canonical repository", () => {
 const source = fs.readFileSync(path.join(root, ".github/workflows/deploy-backend.yml"), "utf8");
 const job = source.split("\n  deploy:\n")[1];
 assert.ok(job, "A production job exists");
 assert.match(job, /\n    needs: test\n    environment: production/);
 const expression = job.match(/^    if: \$\{\{ (.+) \}\}$/m)?.[1];
 assert.ok(expression, "An explicit production condition is required");
 // Evaluate the actual checked-in condition, using its JS-compatible equality/
 // boolean subset. These fixtures use GitHub's canonical lowercase refs/events.
 const allowed = new Function("github", "needs", `return (${expression});`);
 const canonical = { repository: "ThanhsonWeb/English-Jony-App", ref: "refs/heads/main", event_name: "push" };
 const success = { test: { result: "success" } };
 assert.equal(allowed(canonical, success), true);
 assert.equal(allowed({ ...canonical, event_name: "workflow_dispatch" }, success), true);
 for (const changed of [
  { event_name: "pull_request", ref: "refs/pull/2/merge" },
  { event_name: "pull_request" }, { event_name: "pull_request_target" },
  { event_name: "schedule" }, { event_name: "workflow_run" },
  { ref: "refs/heads/feature" }, { ref: "refs/tags/main" },
  { repository: "another-owner/English-Jony-App" },
  { event_name: "workflow_dispatch", ref: "refs/heads/feature" },
 ]) assert.equal(allowed({ ...canonical, ...changed }, success), false, JSON.stringify(changed));
 for (const result of ["failure", "cancelled", "skipped", "", undefined]) {
  assert.equal(allowed(canonical, { test: { result } }), false, String(result));
 }
 assert.ok(source.includes("node --test --test-concurrency=1 tests/*.test.js"));
 assert.ok(source.includes('[[ "$GITHUB_REF" == refs/heads/main'));
 assert.ok(source.includes('[[ "$VPS_USER" == studyjony ]]'));
 for (const value of ["StrictHostKeyChecking=yes", "UpdateHostKeys=no", "VPS_KNOWN_HOSTS", "VPS_HOST_KEY_SHA256", "persist-credentials: false", "cancel-in-progress: false"]) assert.ok(source.includes(value), value);
 assert.doesNotMatch(source, /ssh-keyscan|npm install|pull_request_target/);
 for (const [, block] of source.matchAll(/run: \|\n([\s\S]*?)(?=\n      - name:|$)/g)) assert.doesNotMatch(block, /\$\{\{\s*secrets\./);
 for (const action of source.matchAll(/uses: ([^\s]+)/g)) assert.match(action[1], /@[a-f0-9]{40}$/);
});

function bundleFor(commit = sha) {
 const files = ["server/server.js", "server/app.js", "server/package.json", "server/package-lock.json", "server/scripts/check-deployment.js", "server/controllers/example.js", "server/middleware/example.js", "server/models/example.js", "server/routes/example.js", "server/services/example.js", "server/utils/example.js"].map(filename => {
  const bytes = Buffer.from(filename.endsWith(".json") ? "{}\n" : "// disposable fixture\n");
  return { path: filename, mode: "100644", content: bytes.toString("base64"), sha256: hash(bytes) };
 });
 return { version: 1, commit, files };
}

test("source bundles reject traversal, symlinks, dependencies, secrets and duplicate files", () => {
 for (const filename of ["../server/app.js", "/server/app.js", "server/../app.js", "server\\app.js", "server/.env", "server/.env.production", "server/key.pem", "server/node_modules/a.js", "server/local-avatars/a.png", "server/x\n.js"]) assert.equal(sourcePath(filename), false, filename);
 const valid = bundleFor(); assert.equal(validateBundle(valid, sha), valid);
 for (const modify of [b => b.commit = oldSha, b => b.files.push(b.files[0]), b => b.files[0].mode = "120000", b => b.files[0].sha256 = "0".repeat(64), b => b.files[0].content += "!", b => b.files.splice(0, 1)]) {
  const copy = structuredClone(valid); modify(copy); assert.throws(() => validateBundle(copy, sha));
 }
});

test("artifact extraction verifies entire checksum before touching an empty directory", t => {
 const folder = temporary(t), destination = path.join(folder, "release"), input = path.join(folder, "bundle.json"); fs.mkdirSync(destination);
 const bytes = JSON.stringify(bundleFor()); fs.writeFileSync(input, bytes);
 assert.throws(() => extract(input, "0".repeat(64), sha, destination));
 assert.deepEqual(fs.readdirSync(destination), []);
 extract(input, hash(bytes), sha, destination);
 assert.equal(JSON.parse(fs.readFileSync(path.join(destination, ".release.json"))).commit, sha);
 assert.throws(() => extract(input, hash(bytes), sha, destination));
});

test("builder packages committed source deterministically, including catalogue inputs but no working-tree drift", t => {
 const folder = temporary(t), repo = path.join(folder, "repo"); fs.mkdirSync(repo);
 const git = args => execFileSync("git", args, { cwd: repo, stdio: ["pipe", "pipe", "pipe"] });
 git(["init", "-q"]);
 for (const file of bundleFor().files) {
  const filename = path.join(repo, file.path); fs.mkdirSync(path.dirname(filename), { recursive: true }); fs.writeFileSync(filename, Buffer.from(file.content, "base64"));
 }
 const localization = path.join(repo, "client/app/_lib/dialogue/localization.js"); fs.mkdirSync(path.dirname(localization), { recursive: true }); fs.writeFileSync(localization, "// catalogue input\n");
 git(["add", "server", "client"]); git(["-c", "user.name=Disposable test", "-c", "user.email=test@example.test", "commit", "-qm", "fixture"]);
 const commit = git(["rev-parse", "HEAD"]).toString().trim();
 fs.writeFileSync(path.join(repo, "server/app.js"), "// uncommitted drift\n");
 const one = path.join(folder, "one.json"), two = path.join(folder, "two.json");
 assert.equal(build(commit, one, repo), build(commit, two, repo));
 const bundle = JSON.parse(fs.readFileSync(one));
 assert.ok(bundle.files.some(file => file.path === "client/app/_lib/dialogue/localization.js"));
 assert.equal(Buffer.from(bundle.files.find(file => file.path === "server/app.js").content, "base64").toString(), "// disposable fixture\n");
});

// These fixtures execute the real Bash script and real path/artifact checks.
// GitHub, npm, PM2 and database/health calls are disposable local stubs.
function shellFixture(t, fail = "", options = {}) {
 assert.ok(fs.existsSync(bash), "Bash is required; deployment tests must not be skipped");
 const folder = temporary(t), bin = path.join(folder, "bin"), base = path.join(folder, "app");
 for (const dir of [bin, base, path.join(base, "releases"), path.join(base, "shared"), path.join(base, "incoming")]) fs.mkdirSync(dir, { recursive: true });
 const old = path.join(base, "releases", `${oldSha}.12345678`), incoming = path.join(base, "incoming", "upload"); fs.mkdirSync(path.join(old, "server"), { recursive: true }); fs.mkdirSync(incoming);
 const posix = value => process.platform === "win32" ? execFileSync(bash, ["-c", 'cygpath -u "$1"', "fixture", value], { encoding: "utf8" }).trim() : value;
 const oldUnix = posix(old), baseUnix = posix(base), log = path.join(folder, "commands.log"), state = path.join(folder, "pm2-state");
 const logUnix = posix(log), stateUnix = posix(state);
 fs.writeFileSync(path.join(old, "server/server.js"), "// old release never changes\n");
 fs.writeFileSync(path.join(old, ".release.json"), JSON.stringify({ version: 1, commit: oldSha, artifactHash: "c".repeat(64), files: [{ path: "server/server.js", sha256: hash("// old release never changes\n") }] }));
 fs.writeFileSync(path.join(base, "shared/backend.env"), "# disposable, never read by providers\n", { mode: 0o600 });
 fs.symlinkSync(old, path.join(base, "current"), "junction");
 fs.writeFileSync(state, oldUnix);
 for (const [name, source] of [["release-artifact.js", "server/scripts/release-artifact.js"], ["check-deployment.js", "server/scripts/check-deployment.js"], ["ecosystem.config.cjs", "server/deploy/ecosystem.config.cjs"]]) fs.copyFileSync(path.join(root, source), path.join(incoming, name));
 const bytes = JSON.stringify(bundleFor()); fs.writeFileSync(path.join(incoming, "release.json"), bytes);
 if (fail === "interrupted") fs.writeFileSync(path.join(base, "deploy-state.json"), JSON.stringify({ version: 1, previous: oldUnix, candidate: "interrupted" }));
 if (fail === "journal-path") fs.writeFileSync(path.join(base, "deploy-state.json"), JSON.stringify({ version: 1, previous: posix(folder) }));
 const realNode = process.execPath.replaceAll("\\", "/");
 function command(name, body) {
  fs.writeFileSync(path.join(bin, name), `#!/usr/bin/env bash\nset -euo pipefail\nprintf '%s\\n' "${name} $*" >> '${logUnix}'\n${body}\n`, { mode: 0o755 });
 }
 // Git Bash's ln normally copies directory targets on Windows. Adapt only its
 // link primitives to native junctions; Linux CI uses actual atomic GNU mv/ln.
 if (process.platform === "win32") {
  const realMv = execFileSync(bash, ["-c", "command -v mv"], { encoding: "utf8" }).trim();
  command("ln", `[[ "$1" == -s ]]; [[ '${fail}' != pointer || "$2" != *${sha}* || "$3" != */.current-next ]]; '${realNode}' -e 'const fs=require("node:fs"); const [from,to]=process.argv.slice(1); if(fs.statSync(from).isDirectory()) fs.symlinkSync(from,to,"junction"); else fs.copyFileSync(from,to);' "$2" "$3"`);
  command("mv", `if [[ "$1" == -Tf ]]; then '${realNode}' -e 'const fs=require("node:fs"); const [from,to]=process.argv.slice(1); if(fs.existsSync(to)) fs.unlinkSync(to); fs.renameSync(from,to);' "$2" "$3"; else '${realMv}' "$@"; fi`);
  command("rm", `[[ "$1" == -f ]]; shift; '${realNode}' -e 'const fs=require("node:fs"); for(const file of process.argv.slice(1)) { if(fs.existsSync(file)) { const stat=fs.lstatSync(file); if(!stat.isFile()&&!stat.isSymbolicLink()) process.exit(1); fs.unlinkSync(file); } }' "$@"`);
 }
 if (process.platform !== "win32" && fail === "pointer") {
  const realLn = execFileSync(bash, ["-c", "command -v ln"], { encoding: "utf8" }).trim();
  command("ln", `[[ "$2" != *${sha}* || "$3" != */.current-next ]]; exec '${realLn}' "$@"`);
 }
 command("id", `if [[ "$1" == -u ]]; then printf '%s' '${fail === "root" ? "0" : "1001"}'; else printf '%s' 'studyjony'; fi`);
 command("flock", fail === "lock" ? "exit 1" : "exit 0");
 command("npm", `[[ "$PWD" != '${oldUnix}/server' ]]\n[[ ! -e .env ]]\ncase "$1" in ci) [[ '${fail}' != install ]];; ls) [[ '${fail}' != tree ]];; run) [[ '${fail}' != catalogue ]];; esac`);
 command("pm2", `case "$1" in
 jlist)
 selected=$(cat '${stateUnix}')
 if [[ "$selected" == none ]]; then printf '[]'; else
 '${realNode}' -e 'const path=require("node:path"), selected=process.argv[1]; const wrong=process.argv[2]==="wrong-path" && selected.includes("${sha}"); console.log(JSON.stringify([{name:"studyjony-api",pid:${process.pid},pm2_env:{status:"online",node_version:"22.23.2",watch:process.argv[2]==="watch",exec_mode:"fork_mode",pm_cwd:path.join(selected,"server"),pm_exec_path:path.join(wrong?process.argv[3]:selected,"server/server.js")}},{name:"other-service"}]))' "$selected" '${fail}' '${oldUnix}'
 fi;;
 delete) [[ "$2" == studyjony-api ]]; printf none > '${stateUnix}';;
 start)
 [[ -z "\u0024{QA_SECRET_CANARY:-}" ]]
 [[ "$STUDYJONY_RELEASE" == '${oldUnix}' || '${fail}' != start ]]
 if [[ '${fail}' == rollback && "$STUDYJONY_RELEASE" == '${oldUnix}' ]]; then exit 1; fi
 printf '%s' "$STUDYJONY_RELEASE" > '${stateUnix}'
 if [[ '${fail}' == term && "$STUDYJONY_RELEASE" != '${oldUnix}' ]]; then kill -TERM "$PPID"; fi;;
 save) [[ '${fail}' != save || "$(cat '${stateUnix}')" == '${oldUnix}' ]];;
 *) exit 1;;
 esac`);
 command("node", `case "$*" in
 *--dependencies*)
  if [[ '${fail}' == source-tamper ]]; then printf '// tampered' > app.js; fi
  [[ '${fail}' != native ]]; exit $?;;
 *--check*) [[ '${fail}' != syntax ]]; exit $?;;
 *--config*) [[ '${fail}' != config ]]; exit $?;;
 *--database*)
  [[ '${fail}' != database ]]
  [[ '${fail}' != database-post || "$(cat '${stateUnix}')" != *${sha}* ]]; exit $?;;
 *--private-api*) [[ '${fail}' != headers || "$(cat '${stateUnix}')" == '${oldUnix}' ]]; exit $?;;
 *--public-api*) [[ '${fail}' != public-headers || "$(cat '${stateUnix}')" == '${oldUnix}' ]]; exit $?;;
 *--health)
  [[ '${fail}' != health && '${fail}' != rollback || "$(cat '${stateUnix}')" == '${oldUnix}' ]]; exit $?;;
 esac
 exec '${realNode}' "$@"`);
 const result = spawnSync(bash, ["--noprofile", "--norc", "-c", `export PATH='${posix(bin)}':"$PATH"; exec bash '${posix(path.join(root, "server/scripts/deploy-backend.sh"))}' '${sha}' '${posix(incoming)}' '${fail === "checksum" ? "0".repeat(64) : hash(bytes)}' 'http://127.0.0.1:5000/health'`], {
  env: { ...process.env, DEPLOY_BASE: baseUnix, DEPLOY_USER: "studyjony", QA_SECRET_CANARY: "must-not-reach-PM2", ...options.env }, encoding: "utf8", timeout: 30000,
 });
 assert.ifError(result.error);
 assert.equal(fs.readFileSync(path.join(old, "server/server.js"), "utf8"), "// old release never changes\n");
 return { ...result, log: fs.existsSync(log) ? fs.readFileSync(log, "utf8") : "", base, old, state, selected: fs.readFileSync(state, "utf8") };
}

const preparationStages = { root: "arguments", lock: "lock", checksum: "extract", watch: "current_pm2", install: "install", tree: "dependency_tree", native: "native_dependencies", syntax: "syntax", catalogue: "catalogue", config: "config", database: "database", "journal-path": "previous_integrity", "source-tamper": "post_catalogue_integrity" };
for (const failure of ["root", "lock", "checksum", "watch", "install", "tree", "native", "syntax", "catalogue", "config", "database", "journal-path", "source-tamper"]) test(`${failure}: preparation fails without changing the running release`, t => {
 const result = shellFixture(t, failure);
 assert.notEqual(result.status, 0, result.stderr);
 assert.doesNotMatch(result.log, /pm2 delete|pm2 start|pm2 save/);
 assert.ok(result.stderr.includes(`deployment operation=preparation stage=${preparationStages[failure]} status=started`), "The failed preparation step is named");
 assert.doesNotMatch(result.stderr, /must-not-reach-PM2/);
 assert.equal(fs.realpathSync(path.join(result.base, "current")), fs.realpathSync(result.old));
});

const activationStages = { start: "pm2_start", "wrong-path": "pm2_verify", health: "health", "database-post": "database", headers: "private_api", "public-headers": "public_api", save: "save", pointer: "current_pointer", term: "pm2_start" };
for (const failure of ["start", "wrong-path", "health", "database-post", "headers", "public-headers", "save", "pointer", "term"]) test(`${failure}: activation failure restores and verifies the previous release`, t => {
 const result = shellFixture(t, failure);
 assert.notEqual(result.status, 0, result.stderr);
 assert.match(result.stderr, /previous release restored and verified/, result.stderr);
 assert.ok(result.stderr.includes(`deployment operation=activation stage=${activationStages[failure]} status=failed`), "The original activation failure remains visible after rollback");
 assert.ok(result.stderr.includes("deployment operation=rollback stage=release_integrity status=started"));
 assert.doesNotMatch(result.stderr, /must-not-reach-PM2/);
 assert.ok(result.selected.includes(oldSha));
 assert.equal(fs.realpathSync(path.join(result.base, "current")), fs.realpathSync(result.old));
 assert.equal(fs.existsSync(path.join(result.base, "deploy-state.json")), false);
 assert.match(result.log, /pm2 save/);
});

test("failed rollback retains the journal and both releases for operator recovery", t => {
 const result = shellFixture(t, "rollback"); assert.notEqual(result.status, 0);
 assert.match(result.stderr, /DEPLOYMENT AND ROLLBACK FAILED/, result.stderr);
 assert.match(result.stderr, /operation=activation stage=health status=failed/);
 assert.match(result.stderr, /operation=rollback stage=pm2_start status=failed/);
 assert.equal(fs.existsSync(path.join(result.base, "deploy-state.json")), true);
 assert.equal(fs.readdirSync(path.join(result.base, "releases")).length, 2);
 assert.doesNotMatch(result.log, /pm2 save/);
});

test("interrupted deployment is recovered, but never silently proceeds with another install", t => {
 const result = shellFixture(t, "interrupted"); assert.notEqual(result.status, 0, result.stderr);
 assert.match(result.stderr, /Recovered an interrupted deployment/);
 assert.ok(result.selected.includes(oldSha)); assert.doesNotMatch(result.log, /npm ci/);
 assert.match(result.stderr, /operation=rollback stage=pm2_start status=started/);
 assert.equal(fs.existsSync(path.join(result.base, "deploy-state.json")), false);
});

test("success installs away from current, switches explicit paths, verifies, saves and retains previous", t => {
 const result = shellFixture(t); assert.equal(result.status, 0, result.stderr);
 assert.ok(result.selected.includes(sha));
 assert.equal(fs.realpathSync(path.join(result.base, "previous")), fs.realpathSync(result.old));
 assert.notEqual(fs.realpathSync(path.join(result.base, "current")), fs.realpathSync(result.old));
 assert.equal(fs.existsSync(path.join(result.base, "deploy-state.json")), false);
 assert.ok(result.log.indexOf("npm ci") < result.log.indexOf("pm2 delete"));
 assert.ok(result.log.indexOf("--private-api") < result.log.indexOf("pm2 save"));
 assert.doesNotMatch(result.log, /pm2 delete all|--update-env|sudo|git merge/);
 assert.match(result.stderr, /operation=preparation stage=database status=started/);
 assert.match(result.stderr, /operation=activation stage=database status=started/);
 assert.doesNotMatch(result.stderr, /status=failed|must-not-reach-PM2/);
});
