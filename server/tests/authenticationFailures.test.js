const assert = require("node:assert/strict");
const { test, before, after, beforeEach } = require("node:test");
const mongoose = require("mongoose");
const express = require("express");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { OAuth2Client } = require("google-auth-library");
const { MongoMemoryServer } = require("mongodb-memory-server");
const User = require("../models/userModel");
const errorHandler = require("../controllers/errorController");
let db, server, url, normal, google;
const secret = "isolated-authentication-failures-secret";
const previousEnv = Object.fromEntries(["JWT_SECRET", "JWT_EXPIRES_IN", "NODE_ENV", "FRONTEND_URL"].map(key => [key, process.env[key]]));
before(async () => {
	Object.assign(process.env, { JWT_SECRET: secret, JWT_EXPIRES_IN: "1h", NODE_ENV: "development", FRONTEND_URL: "http://studyjony.test" });
	db = await MongoMemoryServer.create({ binary: { version: "7.0.14" } });
	await mongoose.connect(db.getUri(), { dbName: "authentication_failures_test" });
	await User.init();
	const app = express();
	app.use(express.json(), cookieParser());
	app.use("/api/v1/auth", require("../routes/authRoutes"));
	app.use("/api/v1/users", require("../routes/userRoutes"));
	app.use(errorHandler); // Exercise the real development and production error paths.
	server = await new Promise(resolve => { const listener = app.listen(0, "127.0.0.1", () => resolve(listener)); });
	url = `http://127.0.0.1:${server.address().port}/api/v1`;
}, { timeout: 180000 });
after(async () => {
	if (server) await new Promise(resolve => server.close(resolve));
	await mongoose.disconnect(); await db?.stop();
	for (const [key, value] of Object.entries(previousEnv)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
});
beforeEach(async () => {
	process.env.NODE_ENV = "development"; process.env.JWT_SECRET = secret;
	await User.deleteMany({});
	normal = await User.create({ name: "Normal learner", email: "normal@example.com", password: "password-123", passwordConfirm: "password-123" });
	google = await User.create({ name: "Google learner", email: "google@example.com", googleId: "test-google-id" });
});
const request = (path, { method = "GET", body, token, cookie = false } = {}) => fetch(url + path, {
	method, headers: { "Content-Type": "application/json", ...(token ? cookie ? { Cookie: `jwt=${token}` } : { Authorization: `Bearer ${token}` } : {}) },
	...(body ? { body: JSON.stringify(body) } : {}),
});
const login = (email, password = "password-123") => request("/auth/login", { method: "POST", body: { email, password } });
const cookieToken = response => response.headers.get("set-cookie").match(/jwt=([^;]+)/)[1];
test("normal password login creates a valid session and wrong/unknown/Google-only logins share one 401 response", async () => {
	process.env.NODE_ENV = "production";
	const success = await login(normal.email);
	assert.equal(success.status, 200); assert.equal((await success.json()).data.user.password, undefined);
	assert.equal((await request("/users/me", { token: cookieToken(success), cookie: true })).status, 200);
	let expected;
	for (const [email, password] of [[normal.email, "wrong-password"], ["unknown@example.com", "password-123"], [google.email, "password-123"]]) {
		const response = await login(email, password); assert.equal(response.status, 401);
		const body = await response.json();
		assert.equal(body.status, "fail"); assert.match(body.message, /không chính xác/);
		assert.equal(response.headers.get("set-cookie"), null);
		if (expected) assert.deepEqual(body, expected); else expected = body;
	}
});
test("no missing/empty hash ever reaches bcrypt, including Google-only password login", async t => {
	const compare = t.mock.method(bcrypt, "compare", () => { throw new Error("bcrypt must not receive a missing hash"); });
	for (const hash of [undefined, null, "", 42]) assert.equal(await google.correctPassword("password-123", hash), false);
	assert.equal((await login(google.email)).status, 401);
	assert.equal(compare.mock.callCount(), 0);
});
for (const locale of ["vi", "en"]) test(`${locale}: Google-only account still logs in through OAuth and restores its session`, async t => {
	t.mock.method(OAuth2Client.prototype, "getToken", async () => ({ tokens: { id_token: "test-id-token" } }));
	t.mock.method(OAuth2Client.prototype, "verifyIdToken", async () => ({ getPayload: () => ({ email: google.email, name: google.name, sub: google.googleId }) }));
	const response = await fetch(`${url}/auth/google/callback?state=test-state&code=test-code`, { redirect: "manual", headers: { Cookie: `google_oauth_state=test-state; google_oauth_locale=${locale}` } });
	assert.equal(response.status, 303);
	assert.equal(response.headers.get("location"), `http://studyjony.test/${locale === "en" ? "en/" : ""}oauth/google/callback`);
	const me = await request("/users/me", { token: cookieToken(response), cookie: true });
	assert.equal(me.status, 200); assert.equal((await me.json()).data.user._id, google.id);
	assert.equal(await User.countDocuments(), 2);
});
for (const environment of ["development", "production"]) test(`${environment}: expired, malformed, tampered and invalid JWT claims are controlled 401 for cookies and Bearer headers`, async () => {
	process.env.NODE_ENV = environment;
	const tokens = [
		jwt.sign({ id: normal.id }, secret, { expiresIn: -1 }), "not-a-jwt", "bad.payload.signature",
		jwt.sign({ id: normal.id }, "wrong-secret", { expiresIn: "1h" }),
		jwt.sign({ id: normal.id }, secret, { notBefore: "1h" }),
		jwt.sign({ id: "not-an-object-id" }, secret), jwt.sign({}, secret), jwt.sign({ id: 42 }, secret),
	];
	for (const token of tokens) for (const cookie of [false, true]) {
		const response = await request("/users/me", { token, cookie });
		assert.equal(response.status, 401);
		const body = await response.json();
		assert.equal(body.status, "fail"); assert.equal(body.message, "Invalid or expired session. Please log in again.");
		assert.doesNotMatch(JSON.stringify(body), /TokenExpiredError|JsonWebTokenError|NotBeforeError|jwt expired|invalid signature|jwt malformed/);
		if (environment === "production") assert.deepEqual(Object.keys(body).sort(), ["message", "status"]);
	}
	assert.equal((await request("/users/me")).status, 401);
});
test("valid JWT restores the user; logout clears its cookie and the next unauthenticated request is 401", async () => {
	const response = await login(normal.email), token = cookieToken(response);
	for (const cookie of [false, true]) {
		const me = await request("/users/me", { token, cookie });
		assert.equal(me.status, 200); assert.equal((await me.json()).data.user._id, normal.id);
	}
	const logout = await request("/auth/logout", { method: "POST", token, cookie: true });
	assert.equal(logout.status, 200); assert.match(logout.headers.get("set-cookie"), /jwt=;/);
	assert.equal((await request("/users/me")).status, 401);
});
test("database failures, unexpected verifier failures and missing JWT configuration stay 500", async t => {
	const token = jwt.sign({ id: normal.id }, secret);
	const database = t.mock.method(User, "findById", async () => { throw new Error("Simulated internal database failure"); });
	assert.equal((await request("/users/me", { token })).status, 500); database.mock.restore();
	const verifier = t.mock.method(jwt, "verify", () => { throw new Error("Simulated internal verifier failure"); });
	assert.equal((await request("/users/me", { token })).status, 500); verifier.mock.restore();
	delete process.env.JWT_SECRET;
	assert.equal((await request("/users/me", { token })).status, 500);
});
