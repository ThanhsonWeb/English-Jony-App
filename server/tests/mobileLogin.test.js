const assert = require("node:assert/strict");
const http = require("node:http");
const { test, before, after, beforeEach } = require("node:test");
const express = require("express");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const { MongoMemoryServer } = require("mongodb-memory-server");
const User = require("../models/userModel");
const Vocab = require("../models/vocabModel");
const MobileLoginWindow = require("../models/mobileLoginWindowModel");
const RevokedSession = require("../models/revokedSessionModel");
const sessionRevocation = require("../utils/sessionRevocation");
const { requireMobileLoginRequest } = require("../utils/mobileLoginRequest");
const { createMobileLoginRateLimit, mobileLoginPolicy } = require("../middleware/mobileLoginRateLimit");
const errorHandler = require("../controllers/errorController");

// Synthetic fixtures only. No .env, production database, email or Google calls.
const secret = "isolated-mobile-login-test-signing-key";
const password = "phase-one-test-password";
const frontend = "https://studyjony.test";
const environment = { NODE_ENV: "production", FRONTEND_URL: frontend, JWT_SECRET: secret, JWT_EXPIRES_IN: "7d" };
const previous = Object.fromEntries(Object.keys(environment).map(key => [key, process.env[key]]));
let db, server, base, owner, other, google;
const listen = app => new Promise(resolve => { const listener = app.listen(0, "127.0.0.1", () => resolve(listener)); });

before(async () => {
	Object.assign(process.env, environment);
	db = await MongoMemoryServer.create({ binary: { version: "7.0.14" } });
	await mongoose.connect(db.getUri(), { dbName: "mobile_login_phase_one_test" });
	// Explicit provisioning is a deployment prerequisite, never a login side effect.
	await mongoose.connection.db.createCollection("mobileloginwindows");
	await MobileLoginWindow.collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
	await Promise.all([User.init(), Vocab.init(), MobileLoginWindow.init(), RevokedSession.init()]);
	const app = require("../app");
	assert.equal(app.get("trust proxy"), require("../utils/trustedProxy").trustNginxProxy);
	server = await listen(app);
	base = `http://127.0.0.1:${server.address().port}/api/v1`;
}, { timeout: 180000 });

after(async () => {
	if (server) await new Promise(resolve => server.close(resolve));
	await mongoose.disconnect(); await db?.stop();
	for (const [key, value] of Object.entries(previous)) {
		if (value === undefined) delete process.env[key]; else process.env[key] = value;
	}
});

beforeEach(async () => {
	Object.assign(process.env, environment);
	await Promise.all([User.deleteMany({}), Vocab.deleteMany({}), MobileLoginWindow.deleteMany({}), RevokedSession.deleteMany({})]);
	[owner, other, google] = await User.create([
		{ name: "Mobile learner", email: "mobile@example.test", password, passwordConfirm: password },
		{ name: "Other learner", email: "other@example.test", password, passwordConfirm: password },
		{ name: "Google learner", email: "google@example.test", googleId: "isolated-google-subject" },
	]);
});

// Node fetch injects Sec-Fetch-Mode. Plain HTTP models an actual native client
// without relaxing the production guard just to make a test client pass.
function nativeRequest(url, { method = "GET", body, headers = {}, raw } = {}) {
	const finalHeaders = { ...(body !== undefined || raw !== undefined ? { "Content-Type": "application/json" } : {}), ...headers };
	for (const [key, value] of Object.entries(finalHeaders)) if (value === undefined) delete finalHeaders[key];
	const payload = raw !== undefined ? raw : body !== undefined ? JSON.stringify(body) : undefined;
	if (payload !== undefined) finalHeaders["Content-Length"] = Buffer.byteLength(payload);
	return new Promise((resolve, reject) => {
		const request = http.request(url, { method, headers: finalHeaders }, response => {
			const chunks = [];
			response.on("data", chunk => chunks.push(chunk)); response.on("error", reject);
			response.on("end", () => {
				const headers = new Headers();
				for (const [key, value] of Object.entries(response.headers)) {
					for (const item of Array.isArray(value) ? value : [value]) if (item !== undefined) headers.append(key, item);
				}
				resolve(new Response(chunks.length ? Buffer.concat(chunks) : null, { status: response.statusCode, headers }));
			});
		});
		request.on("error", reject); request.end(payload);
	});
}
const request = (path, options) => nativeRequest(base + path, options);
const login = (body = { email: owner.email, password }, headers = {}, path = "/auth/mobile/login") =>
	request(path, { method: "POST", body, headers });
