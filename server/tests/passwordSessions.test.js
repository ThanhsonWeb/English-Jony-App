const assert = require("node:assert/strict");
const { test, before, after, beforeEach } = require("node:test");
const mongoose = require("mongoose");
const express = require("express");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { OAuth2Client } = require("google-auth-library");
const User = require("../models/userModel");
let db, server, url;
const originalEnv = { JWT_SECRET: process.env.JWT_SECRET, JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN, NODE_ENV: process.env.NODE_ENV, FRONTEND_URL: process.env.FRONTEND_URL };

before(async () => {
	process.env.JWT_SECRET = "isolated-password-session-test";
	process.env.JWT_EXPIRES_IN = "1h";
	process.env.NODE_ENV = "development";
	process.env.FRONTEND_URL = "http://studyjony.test";
	db = await MongoMemoryServer.create({ binary: { version: "7.0.14" } });
	await mongoose.connect(db.getUri(), { dbName: "password_sessions_test" });
	await User.init();
	const app = express();
	app.use(express.json(), cookieParser());
	app.use("/api/v1/auth", require("../routes/authRoutes"));
	app.use("/api/v1/users", require("../routes/userRoutes"));
	app.use((error, req, res, next) => res.status(error.statusCode || (error.name === "ValidationError" ? 400 : 500)).json({ message: error.message }));
	server = await new Promise(resolve => { const listener = app.listen(0, "127.0.0.1", () => resolve(listener)); });
	url = `http://127.0.0.1:${server.address().port}/api/v1`;
}, { timeout: 180000 });
after(async () => {
	if (server) await new Promise(resolve => server.close(resolve));
	await mongoose.disconnect();
	await db?.stop();
	for (const [key, value] of Object.entries(originalEnv)) {
		if (value === undefined) delete process.env[key]; else process.env[key] = value;
	}
});
beforeEach(() => User.deleteMany({}));

