const assert = require("node:assert/strict");
const { test, before, after, beforeEach } = require("node:test");
const express = require("express");
const cookieParser = require("cookie-parser");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { OAuth2Client } = require("google-auth-library");
const User = require("../models/userModel");
const Topic = require("../models/topicModel");
const Vocabulary = require("../models/vocabModel");

let db, server, url;
const environment = { NODE_ENV: "development", JWT_SECRET: "isolated-google-identity-secret", JWT_EXPIRES_IN: "1h", FRONTEND_URL: "http://studyjony.test", GOOGLE_CLIENT_ID: "isolated-client", GOOGLE_CLIENT_SECRET: "isolated-secret", GOOGLE_REDIRECT_URI: "http://studyjony.test/api/v1/auth/google/callback" };
const previousEnv = Object.fromEntries(Object.keys(environment).map(key => [key, process.env[key]]));
const email = "learner@example.com", password = "original-password";
const claims = { email, email_verified: true, sub: "verified-google-subject", name: "Google Learner" };

before(async () => {
	Object.assign(process.env, environment);
	db = await MongoMemoryServer.create({ binary: { version: "7.0.14" } });
	await mongoose.connect(db.getUri(), { dbName: "google_identity_test" });
	await User.init();
	const app = express();
	app.use(express.json(), cookieParser());
	app.use("/api/v1/auth", require("../routes/authRoutes"));
	app.use("/api/v1/users", require("../routes/userRoutes"));
	app.use((error, req, res, next) => res.status(error.statusCode || 500).json({ status: "fail", message: "Request failed" }));
	server = await new Promise(resolve => { const listener = app.listen(0, "127.0.0.1", () => resolve(listener)); });
	url = `http://127.0.0.1:${server.address().port}/api/v1`;
}, { timeout: 180000 });
after(async () => {
	if (server) await new Promise(resolve => server.close(resolve));
	await mongoose.disconnect(); await db?.stop();
	for (const [key, value] of Object.entries(previousEnv)) {
		if (value === undefined) delete process.env[key]; else process.env[key] = value;
	}
});
beforeEach(async () => { await User.deleteMany({}); await Topic.deleteMany({}); await Vocabulary.deleteMany({}); });

const request = (path, { method = "GET", body, token } = {}) => fetch(url + path, {
	method, headers: { "Content-Type": "application/json", ...(token ? { Cookie: `jwt=${token}` } : {}) },
	...(body ? { body: JSON.stringify(body) } : {}),
});
const tokenFrom = response => {
	const token = response.headers.get("set-cookie")?.match(/(?:^|, )jwt=([^;]+)/)?.[1];
	assert.ok(token, "A successful login issues a JWT"); return token;
};
const login = (value = password) => request("/auth/login", { method: "POST", body: { email, password: value } });
const signup = (extra = {}) => request("/auth/signup", { method: "POST", body: { name: "Password Learner", email, password, passwordConfirm: password, ...extra } });
function mockGoogle(t, payload = claims) {
	t.mock.method(console, "error", () => {});
	t.mock.method(OAuth2Client.prototype, "getToken", async () => ({ tokens: { id_token: "mock-id-token" } }));
	t.mock.method(OAuth2Client.prototype, "verifyIdToken", async options => {
		assert.equal(options.audience, environment.GOOGLE_CLIENT_ID);
		return { getPayload: () => payload };
	});
}
const callback = (locale = "en", token) => fetch(`${url}/auth/google/callback?state=test-state&code=mock-code`, {
	redirect: "manual", headers: { Cookie: `google_oauth_state=test-state; google_oauth_locale=${locale}${token ? `; jwt=${token}` : ""}` },
});
function assertCallback(response, error, locale = "en") {
	assert.equal(response.status, 303);
	assert.equal(response.headers.get("location"), `http://studyjony.test${locale === "en" ? "/en" : ""}/oauth/google/callback${error ? `?error=${error}` : ""}`);
	assert.match(response.headers.get("set-cookie"), /google_oauth_state=;/);
	if (error) assert.doesNotMatch(response.headers.get("set-cookie"), /(?:^|, )jwt=/, "Failure neither authenticates nor clears an unrelated session");
}
async function assertMe(token, id, status = 200) {
	const response = await request("/users/me", { token }); assert.equal(response.status, status);
	if (status === 200) assert.equal((await response.json()).data.user._id, id);
}