async function tokenFor(user = owner) {
	const response = await login({ email: user.email, password });
	assert.equal(response.status, 200);
	return (await response.json()).data.token;
}
const me = token => request("/users/me", { headers: { Authorization: `Bearer ${token}` } });
function noCookies(response) { assert.equal(response.headers.get("set-cookie"), null); }

test("existing account receives a private one-hour JWT response without any cookie or private user fields", async () => {
	const response = await login({ email: `  ${owner.email.toUpperCase()}  `, password });
	assert.equal(response.status, 200); noCookies(response);
	assert.equal(response.headers.get("cache-control"), "private, no-store");
	const body = await response.json(), claims = jwt.verify(body.data.token, secret, { algorithms: ["HS256"] });
	assert.equal(body.status, "success");
	assert.equal(body.data.user._id, owner.id);
	assert.equal(claims.id, owner.id); assert.equal(claims.sessionType, "mobile");
	assert.equal(claims.exp - claims.iat, 3600);
	assert.equal(new Date(body.data.expiresAt).getTime(), claims.exp * 1000);
	assert.match(claims.jti, /^[a-f0-9]{64}$/);
	assert.equal(claims.credentialAttempt, undefined);
	assert.ok(Object.keys(body.data.user).every(key => ["_id", "name", "email", "role", "photo", "avatar", "theme", "language", "totalXp", "createdAt", "updatedAt"].includes(key)));
	assert.equal((await me(body.data.token)).status, 200);
	assert.equal(await User.countDocuments(), 3);
});

test("wrong password, missing account and Google-only account have identical generic credential errors and bcrypt work", async t => {
	const compare = t.mock.method(User.prototype, "correctPassword");
	let expected;
	for (const email of [owner.email, "missing@example.test", google.email]) {
		const response = await login({ email, password: "incorrect-test-password" });
		assert.equal(response.status, 401); noCookies(response);
		const body = await response.json();
		if (expected) assert.deepEqual(body, expected); else expected = body;
		assert.deepEqual(body, { status: "fail", message: "Incorrect email or password." });
	}
	assert.equal(compare.mock.callCount(), 3);
	assert.ok(compare.mock.calls.every(call => typeof call.arguments[1] === "string" && call.arguments[1].startsWith("$2b$12$")));
});

test("rejects invalid types, extra fields, Mongo operators, empty input and passwords over 72 UTF-8 bytes", async t => {
	const lookup = t.mock.method(User, "findOne", () => { throw new Error("Invalid input reached account lookup"); });
	for (const body of [
		{}, [], null, { email: owner.email }, { email: "bad-email", password },
		{ email: { $ne: null }, password }, { email: [owner.email], password },
		{ email: owner.email, password: { $ne: null } }, { email: owner.email, password: 123 },
		{ email: owner.email, password: "" }, { email: owner.email, password: "a".repeat(73) },
		{ email: owner.email, password: "é".repeat(37) }, { email: owner.email, password, role: "admin" },
	]) {
		const response = await login(body); assert.equal(response.status, 400); noCookies(response);
	}
	assert.equal(lookup.mock.callCount(), 0);
	const malformed = await request("/auth/mobile/login", { method: "POST", raw: '{"email":' });
	assert.equal(malformed.status, 400); noCookies(malformed);
});

