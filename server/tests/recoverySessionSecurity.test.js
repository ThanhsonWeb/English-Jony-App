const assert = require("node:assert/strict");
const { test, before, after, beforeEach } = require("node:test");
const express = require("express");
const cookieParser = require("cookie-parser");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const crypto = require("node:crypto");
const nodemailer = require("nodemailer");
const { MongoMemoryServer } = require("mongodb-memory-server");
const { OAuth2Client } = require("google-auth-library");
const User = require("../models/userModel");
const RevokedSession = require("../models/revokedSessionModel");
const RecoveryCooldown = require("../models/recoveryCooldownModel");
const { claimRecovery, cooldownMs, recoveryResponse, createRecoveryIpLimiter } = require("../middleware/recoveryRateLimit");
const deliverRecovery = require("../utils/passwordRecovery");

const password = "original-isolated-password";
const origin = "http://studyjony.test";
const environment = { NODE_ENV: "development", FRONTEND_URL: origin,
	JWT_SECRET: "isolated-recovery-session-security", JWT_EXPIRES_IN: "1h" };
const previous = Object.fromEntries(Object.keys(environment).map(key => [key, process.env[key]]));
let db, server, url, user;
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { resolve, promise }; };
async function eventually(check) {
	for (let i = 0; i < 100; i++) { if (await check()) return; await new Promise(done => setTimeout(done, 10)); }
	assert.fail("Background recovery did not finish");
}
before(async () => {
	Object.assign(process.env, environment);
	db = await MongoMemoryServer.create({ binary: { version: "7.0.14" } });
	await mongoose.connect(db.getUri(), { dbName: "recovery_session_security_test" });
	await Promise.all([User.init(), RevokedSession.init(), RecoveryCooldown.init()]);
	const app = express();
	app.use("/api/v1", require("../middleware/csrfProtection"));
	app.use(express.json(), cookieParser());
	app.use("/api/v1/auth", require("../routes/authRoutes"));
	app.use("/api/v1/users", require("../routes/userRoutes"));
	app.post("/isolated-ip-budget", createRecoveryIpLimiter({ limit: 3, windowMs: 80 }), (req, res) => res.sendStatus(204));
	app.use((error, req, res, next) => res.status(error.statusCode || (error.name === "ValidationError" ? 400 : 500))
		.json({ status: "fail", message: "Request failed" }));
	server = await new Promise(resolve => { const listener = app.listen(0, "127.0.0.1", () => resolve(listener)); });
	url = `http://127.0.0.1:${server.address().port}`;
}, { timeout: 180000 });
after(async () => {
	if (server) await new Promise(resolve => server.close(resolve));
	await mongoose.disconnect(); await db?.stop();
	for (const [key, value] of Object.entries(previous)) {
		if (value === undefined) delete process.env[key]; else process.env[key] = value;
	}
});
beforeEach(async () => {
	await Promise.all([User.deleteMany({}), RevokedSession.deleteMany({}), RecoveryCooldown.deleteMany({})]);
	user = await User.create({ name: "Test learner", email: "learner@example.test", password, passwordConfirm: password });
});
const request = (path, method = "GET", body, headers = {}) => fetch(url + "/api/v1" + path, {
	method, redirect: "manual", headers: { "Content-Type": "application/json", Origin: origin, ...headers },
	...(body ? { body: JSON.stringify(body) } : {}),
});
const tokenFrom = response => response.headers.getSetCookie().find(value => value.startsWith("jwt="))?.split(";", 1)[0].slice(4);
const me = token => request("/users/me", "GET", undefined, { Authorization: `Bearer ${token}` });
const login = account => request("/auth/login", "POST", { email: account.email, password });
const resetBody = value => ({ password: value, passwordConfirm: value });
async function resetToken() { const token = user.createPasswordResetToken(); await user.save({ validateBeforeSave: false }); return token; }
const reset = (token, value = "replacement-isolated-password") => request(`/users/resetPassword/${token}`, "PATCH", resetBody(value));
function mailMock(t, send = async () => {}) {
	const mails = [];
	t.mock.method(nodemailer, "createTransport", () => ({ sendMail: async mail => { mails.push(mail); return send(mail); } }));
	return mails;
}