const password = "original-password";
const email = "session@example.com";
const request = (path, method = "GET", body, token, cookie = false) => fetch(url + path, {
	method,
	headers: { "Content-Type": "application/json", ...(token ? cookie ? { Cookie: `jwt=${token}` } : { Authorization: `Bearer ${token}` } : {}) },
	...(body ? { body: JSON.stringify(body) } : {}),
});
function sessionToken(response) {
	const header = response.headers.get("set-cookie");
	assert.match(header, /HttpOnly/i);
	assert.match(header, /SameSite=Lax/i);
	assert.match(header, /Path=\//i);
	return header.match(/jwt=([^;]+)/)[1];
}
async function signup() {
	const response = await request("/auth/signup", "POST", { name: "Learner", email, password, passwordConfirm: password });
	assert.equal(response.status, 201);
	assert.equal((await response.json()).data.user.password, undefined);
	return sessionToken(response);
}
async function assertSession(token, status) {
	for (const cookie of [false, true]) {
		assert.equal((await request("/users/me", "GET", undefined, token, cookie)).status, status);
	}
}
const update = (token, current, next) => request("/users/updatePassword", "PATCH", {
	passwordCurrent: current, password: next, passwordConfirm: next,
}, token);

test("signup, login and session restore keep working; profile saves do not revoke sessions", async () => {
	const token = await signup();
	assert.equal((await User.findOne({ email })).passwordChangedAt, undefined);
	await assertSession(token, 200);
	const legacy = jwt.sign({ id: (await User.findOne({ email })).id }, process.env.JWT_SECRET, { expiresIn: "1h" });
	await assertSession(legacy, 200);
	assert.equal((await request("/users/updateMe", "PATCH", { name: "Updated learner" }, token)).status, 200);
	const user = await User.findOne({ email });
	user.theme = "dark";
	await user.save({ validateBeforeSave: false });
	assert.equal(user.passwordChangedAt, undefined);
	await assertSession(token, 200);
	const login = await request("/auth/login", "POST", { email, password });
	assert.equal(login.status, 200);
	await assertSession(sessionToken(login), 200);
	const logout = await request("/auth/logout", "POST", undefined, token, true);
	assert.equal(logout.status, 200);
	await assertSession(token, 401);
	assert.equal((await request("/users/me")).status, 401);
});

for (const milliseconds of [0, 500]) {
	test(`password update rejects old sessions and accepts new sessions in the same JWT second (+${milliseconds}ms)`, async t => {
		const frozen = Math.floor(Date.now() / 1000) * 1000 + milliseconds;
		t.mock.method(Date, "now", () => frozen);
		const oldToken = await signup();
		const response = await update(oldToken, password, "replacement-password");
		assert.equal(response.status, 200);
		const newToken = sessionToken(response);
		assert.equal(jwt.decode(oldToken).iat, jwt.decode(newToken).iat);
		const user = await User.findOne({ email });
		assert.equal(user.passwordChangedAt.getTime(), frozen);
		assert.equal(jwt.decode(newToken).passwordChangedAt, frozen);
		assert.equal(jwt.decode(newToken).passwordSessionVersion, user.passwordSessionVersion);
		await assertSession(oldToken, 401);
		await assertSession(newToken, 200);
		const oldLogin = await request("/auth/login", "POST", { email, password });
		assert.equal(oldLogin.status, 401);
		const freshLogin = await request("/auth/login", "POST", { email, password: "replacement-password" });
		assert.equal(freshLogin.status, 200);
		await assertSession(sessionToken(freshLogin), 200);
	});
}

test("repeated changes within one millisecond use distinct markers and revoke the previous replacement session", async t => {
	const frozen = Date.now();
	t.mock.method(Date, "now", () => frozen);
	const initial = await signup();
	const first = sessionToken(await update(initial, password, "second-password"));
	const secondResponse = await update(first, "second-password", "third-password");
	assert.equal(secondResponse.status, 200);
	const second = sessionToken(secondResponse);
	assert.equal(jwt.decode(second).passwordChangedAt, jwt.decode(first).passwordChangedAt + 1);
	assert.equal(jwt.decode(first).iat, jwt.decode(second).iat);
	await assertSession(initial, 401);
	await assertSession(first, 401);
	await assertSession(second, 200);
});

test("password reset revokes all earlier sessions, keeps the replacement session and consumes the reset token", async t => {
	const frozen = Math.floor(Date.now() / 1000) * 1000;
	t.mock.method(Date, "now", () => frozen);
	const oldToken = await signup();
	const user = await User.findOne({ email });
	const rawResetToken = user.createPasswordResetToken();
	await user.save({ validateBeforeSave: false });
	assert.equal(user.passwordChangedAt, undefined);
	await assertSession(oldToken, 200);
	const body = { password: "reset-password", passwordConfirm: "reset-password" };
	const reset = await request(`/users/resetPassword/${rawResetToken}`, "PATCH", body);
	assert.equal(reset.status, 200);
	const newToken = sessionToken(reset);
	assert.equal(jwt.decode(oldToken).iat, jwt.decode(newToken).iat);
	await assertSession(oldToken, 401);
	await assertSession(newToken, 200);
	assert.equal((await request(`/users/resetPassword/${rawResetToken}`, "PATCH", body)).status, 400);
	const saved = await User.findOne({ email }).select("+password");
	assert.equal(saved.passwordResetToken, undefined);
	assert.equal(saved.passwordResetExpires, undefined);
	assert.equal(await saved.correctPassword("reset-password", saved.password), true);
});

test("overlapping document saves with the same timestamp still revoke the earlier session", async t => {
	const frozen = Date.now();
	t.mock.method(Date, "now", () => frozen);
	const initial = await signup();
	// A second request can already have loaded the user before the first finishes.
	const stale = await User.findOne({ email }).select("+password");
	const first = sessionToken(await update(initial, password, "first-replacement"));
	stale.password = "second-replacement";
	stale.passwordConfirm = "second-replacement";
	await stale.save();
	assert.equal(stale.passwordChangedAt.getTime(), jwt.decode(first).passwordChangedAt);
	assert.notEqual(stale.passwordSessionVersion, jwt.decode(first).passwordSessionVersion);
	await assertSession(initial, 401);
	await assertSession(first, 401);
	const login = await request("/auth/login", "POST", { email, password: "second-replacement" });
	assert.equal(login.status, 200);
	await assertSession(sessionToken(login), 200);
});

for (const changedPassword of [false, true]) {
	test(`Google callback sessions retain password-change protection (changed password: ${changedPassword})`, async t => {
		if (changedPassword) {
			// An already-bound dual-method account; Google must not auto-link a password-only account.
			await User.create({ name: "Learner", email, googleId: "isolated-google-user", password, passwordConfirm: password });
			const initial = sessionToken(await request("/auth/login", "POST", { email, password }));
			assert.equal((await update(initial, password, "replacement-password")).status, 200);
		} else {
			await User.create({ name: "Learner", email, googleId: "isolated-google-user" });
		}
		t.mock.method(OAuth2Client.prototype, "getToken", async () => ({ tokens: { id_token: "isolated-id-token" } }));
		t.mock.method(OAuth2Client.prototype, "verifyIdToken", async () => ({ getPayload: () => ({ email, email_verified: true, name: "Learner", sub: "isolated-google-user" }) }));
		const response = await fetch(`${url}/auth/google/callback?state=isolated-state&code=isolated-code`, {
			redirect: "manual", headers: { Cookie: "google_oauth_state=isolated-state; google_oauth_locale=en" },
		});
		assert.equal(response.status, 303);
		assert.equal(response.headers.get("location"), "http://studyjony.test/en/oauth/google/callback");
		const token = sessionToken(response);
		const user = await User.findOne({ email });
		assert.equal(jwt.decode(token).passwordSessionVersion, user.passwordSessionVersion);
		await assertSession(token, 200);
	});
}

test("incorrect current password and failed validation leave existing sessions valid", async () => {
	const token = await signup();
	assert.equal((await update(token, "incorrect-password", "replacement-password")).status, 401);
	assert.equal((await request("/users/updatePassword", "PATCH", {
		passwordCurrent: password, password: "replacement-password", passwordConfirm: "different-password",
	}, token)).status, 400);
	assert.equal((await User.findOne({ email })).passwordChangedAt, undefined);
	await assertSession(token, 200);
});

test("legacy tokens use a conservative seconds boundary; stamped tokens require the exact saved marker", () => {
	const user = new User({ passwordChangedAt: new Date("2026-10-05T10:00:00.500Z") });
	const change = user.passwordChangedAt.getTime();
	const second = Math.floor(change / 1000);
	assert.equal(user.changedPasswordAfter(second - 1), true);
	assert.equal(user.changedPasswordAfter(second), true);
	assert.equal(user.changedPasswordAfter(second + 1), false);
	assert.equal(user.changedPasswordAfter(undefined), true);
	assert.equal(user.changedPasswordAfter(second, change), false);
	assert.equal(user.changedPasswordAfter(second, change - 1), true);
	assert.equal(user.changedPasswordAfter(second, change + 1), true);
});

for (const [name, expected] of [
	["Li", "Li (Google)"], ["Learner", "Learner"],
	["Alexander Montgomery Extra Long", "Alexander Montgomery"], ["Nguyễn Thị Ánh", "Nguyễn Thị Ánh"],
	[undefined, "Google user"], [" \u200b ", "Google user"], [{ display: "odd" }, "Google user"],
]) {
	test(`Google signup accepts provider name ${JSON.stringify(name)} and preserves VI/EN redirects`, async t => {
		for (const locale of ["vi", "en"]) {
			const providerEmail = `${locale}@provider.example.com`;
			t.mock.method(OAuth2Client.prototype, "getToken", async () => ({ tokens: { id_token: "isolated-token" } }));
			t.mock.method(OAuth2Client.prototype, "verifyIdToken", async () => ({ getPayload: () => ({ email: providerEmail, email_verified: true, name, sub: `provider-${locale}` }) }));
			const response = await fetch(`${url}/auth/google/callback?state=test-state&code=test-code`, {
				redirect: "manual", headers: { Cookie: `google_oauth_state=test-state; google_oauth_locale=${locale}` },
			});
			assert.equal(response.status, 303);
			assert.equal(response.headers.get("location"), `http://studyjony.test${locale === "en" ? "/en" : ""}/oauth/google/callback`);
			const user = await User.findOne({ email: providerEmail });
			assert.ok(user); assert.equal(user.name, expected);
			await assertSession(sessionToken(response), 200);
			t.mock.restoreAll();
		}
	});
}
test("existing Google accounts keep their chosen name when the provider returns a different long name", async t => {
	const user = await User.create({ name: "Chosen name", email, googleId: "existing-google" });
	t.mock.method(OAuth2Client.prototype, "getToken", async () => ({ tokens: { id_token: "isolated-token" } }));
	t.mock.method(OAuth2Client.prototype, "verifyIdToken", async () => ({ getPayload: () => ({ email, email_verified: true, name: "Different Provider Name That Is Far Too Long", sub: user.googleId }) }));
	const response = await fetch(`${url}/auth/google/callback?state=test-state&code=test-code`, {
		redirect: "manual", headers: { Cookie: "google_oauth_state=test-state" },
	});
	assert.equal(response.status, 303);
	assert.equal((await User.findById(user.id)).name, "Chosen name");
	assert.equal(await User.countDocuments(), 1);
	await assertSession(sessionToken(response), 200);
});