test("native exception is exact and rejects browser headers, cookies, form bodies and route variants", async () => {
	for (const headers of [
		{ Origin: frontend }, { Origin: "https://attacker.test" }, { Origin: "null" },
		{ Referer: `${frontend}/login` }, { Cookie: "jwt=synthetic-cookie" }, { Cookie: "" },
		{ "Sec-Fetch-Site": "same-origin" }, { "Sec-Fetch-Site": "cross-site" },
		{ "Sec-Fetch-Mode": "cors" }, { "Sec-Fetch-Dest": "empty" }, { "Sec-Fetch-User": "?1" },
		{ "Content-Type": "text/plain" }, { "Content-Type": "application/x-www-form-urlencoded" },
		{ "Content-Type": undefined }, { "X-Mobile-App": "StudyJony", Origin: "https://attacker.test" },
	]) {
		const response = await login(undefined, headers); assert.equal(response.status, 403); noCookies(response);
	}
	for (const path of ["/auth/mobile/login/", "/auth/mobile/Login", "/auth/mobile/login?extra=1", "/auth/mobile/signup", "/auth/mobile/logout", "/auth/login", "/auth/credentials/login"]) {
		const response = await login(undefined, {}, path); assert.equal(response.status, 403); noCookies(response);
	}
	const allowed = await login(undefined, { "Content-Type": "application/json; charset=utf-8" });
	assert.equal(allowed.status, 200); noCookies(allowed);
});

test("Bearer headers cannot bypass the mobile route's native guard and web CSRF stays enforced", async () => {
	const token = await tokenFor();
	for (const headers of [{ Origin: "https://attacker.test" }, { Cookie: "jwt=synthetic-cookie" }, { "Sec-Fetch-Site": "cross-site" }]) {
		const response = await login(undefined, { Authorization: `Bearer ${token}`, ...headers });
		assert.equal(response.status, 403); noCookies(response);
	}
	for (const path of ["/auth/credentials/login", "/auth/login", "/auth/logout", "/vocab"]) {
		const response = await request(path, { method: "POST", body: { email: owner.email, password }, headers: { Origin: "https://attacker.test", Authorization: `Bearer ${token}` } });
		assert.equal(response.status, 403); noCookies(response);
	}
});

test("mobile JWTs reuse protected vocabulary ownership and cannot authenticate through web cookies", async () => {
	await Vocab.create([{ user: owner.id, english: "water", vietnamese: "nước" }, { user: other.id, english: "book", vietnamese: "sách" }]);
	const token = await tokenFor();
	const response = await request("/vocab", { headers: { Authorization: `Bearer ${token}` } });
	assert.equal(response.status, 200);
	const words = (await response.json()).data.vocabularies;
	assert.equal(words.length, 1); assert.equal(words[0].user, owner.id);
	assert.equal((await request("/users/me", { headers: { Cookie: `jwt=${token}` } })).status, 401);
	assert.equal((await request("/vocab")).status, 401);
});

test("expired, tampered and revoked mobile tokens fail, and revoking one leaves another session valid", async () => {
	const first = await tokenFor(), second = await tokenFor();
	assert.ok(first !== second);
	const claims = jwt.verify(first, secret);
	const expired = jwt.sign({ ...claims, exp: claims.iat - 1 }, secret);
	const segments = first.split(".");
	segments[2] = (segments[2][0] === "a" ? "b" : "a") + segments[2].slice(1);
	for (const token of [expired, segments.join("."), "invalid-token"]) assert.equal((await me(token)).status, 401);
	await sessionRevocation.revoke(first, claims);
	assert.equal((await me(first)).status, 401); assert.equal((await me(second)).status, 200);
	assert.equal(await RevokedSession.countDocuments(), 1);
});

