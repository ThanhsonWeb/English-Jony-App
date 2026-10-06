const assert = require("node:assert/strict");
const { test, before, after, beforeEach } = require("node:test");
const http = require("node:http");
const crypto = require("node:crypto");
const { format } = require("node:util");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const { MongoMemoryServer } = require("mongodb-memory-server");
const User = require("../models/userModel");
const Vocab = require("../models/vocabModel");
const passwordResetOrigin = require("../utils/passwordResetOrigin");

let db, server, user, session, appErrors;
const trustedOrigin = "https://learn.studyjony.test";
const password = "original-test-password";
const originalEnv = Object.fromEntries(
	["NODE_ENV", "FRONTEND_URL", "JWT_SECRET", "JWT_EXPIRES_IN"].map(key => [key, process.env[key]]),
);

before(async () => {
	Object.assign(process.env, {
		NODE_ENV: "production", FRONTEND_URL: trustedOrigin,
		JWT_SECRET: "isolated-password-recovery-security", JWT_EXPIRES_IN: "1h",
	});
	db = await MongoMemoryServer.create({ binary: { version: "7.0.14" } });
	await mongoose.connect(db.getUri(), { dbName: "password_recovery_security_test" });
	await User.init();
	const app = require("../app");
	// Observe the existing F20 after-response failure without changing app middleware.
	app.use((error, req, res, next) => {
		appErrors.push({ code: error.code, headersSent: res.headersSent });
		if (!res.headersSent) res.status(500).end();
	});
	server = await new Promise(resolve => {
		const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
	});
}, { timeout: 180000 });

after(async () => {
	if (server) await new Promise(resolve => server.close(resolve));
	await mongoose.disconnect();
	await db?.stop();
	for (const [key, value] of Object.entries(originalEnv)) {
		if (value === undefined) delete process.env[key]; else process.env[key] = value;
	}
});

beforeEach(async () => {
	process.env.NODE_ENV = "production";
	process.env.FRONTEND_URL = trustedOrigin;
	appErrors = [];
	await Promise.all([User.deleteMany({}), Vocab.deleteMany({})]);
	user = await User.create({
		name: "Test Learner", email: "recovery@example.test", password, passwordConfirm: password,
	});
	session = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: "1h" });
});

// Raw HTTP preserves forged Host headers (fetch may replace them).
function request(path, method = "GET", body, headers = {}) {
	return new Promise((resolve, reject) => {
		const req = http.request({
			hostname: "127.0.0.1", port: server.address().port, path: `/api/v1${path}`, method,
			headers: { "Content-Type": "application/json", ...headers },
		}, res => {
			let text = "";
			res.on("data", chunk => { text += chunk; });
			res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body: text ? JSON.parse(text) : null }));
		});
		req.on("error", reject);
		req.end(body === undefined ? undefined : JSON.stringify(body));
	});
}

function capture(t, failMail = false) {
	const mails = [], logs = [];
	t.mock.method(nodemailer, "createTransport", () => ({ sendMail: async message => {
		mails.push(message);
		if (failMail) throw new Error(`Mock mail transport failure: ${message.text}`);
	} }));
	for (const method of ["log", "info", "warn", "error", "debug", "dir", "table", "trace"]) {
		t.mock.method(console, method, (...args) => { logs.push(format(...args)); });
	}
	return { mails, logs };
}