test("F10: both reset requests reach the atomic save; exactly one succeeds with its password/version", async t => {
	const old = tokenFrom(await login(user)), raw = await resetToken();
	const entered = deferred(), release = deferred(); let writes = 0;
	const original = User.collection.updateOne;
	t.mock.method(User.collection, "updateOne", async function(...args) {
		if (args[0].passwordResetToken && args[0].$expr) {
			if (++writes === 2) entered.resolve();
			await release.promise;
		}
		return original.apply(this, args);
	});
	const first = reset(raw, "first-replacement-password"), second = reset(raw, "second-replacement-password");
	await entered.promise; release.resolve();
	const responses = await Promise.all([first, second]);
	assert.deepEqual(responses.map(r => r.status).sort(), [200, 400]);
	const winner = responses.findIndex(r => r.status === 200);
	const saved = await User.findById(user.id).select("+password");
	assert.equal(await saved.correctPassword(winner === 0 ? "first-replacement-password" : "second-replacement-password", saved.password), true);
	assert.ok(saved.passwordSessionVersion); assert.ok(saved.passwordChangedAt);
	assert.equal(saved.passwordResetToken, undefined); assert.equal(saved.passwordResetExpires, undefined);
	assert.equal((await me(old)).status, 401);
	assert.equal((await me(tokenFrom(responses[winner]))).status, 200);
	assert.equal((await reset(raw)).status, 400);
	assert.equal(responses[1 - winner].headers.get("set-cookie"), null);
});

test("F10: validation and database failures leave both password and token intact for retry", async t => {
	const raw = await resetToken(), before = await User.findById(user.id).select("+password");
	assert.equal((await request(`/users/resetPassword/${raw}`, "PATCH", { password: "valid-new-password", passwordConfirm: "different" })).status, 400);
	const original = User.collection.updateOne; let fail = true;
	t.mock.method(User.collection, "updateOne", function(...args) {
		if (fail && args[0].passwordResetToken) { fail = false; throw new Error("isolated database write failure"); }
		return original.apply(this, args);
	});
	assert.equal((await reset(raw)).status, 500);
	const unchanged = await User.findById(user.id).select("+password");
	assert.equal(unchanged.password, before.password);
	assert.equal(unchanged.passwordResetToken, before.passwordResetToken);
	assert.equal(unchanged.passwordSessionVersion, undefined);
	assert.equal((await reset(raw)).status, 200);
});

test("F10: expiry is rechecked by MongoDB at the password write after hashing", async t => {
	const raw = await resetToken(), entered = deferred(), release = deferred();
	const original = User.collection.updateOne;
	t.mock.method(User.collection, "updateOne", async function(...args) {
		if (args[0].passwordResetToken && args[0].$expr) { entered.resolve(); await release.promise; }
		return original.apply(this, args);
	});
	const pending = reset(raw); await entered.promise;
	await User.updateOne({ _id: user._id }, { passwordResetExpires: new Date(Date.now() - 1) });
	release.resolve(); assert.equal((await pending).status, 400);
	const unchanged = await User.findById(user.id).select("+password");
	assert.equal(await unchanged.correctPassword(password, unchanged.password), true);
	assert.equal(unchanged.passwordSessionVersion, undefined);
});

test("F10: an in-flight reset cannot consume a replacement token issued before its atomic save", async t => {
	const raw = await resetToken(), entered = deferred(), release = deferred();
	const original = User.collection.updateOne;
	t.mock.method(User.collection, "updateOne", async function(...args) {
		if (args[0].passwordResetToken && args[0].$expr) { entered.resolve(); await release.promise; }
		return original.apply(this, args);
	});
	const pending = reset(raw); await entered.promise;
	const fresh = await User.findById(user.id), replacement = fresh.createPasswordResetToken();
	await fresh.save({ validateBeforeSave: false }); release.resolve();
	assert.equal((await pending).status, 400);
	assert.equal((await User.findById(user.id)).passwordResetToken, fresh.passwordResetToken);
	// Restore the barrier mock before using the new token.
	t.mock.restoreAll(); assert.equal((await reset(replacement)).status, 200);
});