test("password changes invalidate mobile JWTs and fresh login carries the new password-session version", async () => {
	const oldToken = await tokenFor();
	owner.password = "replacement-test-password"; owner.passwordConfirm = owner.password;
	await owner.save();
	assert.equal((await me(oldToken)).status, 401);
	const response = await login({ email: owner.email, password: "replacement-test-password" });
	assert.equal(response.status, 200); noCookies(response);
	const token = (await response.json()).data.token, claims = jwt.verify(token, secret);
	assert.equal(claims.passwordChangedAt, owner.passwordChangedAt.getTime());
	assert.equal(claims.passwordSessionVersion, owner.passwordSessionVersion);
	assert.equal((await me(token)).status, 200);
});

test("per-account limits normalize email and count unknown accounts without leaking account existence", async t => {
	t.mock.method(User.prototype, "correctPassword", async () => false);
	for (const email of [owner.email, "missing@example.test", google.email]) {
		for (let index = 0; index < mobileLoginPolicy.accountLimit; index++) {
			assert.equal((await login({ email: index % 2 ? ` ${email.toUpperCase()} ` : email, password })).status, 401);
		}
		const blocked = await login({ email, password });
		assert.equal(blocked.status, 429); assert.ok(Number(blocked.headers.get("retry-after")) > 0); noCookies(blocked);
	}
});

test("IP limit uses the Nginx-appended client and forged header prefixes cannot reset it", async t => {
	t.mock.method(User.prototype, "correctPassword", async () => false);
	for (let index = 0; index < mobileLoginPolicy.peerLimit; index++) {
		// Model the final upstream header produced by proxy_add_x_forwarded_for:
		// user-supplied values first, the actual Nginx connection source last.
		const response = await login({ email: `probe${index}@example.test`, password }, {
			"X-Forwarded-For": `192.0.2.${index + 1}, 203.0.113.20`,
			"X-Real-IP": `192.0.2.${index + 1}`, Forwarded: `for=192.0.2.${index + 1}`,
		});
		assert.equal(response.status, 401);
	}
	const blocked = await login({ email: "last@example.test", password }, { "X-Forwarded-For": "127.0.0.1, 198.51.100.1, 203.0.113.20" });
	assert.equal(blocked.status, 429); assert.ok(Number(blocked.headers.get("retry-after")) > 0); noCookies(blocked);
	// The same Nginx socket peer must not force all external clients to share it.
	assert.equal((await login({ email: "other-client@example.test", password }, { "X-Forwarded-For": "192.0.2.99, 203.0.113.21" })).status, 401);
	assert.equal((await login({ email: "still-blocked@example.test", password }, { "X-Forwarded-For": "203.0.113.20" })).status, 429);
	const counters = await MobileLoginWindow.find().lean();
	assert.ok(counters.every(counter => /^[a-f0-9]{64}$/.test(counter._id)));
	assert.ok(!JSON.stringify(counters).includes("example.test"));
});

test("independent limiter instances share atomic counters and new windows work before TTL cleanup", async t => {
	const start = Math.floor(Date.now() / 1000) * 1000 + 60000;
	let clock = start + 100;
	const options = { windowMs: 1000, peerLimit: 100, accountLimit: 2, now: () => clock };
	const listeners = [];
	for (let index = 0; index < 2; index++) {
		const app = express(); app.use(express.json());
		app.post("/api/v1/auth/mobile/login", requireMobileLoginRequest, createMobileLoginRateLimit(options), (_req, res) => res.status(204).end());
		app.use(errorHandler); listeners.push(await listen(app));
	}
	t.after(async () => { await Promise.all(listeners.map(listener => new Promise(resolve => listener.close(resolve)))); });
	const send = index => nativeRequest(`http://127.0.0.1:${listeners[index % 2].address().port}/api/v1/auth/mobile/login`, {
		method: "POST", body: { email: owner.email, password },
	});
	const responses = await Promise.all(Array.from({ length: 8 }, (_, index) => send(index)));
	assert.equal(responses.filter(response => response.status === 204).length, 2);
	assert.equal(responses.filter(response => response.status === 429).length, 6);
	clock = start + 1100;
	assert.equal((await send(0)).status, 204); assert.equal((await send(1)).status, 204);
});