const forgot = headers => request("/users/forgotPassword", "POST", { email: user.email }, headers);
function emailedUrl(mails) {
	assert.equal(mails.length, 1);
	const value = mails[0].text.match(/https?:\/\/\S+/)?.[0];
	assert.ok(Boolean(value), "Email contains the reset link");
	return new URL(value);
}
function assertNoPrivateLogs(logs, values) {
	const output = logs.join("\n");
	for (const value of values) assert.equal(output.includes(value), false, "Sensitive value must not be logged");
	assert.equal(/https?:\/\/\S*resetPassword\//i.test(output), false, "Token-bearing URLs must not be logged");
}
const resetBody = { password: "replacement-test-password", passwordConfirm: "replacement-test-password" };
const me = token => request("/users/me", "GET", undefined, { Cookie: `jwt=${token}` });
const responseToken = response => response.headers["set-cookie"][0].match(/jwt=([^;]+)/)[1];

test("origin policy accepts HTTPS and normalizes trailing slashes; HTTP is non-production only", () => {
	for (const configured of [trustedOrigin, `${trustedOrigin}/`, `${trustedOrigin}////`]) {
		process.env.FRONTEND_URL = configured;
		assert.equal(passwordResetOrigin(), trustedOrigin);
	}
	process.env.FRONTEND_URL = "http://localhost:3000///";
	assert.throws(passwordResetOrigin, error => error.statusCode === 500);
	for (const environment of ["development", "test"]) {
		process.env.NODE_ENV = environment;
		assert.equal(passwordResetOrigin(), "http://localhost:3000");
	}
});

const forgedHeaders = [
	["configured origin", {}],
	["Host", { Host: "reset.attacker.test:8080" }],
	["X-Forwarded-Host", { "X-Forwarded-Host": "reset.attacker.test" }],
	["forwarded protocol", { "X-Forwarded-Proto": "http", Forwarded: 'proto=http;host="reset.attacker.test"' }],
	["combined forwarded headers", { Host: "reset.attacker.test", "X-Forwarded-Host": "other.attacker.test", "X-Forwarded-Proto": "https" }],
];
for (const [name, headers] of forgedHeaders) test(`${name} cannot influence the emailed reset URL`, async t => {
	const { mails, logs } = capture(t);
	process.env.FRONTEND_URL = `${trustedOrigin}///`;
	assert.equal((await forgot(headers)).status, 200);
	const link = emailedUrl(mails);
	assert.equal(link.origin, trustedOrigin);
	assert.ok(/^\/api\/v1\/users\/resetPassword\/[a-f0-9]{64}$/.test(link.pathname), "Existing API path/token contract is preserved");
	assert.equal(link.search, "");
	assert.equal(link.hash, "");
	const token = link.pathname.split("/").at(-1);
	const saved = await User.findById(user.id);
	const hash = crypto.createHash("sha256").update(token).digest("hex");
	assert.ok(saved.passwordResetToken === hash, "Only the SHA-256 hash is stored");
	assert.ok(saved.passwordResetToken !== token);
	assertNoPrivateLogs(logs, [token, hash, link.href, user.email, user.id]);
	assert.deepEqual(appErrors, [{ code: "ERR_HTTP_HEADERS_SENT", headersSent: true }], "Known F20 remains isolated from this fix");
});

test("missing or invalid production origin fails before replacing any reset credential or sending mail", async t => {
	const { mails, logs } = capture(t);
	const previous = user.createPasswordResetToken();
	await user.save({ validateBeforeSave: false });
	const oldHash = user.passwordResetToken, oldExpiry = user.passwordResetExpires.getTime();
	for (const configured of [
		undefined, "", "not-a-url", "//reset.attacker.test", "http://learn.studyjony.test",
		"javascript:alert(1)", "https:/learn.studyjony.test", "https://", "https://host:bad",
		"https://login:secret@learn.studyjony.test", `${trustedOrigin}/nested`, `${trustedOrigin}/nested/../`,
		`${trustedOrigin}/%2e/`, `${trustedOrigin}?query=1`, `${trustedOrigin}?`, `${trustedOrigin}#hash`,
		`${trustedOrigin}#`, `${trustedOrigin}\\evil`, `${trustedOrigin}\n`,
	]) {
		if (configured === undefined) delete process.env.FRONTEND_URL; else process.env.FRONTEND_URL = configured;
		const response = await forgot({ Host: "reset.attacker.test", "X-Forwarded-Proto": "https" });
		assert.equal(response.status, 500);
		assert.equal(response.body.message, "Password recovery is temporarily unavailable. Please try again later.");
		const saved = await User.findById(user.id);
		assert.ok(saved.passwordResetToken === oldHash, "Invalid config must preserve existing reset credentials");
		assert.equal(saved.passwordResetExpires.getTime(), oldExpiry);
	}
	assert.equal(mails.length, 0);
	assert.deepEqual(appErrors, []);
	assertNoPrivateLogs(logs, [previous, oldHash, user.email, user.id]);
});

test("emailed token resets password, consumes credential, revokes old sessions and accepts the replacement session", async t => {
	const { mails, logs } = capture(t);
	// Signup/login and reset can happen in one JWT second.
	const frozen = Math.floor(Date.now() / 1000) * 1000 + 100;
	t.mock.method(Date, "now", () => frozen);
	session = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: "1h" });
	assert.equal((await forgot()).status, 200);
	const link = emailedUrl(mails), token = link.pathname.split("/").at(-1);
	const beforeReset = await User.findById(user.id);
	const hash = beforeReset.passwordResetToken;
	assert.equal(beforeReset.passwordResetExpires.getTime(), frozen + 20 * 60 * 1000);
	assert.equal((await me(session)).status, 200);
	const reset = await request(link.pathname.replace("/api/v1", ""), "PATCH", resetBody);
	assert.equal(reset.status, 200);
	const replacement = responseToken(reset);
	assert.equal(jwt.decode(session).iat, jwt.decode(replacement).iat);
	assert.equal((await me(session)).status, 401);
	assert.equal((await me(replacement)).status, 200);
	assert.equal((await request(link.pathname.replace("/api/v1", ""), "PATCH", resetBody)).status, 400);
	const saved = await User.findById(user.id).select("+password");
	assert.equal(saved.passwordResetToken, undefined);
	assert.equal(saved.passwordResetExpires, undefined);
	assert.ok(saved.password !== resetBody.password);
	assert.equal(await saved.correctPassword(resetBody.password, saved.password), true);
	assert.equal((await request("/auth/login", "POST", { email: user.email, password })).status, 401);
	assert.equal((await request("/auth/login", "POST", { email: user.email, password: resetBody.password })).status, 200);
	assert.equal((await request("/auth/logout", "POST")).status, 200);
	assert.equal((await request("/users/me")).status, 401);
	assertNoPrivateLogs(logs, [token, hash, link.href, password, resetBody.password, user.email, user.id]);
});