test("F11: known, unknown, invalid, cooldown and failed-delivery responses are publicly identical", async t => {
	const mails = mailMock(t, async () => { throw new Error("private transport details"); });
	const logs = []; t.mock.method(console, "warn", value => logs.push(value));
	const bodies = [];
	for (const email of [user.email, "unknown@example.test", "not-an-email", user.email, `  ${user.email.toUpperCase()}  `]) {
		const response = await request("/users/forgotPassword", "POST", { email });
		assert.equal(response.status, 200); bodies.push(await response.json());
		assert.equal(response.headers.get("set-cookie"), null);
	}
	for (const body of bodies) assert.deepEqual(body, recoveryResponse);
	await eventually(async () => mails.length === 1 && !(await User.findById(user.id)).passwordResetToken);
	assert.equal(mails.length, 1);
	assert.deepEqual(logs, [{ event: "password_recovery_delivery_failed" }]);
});

test("F11: a slow account lookup or SMTP cannot delay or change the accepted public response", async t => {
	const releaseLookup = deferred(), lookupStarted = deferred(), releaseMail = deferred();
	const original = User.findOne;
	t.mock.method(User, "findOne", async function(...args) {
		lookupStarted.resolve(); await releaseLookup.promise; return original.apply(this, args);
	});
	const mails = mailMock(t, () => releaseMail.promise);
	const response = await request("/users/forgotPassword", "POST", { email: user.email });
	assert.equal(response.status, 200); assert.deepEqual(await response.json(), recoveryResponse);
	await lookupStarted.promise; assert.equal(mails.length, 0);
	releaseLookup.resolve(); await eventually(() => mails.length === 1); releaseMail.resolve();
});

test("F11: database cooldown is atomic across concurrent requests and permits retry at its boundary", async () => {
	const now = Date.now();
	const claims = await Promise.all(Array.from({ length: 3 }, () => claimRecovery(user.email, now)));
	assert.equal(claims.filter(Boolean).length, 1);
	assert.equal(await claimRecovery(user.email, now + cooldownMs - 1), false);
	assert.equal(await claimRecovery(user.email, now + cooldownMs), true);
	const record = await RecoveryCooldown.findOne();
	assert.equal(record._id, crypto.createHash("sha256").update(user.email).digest("hex"));
	assert.equal(record.expiresAt.getTime(), now + 2 * cooldownMs);
});

test("F11: retries preserve an existing link; retry after expiry or delivery failure can issue a fresh link", async t => {
	const mails = mailMock(t);
	await deliverRecovery(user.email, origin); assert.equal(mails.length, 1);
	const first = await User.findById(user.id);
	await deliverRecovery(user.email, origin); assert.equal(mails.length, 1);
	assert.equal((await User.findById(user.id)).passwordResetToken, first.passwordResetToken);
	await User.updateOne({ _id: user._id }, { passwordResetExpires: new Date(Date.now() - 1) });
	await deliverRecovery(user.email, origin); assert.equal(mails.length, 2);
	assert.notEqual((await User.findById(user.id)).passwordResetToken, first.passwordResetToken);
});

test("F11: normalized API retries after cooldown work without rotating an unexpired link", async t => {
	let failDelivery = true;
	const mails = mailMock(t, async () => { if (failDelivery) throw new Error("isolated mail failure"); });
	t.mock.method(console, "warn", () => {});
	const forgot = email => request("/users/forgotPassword", "POST", { email });
	assert.equal((await forgot(user.email)).status, 200);
	await eventually(async () => mails.length === 1 && !(await User.findById(user.id)).passwordResetToken);
	assert.equal((await forgot(`  ${user.email.toUpperCase()}  `)).status, 200);
	assert.equal(mails.length, 1);
	assert.equal(await RecoveryCooldown.countDocuments(), 1);
	await RecoveryCooldown.updateOne({}, { expiresAt: new Date(Date.now() - 1) });
	failDelivery = false;
	assert.equal((await forgot(`  ${user.email.toUpperCase()}  `)).status, 200);
	await eventually(() => mails.length === 2);
	const saved = await User.findById(user.id);
	await RecoveryCooldown.updateOne({}, { expiresAt: new Date(Date.now() - 1) });
	assert.equal((await forgot(user.email)).status, 200);
	// A new eligible request may look up the account, but must not rotate its link.
	await deliverRecovery(user.email, origin);
	assert.equal((await User.findById(user.id)).passwordResetToken, saved.passwordResetToken);
	assert.equal(mails.length, 2);
});