test("account budgets remain shared across different clients behind Nginx", async t => {
	t.mock.method(User.prototype, "correctPassword", async () => false);
	for (let index = 0; index < mobileLoginPolicy.accountLimit; index++) {
		assert.equal((await login(undefined, { "X-Forwarded-For": `198.51.100.${index + 1}` })).status, 401);
	}
	assert.equal((await login(undefined, { "X-Forwarded-For": "198.51.100.200" })).status, 429);
	// Malformed selected IPs must never reach the persistent counter or password check.
	const writes = t.mock.method(MobileLoginWindow, "findOneAndUpdate", () => { throw new Error("Unexpected counter write"); });
	const invalid = await login(undefined, { "X-Forwarded-For": "198.51.100.1:1234" });
	assert.equal(invalid.status, 503); noCookies(invalid); assert.equal(writes.mock.callCount(), 0);
});

test("unavailable rate-limit storage, invalid frontend config and missing signing config fail closed", async t => {
	const counter = t.mock.method(MobileLoginWindow, "findOneAndUpdate", async () => { throw new Error("Synthetic database failure"); });
	const unavailable = await login(); assert.equal(unavailable.status, 503); noCookies(unavailable);
	assert.deepEqual(await unavailable.json(), { status: "error", message: "Sign-in is temporarily unavailable. Please try again later." });
	counter.mock.restore();
	delete process.env.FRONTEND_URL;
	const noFrontend = await login(); assert.equal(noFrontend.status, 500); noCookies(noFrontend);
	process.env.FRONTEND_URL = frontend; delete process.env.JWT_SECRET;
	const noSecret = await login(); assert.equal(noSecret.status, 500); noCookies(noSecret);
});

test("mobile attempts do not consume the existing web login quota or change cookie session behavior", async t => {
	const compare = t.mock.method(User.prototype, "correctPassword", async () => false);
	for (let index = 0; index < 35; index++) assert.equal((await login({ email: `quota${index}@example.test`, password })).status, 401);
	compare.mock.restore();
	const attempt = "a".repeat(32);
	const web = await request("/auth/credentials/login", { method: "POST", body: { email: owner.email, password }, headers: { Origin: frontend, "X-StudyJony-Auth-Attempt": attempt } });
	assert.equal(web.status, 200);
	const cookies = web.headers.getSetCookie(); assert.equal(cookies.length, 1);
	assert.ok(cookies[0].startsWith(`sj_auth_${attempt}=`) && /HttpOnly/.test(cookies[0]) && /Secure/.test(cookies[0]));
	const webBody = await web.json(); assert.equal(webBody.data.credentialAttempt, attempt); assert.equal(webBody.data.token, undefined);
	const cookie = `sj_auth_session=${attempt}; ${cookies[0].split(";")[0]}`;
	const mobile = await tokenFor();
	await sessionRevocation.revoke(mobile, jwt.verify(mobile, secret));
	assert.equal((await me(mobile)).status, 401);
	assert.equal((await request("/users/me", { headers: { Cookie: cookie } })).status, 200);
	const logout = await request("/auth/logout", { method: "POST", headers: { Origin: frontend, Cookie: cookie } });
	assert.equal(logout.status, 200);
	assert.equal((await request("/users/me", { headers: { Cookie: cookie } })).status, 401);
});

test("success and failure paths do not log tokens, passwords or account identifiers", async t => {
	const logs = ["log", "warn", "error"].map(method => t.mock.method(console, method, () => {}));
	assert.equal((await login()).status, 200);
	assert.equal((await login({ email: owner.email, password: "incorrect-test-password" })).status, 401);
	assert.equal((await login({ email: "missing@example.test", password })).status, 401);
	assert.ok(logs.every(log => log.mock.callCount() === 0));
});