for (const locale of ["vi", "en"]) test(`${locale}: pre-registered email never becomes a Google-owned identity or links even with its existing cookie`, async t => {
	const registered = await signup(); assert.equal(registered.status, 201);
	const attackerToken = tokenFrom(registered), user = await User.findOne({ email }).select("+password");
	const topic = await Topic.create({ name: "Existing learning", user: user.id });
	await Vocabulary.create({ english: "apple", vietnamese: "fruit", user: user.id, topic: topic.id });
	mockGoogle(t);
	for (const token of [undefined, attackerToken]) assertCallback(await callback(locale, token), "google_account_conflict", locale);
	const stored = await User.findById(user.id).select("+password");
	assert.equal(stored.googleId, undefined); assert.equal(stored.password, user.password);
	assert.equal(stored.passwordSessionVersion, user.passwordSessionVersion);
	assert.equal(await User.countDocuments(), 1); assert.equal(await Topic.countDocuments(), 1); assert.equal(await Vocabulary.countDocuments(), 1);
	// The rejected collision remains a separate password account, never a victim Google account.
	await assertMe(attackerToken, user.id);
	assert.equal((await login()).status, 200);
});

test("normal signup ignores injected Google identity, role and session-version fields", async () => {
	const response = await signup({ googleId: claims.sub, role: "admin", passwordSessionVersion: "injected" });
	assert.equal(response.status, 201);
	const user = await User.findOne({ email });
	assert.equal(user.googleId, undefined); assert.equal(user.role, "user"); assert.equal(user.passwordSessionVersion, undefined);
	await assertMe(tokenFrom(response), user.id);
	await assertMe(tokenFrom(await login()), user.id);
	assert.equal((await login("wrong-password")).status, 401);
});

for (const locale of ["vi", "en"]) test(`${locale}: normal Google signup/login restores the same Google-only account and logout clears the browser session`, async t => {
	mockGoogle(t, { ...claims, email: "LEARNER@example.com" });
	const first = await callback(locale); assertCallback(first, null, locale);
	const user = await User.findOne({ email }).select("+password");
	assert.equal(user.googleId, claims.sub); assert.equal(user.password, undefined);
	await assertMe(tokenFrom(first), user.id);
	const second = await callback(locale); assertCallback(second, null, locale);
	await assertMe(tokenFrom(second), user.id); assert.equal(await User.countDocuments(), 1);
	assert.equal((await login()).status, 401, "A password cannot access the Google-owned identity");
	const logout = await request("/auth/logout", { method: "POST", token: tokenFrom(second) });
	assert.equal(logout.status, 200); await assertMe(tokenFrom(second), user.id, 401);
	await assertMe(undefined, undefined, 401);
});

for (const withPassword of [false, true]) test(`existing bound account (password: ${withPassword}) only accepts its matching subject`, async t => {
	const user = await User.create({ name: "Chosen name", email, googleId: claims.sub, ...(withPassword ? { password, passwordConfirm: password } : {}) });
	mockGoogle(t);
	const success = await callback(); assertCallback(success); await assertMe(tokenFrom(success), user.id);
	assert.equal((await User.findById(user.id)).name, "Chosen name");
	assert.equal((await login()).status, withPassword ? 200 : 401);
	t.mock.restoreAll(); mockGoogle(t, { ...claims, sub: "different-subject" });
	assertCallback(await callback(), "google_account_conflict");
	assert.equal((await User.findById(user.id)).googleId, claims.sub); assert.equal(await User.countDocuments(), 1);
});

test("subject takes priority when provider email changes or now matches a different password account", async t => {
	const google = await User.create({ name: "Google Learner", email: "old@example.com", googleId: claims.sub });
	const passwordAccount = await User.create({ name: "Password Learner", email, password, passwordConfirm: password });
	mockGoogle(t);
	const response = await callback(); assertCallback(response); await assertMe(tokenFrom(response), google.id);
	assert.equal((await User.findById(google.id)).email, "old@example.com");
	assert.equal((await User.findById(passwordAccount.id)).googleId, undefined);
	assert.equal(await User.countDocuments(), 2);
});

test("another bound account's email cannot override the authenticated subject", async t => {
	const subjectOwner = await User.create({ name: "Subject Owner", email: "original@example.com", googleId: claims.sub });
	const other = await User.create({ name: "Other Owner", email, googleId: "other-google-subject" });
	mockGoogle(t);
	const response = await callback(); assertCallback(response);
	await assertMe(tokenFrom(response), subjectOwner.id);
	assert.equal((await User.findById(other.id)).googleId, "other-google-subject");
	assert.equal((await User.findById(subjectOwner.id)).email, "original@example.com");
});

for (const verification of [false, undefined, "true", 1]) test(`email_verified=${JSON.stringify(verification)} never authenticates a bound or new account`, async t => {
	const user = await User.create({ name: "Google Learner", email, googleId: claims.sub });
	mockGoogle(t, { ...claims, email_verified: verification });
	assertCallback(await callback(), "google_oauth_failed");
	assert.equal((await User.findById(user.id)).googleId, claims.sub);
	await User.deleteMany({});
	assertCallback(await callback(), "google_oauth_failed"); assert.equal(await User.countDocuments(), 0);
});

