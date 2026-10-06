const assert = require("node:assert/strict");
const { test, before, after, beforeEach } = require("node:test");
const express = require("express");
const cookieParser = require("cookie-parser");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { OAuth2Client } = require("google-auth-library");
const User = require("../models/userModel");
const Vocab = require("../models/vocabModel");
const cookies = require("../utils/credentialCookies");
let db, server, url, A, B, createAuthSessionGuard, createCredentialAttempt;
const password = "isolated-password";
const environment = {
	NODE_ENV: "development", JWT_SECRET: "isolated-credential-session-secret", JWT_EXPIRES_IN: "1h",
	FRONTEND_URL: "http://studyjony.test", GOOGLE_CLIENT_ID: "isolated-client", GOOGLE_CLIENT_SECRET: "isolated-secret",
	GOOGLE_REDIRECT_URI: "http://studyjony.test/api/v1/auth/google/callback",
};
const previousEnv = Object.fromEntries(Object.keys(environment).map(key => [key, process.env[key]]));
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }
before(async () => {
	Object.assign(process.env, environment);
	({ createAuthSessionGuard } = await import("../../client/app/_lib/authSessionGuard.mjs"));
	({ createCredentialAttempt } = await import("../../client/app/_lib/credentialAttempt.mjs"));
	db = await MongoMemoryServer.create({ binary: { version: "7.0.14" } });
	await mongoose.connect(db.getUri(), { dbName: "credential_sessions_test" });
	await User.init();
	const app = express(); app.use(express.json(), cookieParser());
	app.use("/api/v1/auth", require("../routes/authRoutes"));
	app.use("/api/v1/users", require("../routes/userRoutes"));
	app.use("/api/v1/vocab", require("../routes/vocabRoutes"));
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
beforeEach(async () => {
	process.env.NODE_ENV = "development";
	await Promise.all([User.deleteMany({}), Vocab.deleteMany({})]);
	[A, B] = await User.create([
		{ name: "Account A", email: "a@example.test", password, passwordConfirm: password },
		{ name: "Account B", email: "b@example.test", googleId: "bound-google-B", password, passwordConfirm: password },
	]);
});
function client() {
	const jar = new Map(), guard = createAuthSessionGuard(), users = [], navigations = [];
	const attempts = createCredentialAttempt({ guard,
		selectSession: id => { jar.set(cookies.selectionCookie, id); return true; }, onUser: user => users.push(user),
		registerIntent: id => { jar.set(cookies.intentCookie, id); return true; },
		isCurrentIntent: id => jar.get(cookies.intentCookie) === id,
	});
	async function request(path, method = "GET", body, attempt, extraHeaders = {}) {
		const response = await fetch(url + path, { method, redirect: "manual",
			headers: { "Content-Type": "application/json", Cookie: [...jar].map(([key, value]) => `${key}=${value}`).join("; "),
				...(attempt ? { "X-StudyJony-Auth-Attempt": attempt.id } : {}), ...extraHeaders },
			...(body ? { body: JSON.stringify(body) } : {}),
		});
		// Apply every Set-Cookie, including obsolete responses, as a browser would.
		for (const header of response.headers.getSetCookie()) {
			const [key, value] = header.split(";", 1)[0].split("=");
			if (value) jar.set(key, value); else jar.delete(key);
		}
		return response;
	}
	async function submit(attempt, who, kind = "login") {
		const response = await request(`/auth/credentials/${kind}`, "POST", {
			email: who.email, password, ...(kind === "signup" ? { name: who.name, passwordConfirm: password } : {}),
		}, attempt);
		const body = await response.json();
		if (response.ok && attempts.commit(attempt, body.data)) navigations.push(body.data.user._id);
		return response;
	}
	async function assertMe(who) {
		const response = await request("/users/me");
		assert.equal(response.status, who ? 200 : 401);
		if (who) assert.equal((await response.json()).data.user._id, who.id);
	}
	return { jar, guard, users, navigations, attempts, request, submit, assertMe };
}
function delayA(t, kind) {
	const started = deferred(), release = deferred();
	if (kind === "login") {
		const compare = User.prototype.correctPassword;
		t.mock.method(User.prototype, "correctPassword", async function (...args) {
			if (this.email === A.email) { started.resolve(); await release.promise; }
			return compare.apply(this, args);
		});
	} else {
		const create = User.create.bind(User);
		t.mock.method(User, "create", async function (data) {
			const user = await create(data);
			if (data.email === "signup-a@example.test") { started.resolve(); await release.promise; }
			return user;
		});
	}
	return { started, release };
}
for (const kind of ["login", "signup"]) {
	const oldUser = () => kind === "login" ? A : { name: "Signup A", email: "signup-a@example.test" };
	for (const replacement of ["B", "logout", "Google", "navigation"]) {
		test(`real ${kind}: delayed A → ${replacement} → A response cannot replace the active cookie/session`, async t => {
			const c = client(), delay = delayA(t, kind), a = c.attempts.begin();
			const old = c.submit(a, oldUser(), kind);
			await delay.started.promise;
			if (replacement === "B") {
				assert.equal((await c.submit(c.attempts.begin(), B)).status, 200);
			} else if (replacement === "logout") {
				c.attempts.invalidate(); c.guard.start(null); c.jar.set(cookies.selectionCookie, "none");
				assert.equal((await c.request("/auth/logout", "POST")).status, 200);
			} else if (replacement === "Google") {
				c.attempts.invalidate();
				t.mock.method(OAuth2Client.prototype, "getToken", async () => ({ tokens: { id_token: "mock-google-token" } }));
				t.mock.method(OAuth2Client.prototype, "verifyIdToken", async () => ({ getPayload: () => ({
					email: B.email, email_verified: true, name: B.name, sub: B.googleId,
				}) }));
				const state = await (await c.request("/auth/google/state?locale=en")).json();
				const callback = await c.request(`/auth/google/callback?state=${state.data.state}&code=mock-code`);
				assert.equal(callback.status, 303);
				assert.equal(callback.headers.get("location"), `${environment.FRONTEND_URL}/en/oauth/google/callback`);
				c.guard.start({ _id: B.id });
			} else c.attempts.cancel(a);
			delay.release.resolve(); assert.equal((await old).status, kind === "signup" ? 201 : 200);
			assert.ok(c.jar.has(cookies.cookieName(a.id)), "Stale cookie really arrived; cancellation alone is not the protection");
			assert.notEqual(c.jar.get(cookies.selectionCookie), a.id);
			assert.equal(c.guard.getUser()?._id || null, ["B", "Google"].includes(replacement) ? B.id : null);
			assert.deepEqual(c.navigations, replacement === "B" ? [B.id] : []);
			await c.assertMe(["B", "Google"].includes(replacement) ? B : null);
			assert.equal((await c.request("/auth/credentials/discard", "POST", undefined, a)).status, 204);
			assert.equal(c.jar.has(cookies.cookieName(a.id)), false);
			await c.assertMe(["B", "Google"].includes(replacement) ? B : null);
		});
	}
}
test("normal credential login/signup and logout work; selected cookies cannot be discarded", async () => {
	const c = client(), a = c.attempts.begin();
	assert.equal((await c.submit(a, A)).status, 200); await c.assertMe(A);
	const raw = c.jar.get(cookies.cookieName(a.id));
	assert.equal(jwt.decode(raw).credentialAttempt, a.id);
	assert.equal((await c.request("/auth/credentials/discard", "POST", undefined, a)).status, 204);
	await c.assertMe(A);
	assert.equal((await c.request("/users/me", "GET", undefined, undefined, { "X-StudyJony-Credential-Cleanup": "1" })).status, 200); await c.assertMe(A);
	const b = c.attempts.begin();
	assert.equal((await c.submit(b, { name: "New Learner", email: "new@example.test" }, "signup")).status, 201);
	const created = await User.findOne({ email: "new@example.test" }); await c.assertMe(created);
	await c.request("/users/me", "GET", undefined, undefined, { "X-StudyJony-Credential-Cleanup": "1" });
	assert.equal(c.jar.has(cookies.cookieName(a.id)), false);
	c.attempts.invalidate(); c.jar.set(cookies.selectionCookie, "none"); c.guard.start(null);
	assert.equal((await c.request("/auth/logout", "POST")).status, 200); await c.assertMe(null);
	assert.equal(c.jar.has(cookies.cookieName(b.id)), false);
});
test("invalid/missing attempt IDs fail before signup and never emit an authentication cookie", async () => {
	const c = client(), count = await User.countDocuments();
	for (const id of [undefined, "", "bad", "a".repeat(31), "a".repeat(33), "../jwt", { unsafe: true }]) {
		const response = await c.request("/auth/credentials/signup", "POST", { name: "Learner", email: "bad@example.test", password, passwordConfirm: password }, id === undefined ? undefined : { id });
		assert.equal(response.status, 400); assert.equal(response.headers.getSetCookie().length, 0);
	}
	assert.equal(await User.countDocuments(), count);
});
test("session restoration keeps a current pending candidate while cleaning abandoned candidates", async () => {
	const c = client(); await c.request("/auth/login", "POST", { email: B.email, password });
	const pending = c.attempts.begin();
	assert.equal((await c.request("/auth/credentials/login", "POST", { email: A.email, password }, pending)).status, 200);
	const candidate = c.jar.get(cookies.cookieName(pending.id));
	assert.equal((await c.request("/users/me", "GET", undefined, undefined, { "X-StudyJony-Credential-Cleanup": "1" })).status, 200);
	assert.ok(c.jar.get(cookies.cookieName(pending.id)) === candidate);
	assert.equal(c.attempts.commit(pending, { user: { _id: A.id } }), true); await c.assertMe(A);
});
test("selection is not authentication: missing, invalid and mismatched candidate cookies fail closed", async () => {
	const c = client(), a = c.attempts.begin(); await c.submit(a, A);
	const token = c.jar.get(cookies.cookieName(a.id));
	c.jar.set("jwt", token);
	for (const selection of ["none", "invalid", "", "f".repeat(32)]) {
		c.jar.set(cookies.selectionCookie, selection); await c.assertMe(null);
	}
	const other = "b".repeat(32);
	c.jar.set(cookies.selectionCookie, other); c.jar.set(cookies.cookieName(other), token);
	await c.assertMe(null);
});
test("expired or tampered selected credentials never fall back to a valid previous legacy account", async () => {
	const c = client(); await c.request("/auth/login", "POST", { email: B.email, password });
	const a = c.attempts.begin();
	c.jar.set(cookies.selectionCookie, a.id);
	for (const token of [
		jwt.sign({ id: A.id, credentialAttempt: a.id }, process.env.JWT_SECRET, { expiresIn: -1 }),
		jwt.sign({ id: A.id, credentialAttempt: a.id }, "wrong-test-secret", { expiresIn: "1h" }),
		"malformed",
	]) {
		c.jar.set(cookies.cookieName(a.id), token); await c.assertMe(null);
	}
	c.jar.set(cookies.selectionCookie, "legacy"); await c.assertMe(B);
});
test("a failed newer attempt still prevents an older successful response from authenticating", async t => {
	const c = client(), delay = delayA(t, "login"), a = c.attempts.begin();
	const old = c.submit(a, A); await delay.started.promise;
	const b = c.attempts.begin();
	assert.equal((await c.request("/auth/credentials/login", "POST", { email: B.email, password: "wrong-password" }, b)).status, 401);
	c.attempts.cancel(b); delay.release.resolve(); assert.equal((await old).status, 200);
	assert.deepEqual(c.users, []); assert.deepEqual(c.navigations, []); await c.assertMe(null);
});
test("legacy API password sessions remain compatible and production candidate cookies retain secure attributes", async () => {
	const c = client();
	const legacy = await c.request("/auth/login", "POST", { email: B.email, password });
	assert.equal(legacy.status, 200); assert.equal(c.jar.get(cookies.selectionCookie), "legacy"); await c.assertMe(B);
	process.env.NODE_ENV = "production";
	const a = c.attempts.begin(), response = await c.submit(a, A);
	const headers = response.headers.getSetCookie();
	assert.equal(headers.length, 1);
	assert.ok(headers[0].startsWith(`${cookies.cookieName(a.id)}=`));
	for (const attribute of [/HttpOnly/i, /Secure/i, /SameSite=None/i, /Domain=\.studyjony\.com/i, /Path=\//i]) assert.match(headers[0], attribute);
	assert.ok(!headers[0].startsWith("jwt=")); assert.ok(!headers[0].startsWith(`${cookies.selectionCookie}=`));
	await c.assertMe(A);
});
test("coexisting A/B credential cookies still enforce B's vocabulary ownership", async () => {
	const c = client(); await c.submit(c.attempts.begin(), A);
	await Vocab.create({ user: A.id, english: "private-A", vietnamese: "private meaning A" });
	await c.submit(c.attempts.begin(), B);
	assert.equal((await c.request("/vocab", "POST", { english: "private-B", vietnamese: "private meaning B" })).status, 201);
	const response = await c.request("/vocab");
	assert.equal(response.status, 200);
	const words = (await response.json()).data.vocabularies;
	assert.equal(words.length, 1); assert.equal(words[0].user, B.id); assert.equal(words[0].english, "private-B");
});
for (const change of ["update", "reset"]) test(`password ${change} still revokes selected candidate sessions and activates the replacement session`, async () => {
	const c = client(); await c.submit(c.attempts.begin(), A);
	let path = "/users/updatePassword";
	if (change === "reset") {
		const user = await User.findById(A.id);
		const token = user.createPasswordResetToken(); await user.save({ validateBeforeSave: false });
		path = `/users/resetPassword/${token}`;
	}
	assert.equal((await c.request(path, "PATCH", {
		passwordCurrent: password, password: "changed-password", passwordConfirm: "changed-password",
	})).status, 200);
	assert.equal(c.jar.get(cookies.selectionCookie), "legacy"); await c.assertMe(A);
	const oldId = [...c.jar.keys()].find(key => key.startsWith("sj_auth_") && key !== cookies.selectionCookie).slice("sj_auth_".length);
	c.jar.set(cookies.selectionCookie, oldId); await c.assertMe(null);
});