test("F11: duplicate signup returns a generic localized code without authenticating; ordinary signup still works", async () => {
	const body = { name: "Test learner", email: user.email, password, passwordConfirm: password };
	for (const route of ["/auth/signup", "/auth/credentials/signup"]) {
		const response = await request(route, "POST", body, { "X-StudyJony-Auth-Attempt": "a".repeat(32) });
		assert.equal(response.status, 400); const result = await response.json();
		assert.deepEqual(Object.keys(result).sort(), ["code", "message", "status"]);
		assert.equal(result.code, "signupUnavailable");
		assert.doesNotMatch(result.message, /exists|already|duplicate|E11000|learner@example/);
		assert.equal(response.headers.get("set-cookie"), null);
	}
	const response = await request("/auth/signup", "POST", { ...body, email: "new@example.test" });
	assert.equal(response.status, 201); assert.equal((await me(tokenFrom(response))).status, 200);
});

test("F11: peer IP budget ignores forged forwarding headers and recovers after the window", async () => {
	const hit = value => fetch(url + "/isolated-ip-budget", { method: "POST", headers: { "X-Forwarded-For": value } });
	for (let i = 0; i < 3; i++) assert.equal((await hit(`192.0.2.${i}`)).status, 204);
	assert.equal((await hit("198.51.100.1")).status, 429);
	await new Promise(done => setTimeout(done, 90));
	assert.equal((await hit("198.51.100.2")).status, 204);
});

for (const type of ["password", "google", "dual"]) test(`F14: ${type} logout rejects the copied JWT but leaves an unrelated session valid`, async t => {
	if (type !== "password") {
		await User.updateOne({ _id: user._id }, { googleId: "isolated-google-sub" });
		if (type === "google") await User.updateOne({ _id: user._id }, { $unset: { password: 1 } });
	}
	const authenticate = async () => {
		if (type === "password") return login(user);
		t.mock.method(OAuth2Client.prototype, "getToken", async () => ({ tokens: { id_token: "mock-provider-token" } }));
		t.mock.method(OAuth2Client.prototype, "verifyIdToken", async () => ({ getPayload: () => ({
			email: user.email, email_verified: true, name: "Test learner", sub: "isolated-google-sub",
		}) }));
		return request("/auth/google/callback?code=mock&state=mock-state", "GET", undefined, { Cookie: "google_oauth_state=mock-state" });
	};
	const a = tokenFrom(await authenticate()), b = tokenFrom(await authenticate());
	assert.notEqual(a, b); assert.match(jwt.decode(a).jti, /^[a-f0-9]{64}$/);
	assert.equal((await me(a)).status, 200); assert.equal((await me(b)).status, 200);
	const logout = await request("/auth/logout", "POST", undefined, { Cookie: `jwt=${a}; sj_auth_session=none`, "X-StudyJony-Logout-Session": "legacy" });
	assert.equal(logout.status, 200);
	assert.equal(logout.headers.get("set-cookie"), null, "Delayed logout cannot erase a newer legacy/Google cookie");
	assert.equal((await me(a)).status, 401); assert.equal((await me(b)).status, 200);
	assert.equal((await request("/users/me", "GET", undefined, { Cookie: `jwt=${a}` })).status, 401);
	assert.equal((await request("/auth/logout", "POST", undefined, { Authorization: `Bearer ${a}` })).status, 200);
	assert.equal(await RevokedSession.countDocuments(), 1, "Repeated logout is idempotent");
});