for (const invalid of [{ sub: "" }, { sub: null }, { sub: { $ne: null } }, { email: { $ne: null } }, { email: "invalid" }, { sub: " subject " }, { sub: "a".repeat(256) }]) test(`invalid identity claims ${JSON.stringify(invalid)} fail before account selection`, async t => {
	await User.create({ name: "Google Learner", email, googleId: claims.sub }); mockGoogle(t, { ...claims, ...invalid });
	assertCallback(await callback(), "google_oauth_failed"); assert.equal(await User.countDocuments(), 1);
});

test("duplicate legacy Google subjects require reconciliation; no arbitrary first account is authenticated", async t => {
	await User.create({ name: "First learner", email, googleId: claims.sub });
	await User.create({ name: "Second learner", email: "second@example.com", googleId: claims.sub });
	mockGoogle(t); assertCallback(await callback(), "google_account_conflict");
	assert.equal(await User.countDocuments(), 2);
});

test("racing new Google callbacks create one email record without authenticating a different identity", async t => {
	mockGoogle(t);
	const responses = await Promise.all([callback(), callback(), callback()]);
	const user = await User.findOne({ email }); assert.equal(await User.countDocuments(), 1);
	for (const response of responses) {
		const conflict = response.headers.get("location").includes("error=");
		assertCallback(response, conflict ? "google_account_conflict" : undefined);
		if (!conflict) await assertMe(tokenFrom(response), user.id);
	}
	assert.ok(responses.some(response => !response.headers.get("location").includes("error=")));
});

for (const withGoogle of [false, true]) test(`profile edits (Google: ${withGoogle}) cannot replace email or Google identity`, async t => {
	const user = await User.create({ name: "Learner", email, password, passwordConfirm: password, ...(withGoogle ? { googleId: claims.sub } : {}) });
	const token = tokenFrom(await login());
	for (const value of ["victim@example.com", null, { $ne: null }]) {
		const response = await request("/users/updateMe", { method: "PATCH", token, body: { email: value, name: "Changed name" } });
		assert.equal(response.status, 400); assert.equal((await response.json()).code, "emailChangeRequiresVerification");
		assert.equal((await User.findById(user.id)).name, "Learner");
	}
	const result = await request("/users/updateMe", { method: "PATCH", token, body: { name: "Changed name", email: " LEARNER@example.com ", googleId: "attacker-subject" } });
	assert.equal(result.status, 200);
	const stored = await User.findById(user.id);
	assert.equal(stored.email, email); assert.equal(stored.name, "Changed name"); assert.equal(stored.googleId, withGoogle ? claims.sub : undefined);
	await assertMe(token, user.id);
});

test("bound dual-method account retains password session invalidation across Google login", async t => {
	const user = await User.create({ name: "Learner", email, googleId: claims.sub, password, passwordConfirm: password });
	mockGoogle(t);
	const passwordToken = tokenFrom(await login()), googleToken = tokenFrom(await callback());
	const response = await request("/users/updatePassword", { method: "PATCH", token: passwordToken, body: { passwordCurrent: password, password: "replacement-password", passwordConfirm: "replacement-password" } });
	assert.equal(response.status, 200);
	await assertMe(passwordToken, user.id, 401); await assertMe(googleToken, user.id, 401);
	await assertMe(tokenFrom(response), user.id); await assertMe(tokenFrom(await callback()), user.id);
});

test("verified recovery of a collision revokes attacker password/tokens but never silently binds Google", async t => {
	const initial = await signup(), token = tokenFrom(initial), user = await User.findOne({ email });
	mockGoogle(t); assertCallback(await callback(), "google_account_conflict");
	// Simulate possession of a properly delivered recovery token; no real mail/provider is contacted.
	const resetToken = user.createPasswordResetToken(); await user.save({ validateBeforeSave: false });
	t.mock.method(console, "log", () => {});
	const recovered = await request(`/users/resetPassword/${resetToken}`, { method: "PATCH", body: { password: "owner-only-password", passwordConfirm: "owner-only-password" } });
	assert.equal(recovered.status, 200);
	await assertMe(token, user.id, 401); assert.equal((await login()).status, 401);
	await assertMe(tokenFrom(recovered), user.id); assert.equal((await login("owner-only-password")).status, 200);
	assert.equal((await User.findById(user.id)).googleId, undefined);
	assertCallback(await callback(), "google_account_conflict");
});