test("reset expiry is still exactly 20 minutes and an expired token does not change password or session", async t => {
	const { mails, logs } = capture(t);
	let now = Date.now();
	t.mock.method(Date, "now", () => now);
	assert.equal((await forgot()).status, 200);
	const link = emailedUrl(mails), token = link.pathname.split("/").at(-1);
	const saved = await User.findById(user.id).select("+password");
	assert.equal(saved.passwordResetExpires.getTime(), now + 20 * 60 * 1000);
	now = saved.passwordResetExpires.getTime();
	for (const delay of [0, 1]) {
		now += delay;
		assert.equal((await request(link.pathname.replace("/api/v1", ""), "PATCH", resetBody)).status, 400);
	}
	const unchanged = await User.findById(user.id).select("+password");
	assert.ok(unchanged.password === saved.password);
	assert.equal(unchanged.passwordChangedAt, undefined);
	assert.equal((await me(session)).status, 200);
	assertNoPrivateLogs(logs, [token, link.href, saved.passwordResetToken]);
});

test("mail failure cleans up the new credential and logs no tokens, addresses or transport details", async t => {
	const { mails, logs } = capture(t, true);
	const response = await forgot();
	assert.equal(response.status, 500);
	assert.equal(response.body.message, "There was an error sending the email. Try again later.");
	const attemptedLink = emailedUrl(mails);
	const saved = await User.findById(user.id);
	assert.equal(saved.passwordResetToken, undefined);
	assert.equal(saved.passwordResetExpires, undefined);
	assertNoPrivateLogs(logs, [user.email, user.id, "Mock mail transport failure", attemptedLink.href, attemptedLink.pathname.split("/").at(-1)]);
	assert.deepEqual(logs, []);
});

test("vocabulary create/update and rejected updates never log private learning text or document dumps", async t => {
	const { logs } = capture(t);
	const headers = { Cookie: `jwt=${session}` };
	const initial = { english: "private-original-word", vietnamese: "nghĩa riêng tư ban đầu", example: "My private original example.", pronunciation: "/private/" };
	const updated = { english: "private-updated-word", vietnamese: "nghĩa riêng tư đã sửa", example: "My private updated example." };
	const created = await request("/vocab", "POST", initial, headers);
	assert.equal(created.status, 201);
	const id = created.body.data.newVocab._id;
	const edited = await request(`/vocab/${id}`, "PATCH", updated, headers);
	assert.equal(edited.status, 200);
	assert.equal(edited.body.data.updatedVocab.english, updated.english);
	assert.equal((await request("/vocab", "GET", undefined, headers)).body.data.vocabularies.length, 1);
	assert.equal((await request(`/vocab/${id}`, "PATCH", { english: "" }, headers)).status, 400);
	assert.equal((await request(`/vocab/${new mongoose.Types.ObjectId()}`, "PATCH", updated, headers)).status, 404);
	assert.equal((await request("/vocab", "POST", initial)).status, 401);
	assertNoPrivateLogs(logs, [...Object.values(initial), ...Object.values(updated), user.id, user.email, id, "BODY:", "UPDATED VOCAB:"]);
});