test("F14: captured candidate A logout cannot revoke B; old frontend selector-none is safely supported", async () => {
	const authenticate = async id => {
		const response = await request("/auth/credentials/login", "POST", { email: user.email, password }, { "X-StudyJony-Auth-Attempt": id });
		return response.headers.getSetCookie()[0].split(";", 1)[0];
	};
	const a = "a".repeat(32), b = "b".repeat(32), cookieA = await authenticate(a), cookieB = await authenticate(b);
	const tokenA = cookieA.split("=")[1], tokenB = cookieB.split("=")[1];
	const response = await request("/auth/logout", "POST", undefined, {
		Cookie: `${cookieA}; ${cookieB}; sj_auth_session=${b}`, "X-StudyJony-Logout-Session": a,
	});
	assert.equal(response.status, 200);
	assert.match(response.headers.get("set-cookie"), new RegExp(`sj_auth_${a}=;`));
	assert.doesNotMatch(response.headers.get("set-cookie"), new RegExp(`sj_auth_${b}=`));
	assert.equal((await me(tokenA)).status, 401); assert.equal((await me(tokenB)).status, 200);
	assert.equal((await request("/auth/logout", "POST", undefined, { Cookie: `${cookieB}; sj_auth_session=none` })).status, 200);
	assert.equal((await me(tokenB)).status, 401);
});

test("F14: delayed A logout cannot clear or revoke a newer Google/account-B session", async t => {
	const accountB = await User.create({ name: "Other learner", email: "other@example.test", password, passwordConfirm: password });
	const a = tokenFrom(await login(user)), entered = deferred(), release = deferred();
	const revocations = require("../utils/sessionRevocation"), original = revocations.revoke;
	t.mock.method(revocations, "revoke", async (...args) => { entered.resolve(); await release.promise; return original(...args); });
	const pending = request("/auth/logout", "POST", undefined, { Cookie: `jwt=${a}`, "X-StudyJony-Logout-Session": "legacy" });
	await entered.promise;
	const b = tokenFrom(await login(accountB)); release.resolve();
	assert.equal((await pending).headers.get("set-cookie"), null);
	assert.equal((await me(a)).status, 401);
	const response = await me(b); assert.equal(response.status, 200); assert.equal((await response.json()).data.user._id, accountB.id);
});

test("F14: a missing captured credential or legacy logout targeting a newer session cannot report success", async () => {
	const response = await login(user), token = tokenFrom(response);
	const selected = response.headers.getSetCookie().find(cookie => cookie.startsWith("sj_auth_session=")).split(";", 1)[0].split("=")[1];
	const headers = { Cookie: `jwt=${token}; sj_auth_session=${selected}` };
	assert.equal((await request("/auth/logout", "POST", undefined, { ...headers, "X-StudyJony-Logout-Session": "legacy" })).status, 409);
	assert.equal((await request("/auth/logout", "POST", undefined, { ...headers, "X-StudyJony-Logout-Session": "f".repeat(32) })).status, 409);
	assert.equal((await me(token)).status, 200);
});

test("F14/F06: old frontend discard-before-logout revokes the removed credential; cleanup preserves selected/pending sessions", async () => {
	const authenticate = async id => {
		const response = await request("/auth/credentials/login", "POST", { email: user.email, password }, { "X-StudyJony-Auth-Attempt": id });
		return response.headers.getSetCookie()[0].split(";", 1)[0];
	};
	const a = "a".repeat(32), b = "b".repeat(32), pending = "c".repeat(32);
	const cookieA = await authenticate(a), cookieB = await authenticate(b), cookiePending = await authenticate(pending);
	assert.equal((await request("/auth/credentials/discard", "POST", undefined, {
		Cookie: `${cookieA}; sj_auth_session=none`, "X-StudyJony-Auth-Attempt": a,
	})).status, 204);
	assert.equal((await request("/auth/logout", "POST", undefined, { Cookie: "sj_auth_session=none" })).status, 200);
	assert.equal((await me(cookieA.split("=")[1])).status, 401);
	const cleanup = await request("/users/me", "GET", undefined, {
		Cookie: `${cookieA}; ${cookieB}; ${cookiePending}; sj_auth_session=${b}; sj_auth_intent=${pending}`,
		"X-StudyJony-Credential-Cleanup": "1",
	});
	assert.equal(cleanup.status, 200);
	assert.equal((await me(cookieB.split("=")[1])).status, 200);
	assert.equal((await me(cookiePending.split("=")[1])).status, 200);
});

test("F14: expiring legacy credentials are revoked, immortal credentials are rejected, expiry indexes are present", async () => {
	const legacy = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: "1h" });
	assert.equal((await me(legacy)).status, 200);
	assert.equal((await request("/auth/logout", "POST", undefined, { Authorization: `Bearer ${legacy}` })).status, 200);
	assert.equal((await me(legacy)).status, 401);
	assert.equal((await me(jwt.sign({ id: user.id }, process.env.JWT_SECRET))).status, 401);
	const stored = await RevokedSession.findOne().lean();
	assert.deepEqual(Object.keys(stored).sort(), ["_id", "expiresAt"]);
	assert.equal(stored._id, crypto.createHash("sha256").update(legacy).digest("hex"));
	assert.equal(stored.expiresAt.getTime(), jwt.decode(legacy).exp * 1000);
	for (const model of [RevokedSession, RecoveryCooldown]) {
		const indexes = await model.collection.indexes();
		assert.ok(indexes.some(index => index.key.expiresAt === 1 && index.expireAfterSeconds === 0));
	}
	assert.equal((await request("/auth/logout", "POST")).status, 200);
	assert.equal((await request("/auth/logout", "POST", undefined, { Authorization: "Bearer broken" })).status, 200);
	assert.equal((await request("/auth/logout", "POST", undefined, { "X-StudyJony-Logout-Session": "bad" })).status, 400);
});

test("F14/F09: untrusted-origin logout cannot revoke an active session", async () => {
	const token = tokenFrom(await login(user));
	assert.equal((await request("/auth/logout", "POST", undefined, { Origin: "https://attacker.test", Cookie: `jwt=${token}` })).status, 403);
	assert.equal((await me(token)).status, 200);
});

test("F14: a failed revocation is not reported as successful logout and can be retried", async t => {
	const token = tokenFrom(await login(user));
	const original = RevokedSession.updateOne; let fail = true;
	t.mock.method(RevokedSession, "updateOne", function(...args) {
		if (fail) { fail = false; throw new Error("isolated revocation write failure"); }
		return original.apply(this, args);
	});
	const headers = { Authorization: `Bearer ${token}` };
	assert.equal((await request("/auth/logout", "POST", undefined, headers)).status, 500);
	assert.equal((await me(token)).status, 200);
	assert.equal((await request("/auth/logout", "POST", undefined, headers)).status, 200);
	assert.equal((await me(token)).status, 401);
});

for (const withPassword of [false, true]) test(`Google account (password: ${withPassword}) reset keeps provider identity and revokes its previous sessions`, async t => {
	await User.updateOne({ _id: user._id }, { googleId: "reset-google-sub", ...(!withPassword ? { $unset: { password: 1 } } : {}) });
	t.mock.method(OAuth2Client.prototype, "getToken", async () => ({ tokens: { id_token: "mock-token" } }));
	t.mock.method(OAuth2Client.prototype, "verifyIdToken", async () => ({ getPayload: () => ({
		email: user.email, email_verified: true, sub: "reset-google-sub", name: "Test learner",
	}) }));
	const google = () => request("/auth/google/callback?code=mock&state=state", "GET", undefined, { Cookie: "google_oauth_state=state" });
	const old = tokenFrom(await google()), raw = await resetToken();
	const response = await reset(raw);
	assert.equal(response.status, 200);
	const replacement = tokenFrom(response);
	assert.equal((await me(old)).status, 401); assert.equal((await me(replacement)).status, 200);
	const saved = await User.findById(user.id).select("+password");
	assert.equal(saved.googleId, "reset-google-sub");
	assert.equal(await saved.correctPassword("replacement-isolated-password", saved.password), true);
	assert.equal((await request("/auth/login", "POST", { email: user.email, password: "replacement-isolated-password" })).status, 200);
	const afterGoogle = tokenFrom(await google()); assert.equal((await me(afterGoogle)).status, 200);
	assert.equal((await request("/auth/logout", "POST", undefined, { Authorization: `Bearer ${replacement}` })).status, 200);
	assert.equal((await me(replacement)).status, 401); assert.equal((await me(afterGoogle)).status, 200);
});
