const { randomUUID } = require("node:crypto");
const { completionFor, idsFromPath } = require("./helpers/learningAttempt");
const assert = require("node:assert/strict");
const { test, before, after, beforeEach } = require("node:test");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const User = require("../models/userModel");
const Topic = require("../models/topicModel");
const Vocab = require("../models/vocabModel");
const StudyActivity = require("../models/studyActivityModel");
const DialogueProgress = require("../models/dialogueProgressModel");
const XPEvent = require("../models/xpEventModel");
const frontend = "https://studyjony.test";
const password = "isolated-csrf-password";
const environment = {
	NODE_ENV: "production", FRONTEND_URL: frontend, JWT_SECRET: "isolated-csrf-session-secret", JWT_EXPIRES_IN: "1h",
	GOOGLE_CLIENT_ID: "mock-client", GOOGLE_CLIENT_SECRET: "mock-secret", GOOGLE_REDIRECT_URI: "https://api.studyjony.test/api/v1/auth/google/callback",
};
const previous = Object.fromEntries(Object.keys(environment).map(key => [key, process.env[key]]));
let db, server, url, owner, googleUser, topic, word, token;
before(async () => {
	Object.assign(process.env, environment);
	db = await MongoMemoryReplSet.create({ binary: { version: "7.0.14" }, replSet: { count: 1 } });
	await mongoose.connect(db.getUri(), { dbName: "csrf_full_app_test" });
	await Promise.all([User.init(), Topic.init(), Vocab.init(), StudyActivity.init(), DialogueProgress.init(), XPEvent.init()]);
	// CORS reads config at app creation; its response must normalize trailing slashes too.
	process.env.FRONTEND_URL = `${frontend}///`;
	const app = require("../app");
	server = await new Promise(resolve => { const listener = app.listen(0, "127.0.0.1", () => resolve(listener)); });
	url = `http://127.0.0.1:${server.address().port}/api/v1`;
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
	await Promise.all([User.deleteMany({}), Topic.deleteMany({}), Vocab.deleteMany({}), StudyActivity.deleteMany({}), DialogueProgress.deleteMany({}), XPEvent.deleteMany({})]);
	[owner, googleUser] = await User.create([
		{ name: "Owner", email: "owner@example.test", password, passwordConfirm: password },
		{ name: "Google learner", email: "google@example.test", googleId: "verified-google-subject" },
	]);
	topic = await Topic.create({ name: "Owned list", user: owner.id });
	word = await Vocab.create({ english: "water", vietnamese: "nước", user: owner.id, topic: topic.id });
	token = jwt.sign({ id: owner.id }, process.env.JWT_SECRET, { expiresIn: "1h" });
});
async function request(path, method = "GET", body, extra = {}) {
	const headers = { Origin: frontend, Cookie: `jwt=${token}`, "Content-Type": "application/json", ...extra };
	for (const key of Object.keys(headers)) if (headers[key] === undefined) delete headers[key];
	const response = await fetch(url + path, { method, headers, redirect: "manual", ...(body === undefined ? {} : { body: typeof body === "string" ? body : JSON.stringify(body) }) });
	const text = await response.text();
	return { status: response.status, headers: response.headers, cookies: response.headers.getSetCookie(), body: text && response.headers.get("content-type")?.includes("application/json") ? JSON.parse(text) : text };
}
const denied = response => {
	assert.equal(response.status, 403);
	assert.deepEqual(response.body, { status: "fail", message: "Request origin is not allowed." });
	assert.deepEqual(response.cookies, []);
};

test("every current mutation route rejects untrusted Origin before auth, parsing, cookies or database effects", async () => {
	const routes = [
		["POST", "/auth/login"], ["POST", "/auth/signup"], ["POST", "/auth/logout"],
		["POST", "/auth/credentials/login"], ["POST", "/auth/credentials/signup"], ["POST", "/auth/credentials/discard"],
		["POST", "/users/forgotPassword"], ["PATCH", "/users/resetPassword/mock"], ["PATCH", "/users/updatePassword"],
		["PATCH", "/users/updateMe"], ["PATCH", "/users/theme"], ["PATCH", "/users/avatar"],
		["POST", "/topics"], ["PATCH", `/topics/${topic.id}`], ["DELETE", `/topics/${topic.id}`],
		["POST", "/vocab"], ["PATCH", `/vocab/${word.id}`], ["DELETE", `/vocab/${word.id}`], ["POST", `/vocab/${word.id}/review`],
		["POST", "/study-activities"], ["PATCH", "/dialogue-progress/asking-for-directions/finding-a-cafe/tasks/1"],
		["POST", "/dialogue-progress/asking-for-directions/finding-a-cafe/tasks/1/attempt"],
		["PUT", "/future-mutation"],
	];
	const before = await Promise.all([User.find().lean(), Topic.find().lean(), Vocab.find().lean()]);
	for (const [method, path] of routes) denied(await request(path, method, { name: "Injected", english: "injected", amount: 999 }, { Origin: "https://attacker.test" }));
	assert.deepEqual(await Promise.all([User.find().lean(), Topic.find().lean(), Vocab.find().lean()]), before);
	assert.equal(await StudyActivity.countDocuments(), 0); assert.equal(await DialogueProgress.countDocuments(), 0); assert.equal(await XPEvent.countDocuments(), 0);
});
test("simple cross-origin study activity and logout POSTs cannot change data or clear sessions", async () => {
	for (const path of ["/study-activities", "/auth/logout"]) for (const contentType of ["text/plain", "application/x-www-form-urlencoded", undefined]) {
		denied(await request(path, "POST", contentType ? "ignored=1" : undefined, { Origin: "https://attacker.test", "Content-Type": contentType }));
	}
	assert.equal(await StudyActivity.countDocuments(), 0);
	assert.equal((await request("/users/me")).body.data.user._id, owner.id);
});
test("trusted frontend Origin supports global/owned-topic CRUD and preserves F07/F08 checks", async () => {
	const renamed = await request(`/topics/${topic.id}`, "PATCH", { name: "Renamed", user: googleUser.id });
	assert.equal(renamed.status, 200); assert.equal(renamed.body.data.updatedTopic.user, owner.id);
	for (const body of [{ english: "apple", vietnamese: "táo" }, { english: "book", vietnamese: "sách", topic: topic.id, reviewCount: 999 }]) {
		const created = await request("/vocab", "POST", body);
		assert.equal(created.status, 201); assert.equal(created.body.data.newVocab.reviewCount, 0);
		assert.equal((await request(`/vocab/${created.body.data.newVocab._id}`, "PATCH", { example: "Example" })).status, 200);
		assert.equal((await request(`/vocab/${created.body.data.newVocab._id}`, "DELETE")).status, 204);
	}
	const foreign = await Topic.create({ name: "Foreign", user: googleUser.id });
	assert.equal((await request("/vocab", "POST", { english: "bad", vietnamese: "bad", topic: foreign.id })).status, 400);
	assert.equal((await request(`/topics/${foreign.id}`, "DELETE")).status, 404);
	assert.equal((await request(`/topics/${topic.id}`, "DELETE")).status, 204);
});
test("trusted frontend requests still record activity, review/SRS XP and Dialogue/Story progress", async () => {
	assert.equal((await request("/study-activities", "POST")).status, 405);
	const review = await request(`/vocab/${word.id}/review`, "POST", { mode: "writing", answer: "water", reviewId: randomUUID() });
	assert.equal(review.status, 200); assert.equal(review.body.data.updatedVocab.reviewCount, 1); assert.equal(review.body.data.xp.awarded, 5);
	for (const path of ["/dialogue-progress/asking-for-directions/finding-a-cafe/tasks/1", "/dialogue-progress/ten-minutes-a-day/the-old-book/tasks/1"]) {
		assert.equal((await request(path, "PATCH", await completionFor(owner.id, idsFromPath(path)))).body.data.xp.awarded, 10);
		assert.equal((await request(path, "PATCH", await completionFor(owner.id, idsFromPath(path)))).body.data.xp.awarded, 0);
	}
	assert.equal(await XPEvent.countDocuments(), 3);
});
test("missing Origin needs a trusted Referer for cookie-based mutations", async () => {
	denied(await request("/study-activities", "POST", undefined, { Origin: undefined }));
	denied(await request("/study-activities", "POST", undefined, { Origin: undefined, "Sec-Fetch-Site": "same-origin" }));
	for (const referer of ["https://attacker.test/page", "null", "not-a-url", `${frontend}@attacker.test/page`]) {
		denied(await request("/study-activities", "POST", undefined, { Origin: undefined, Referer: referer }));
	}
	assert.equal((await request("/study-activities", "POST", undefined, { Origin: undefined, Referer: `${frontend}/en/wordlist?status=review` })).status, 405);
	assert.equal(await StudyActivity.countDocuments(), 0);
});
test("explicit null/empty/malformed/untrusted Origin never falls back to trusted Referer or Bearer", async () => {
	for (const origin of ["null", "", "https://attacker.test", `${frontend}/`, `${frontend}/path`, `${frontend}?query`, `${frontend}#hash`,
		`${frontend}.attacker.test`, "https://studyjony.test.attacker.test", "https://attacker.test@studyjony.test", "https://studyjony.test@attacker.test",
		"http://studyjony.test", "https://studyjony.test:444", "https://sub.studyjony.test", "https:/studyjony.test", "//studyjony.test", `${frontend}, https://attacker.test`]) {
		denied(await request("/study-activities", "POST", undefined, { Origin: origin, Referer: `${frontend}/`, Authorization: `Bearer ${token}` }));
	}
	assert.equal(await StudyActivity.countDocuments(), 0);
});
test("Host and forwarded headers do not authorize an untrusted or missing Origin", async () => {
	for (const origin of ["https://attacker.test", undefined]) denied(await request("/auth/logout", "POST", undefined, {
		Origin: origin, Host: "studyjony.test", "X-Forwarded-Host": "studyjony.test", "X-Forwarded-Proto": "https", Forwarded: "host=studyjony.test;proto=https",
	}));
});
test("cookie-less non-browser Bearer requests work, while cookie/metadata and invalid sessions are not bypassed", async () => {
	const headers = { Origin: undefined, Cookie: undefined, Authorization: `Bearer ${token}` };
	assert.equal((await request("/users/updateMe", "PATCH", { name: "Updated owner" }, headers)).status, 200);
	denied(await request("/users/updateMe", "PATCH", { name: "Denied" }, { ...headers, Cookie: `jwt=${token}` }));
	denied(await request("/users/updateMe", "PATCH", { name: "Denied" }, { ...headers, "Sec-Fetch-Site": "cross-site" }));
	for (const auth of ["Bearer malformed", `Bearer ${jwt.sign({ id: owner.id }, process.env.JWT_SECRET, { expiresIn: -1 })}`]) {
		assert.equal((await request("/users/updateMe", "PATCH", { name: "Denied" }, { ...headers, Authorization: auth })).status, 401);
	}
	denied(await request("/auth/login", "POST", { email: owner.email, password }, { Origin: undefined, Cookie: undefined }));
});
test("valid, expired and missing sessions retain their expected authentication status after origin approval", async () => {
	assert.equal((await request("/users/updateMe", "PATCH", { name: "Valid owner" })).status, 200);
	for (const cookie of [undefined, `jwt=${jwt.sign({ id: owner.id }, process.env.JWT_SECRET, { expiresIn: -1 })}`]) {
		assert.equal((await request("/users/updateMe", "PATCH", { name: "Denied" }, { Cookie: cookie })).status, 401);
		assert.equal((await request("/users/me", "GET", undefined, { Cookie: cookie })).status, 401);
	}
});
test("configured trailing slashes normalize; missing/invalid production configuration fails closed", async () => {
	for (const configured of [`${frontend}/`, `${frontend}////`]) {
		process.env.FRONTEND_URL = configured;
		assert.equal((await request("/study-activities", "POST")).status, 405);
	}
	for (const configured of [undefined, "", "not-a-url", "http://studyjony.test", `${frontend}/path`, `${frontend}/path/..`, `${frontend}?`, `${frontend}#`, "https://name:password@studyjony.test", "https://studyjony.test\\evil", `${frontend}\n`]) {
		if (configured === undefined) delete process.env.FRONTEND_URL; else process.env.FRONTEND_URL = configured;
		const response = await request("/study-activities", "POST");
		assert.equal(response.status, 500); assert.equal(response.body.message, "Request origin validation is unavailable. Please try again later.");
	}
	assert.equal(await StudyActivity.countDocuments(), 0);
});
test("safe GET/HEAD/OPTIONS stay outside the mutation guard, including session restoration and guest dictionary", async () => {
	for (const path of ["/users/me", "/vocab", "/topics"]) assert.equal((await request(path, "GET", undefined, { Origin: "https://attacker.test" })).status, 200);
	assert.equal((await request("/vocab", "HEAD", undefined, { Origin: "null" })).status, 200);
	assert.equal((await request("/study-activities", "OPTIONS", undefined, { Origin: "https://attacker.test" })).status, 204);
	const preflight = await request("/study-activities", "OPTIONS", undefined, { "Access-Control-Request-Method": "POST" });
	assert.equal(preflight.headers.get("access-control-allow-origin"), frontend);
	assert.equal(preflight.headers.get("access-control-allow-credentials"), "true");
	// Empty lookup is rejected by the dictionary's own input validation, not CSRF; no provider call.
	assert.equal((await request("/dictionary/%20", "GET", undefined, { Origin: "null", Cookie: undefined })).status, 400);
});
test("normal password login/signup, F06 candidate activation and logout retain cookie/session behavior", async () => {
	const id = "a".repeat(32);
	const login = await request("/auth/credentials/login", "POST", { email: owner.email, password }, { "X-StudyJony-Auth-Attempt": id, Cookie: undefined });
	assert.equal(login.status, 200); assert.equal(login.cookies.length, 1); assert.ok(login.cookies[0].startsWith(`sj_auth_${id}=`));
	assert.match(login.cookies[0], /HttpOnly/); assert.match(login.cookies[0], /Secure/); assert.match(login.cookies[0], /SameSite=None/);
	const candidate = login.cookies[0].split(";")[0];
	assert.equal((await request("/users/me", "GET", undefined, { Cookie: `sj_auth_session=${id}; ${candidate}` })).body.data.user._id, owner.id);
	assert.equal((await request("/users/me", "GET", undefined, { Cookie: `sj_auth_session=none; ${candidate}; jwt=${token}` })).status, 401);
	const logout = await request("/auth/logout", "POST", undefined, { Cookie: `sj_auth_session=${id}; ${candidate}` });
	assert.equal(logout.status, 200); assert.ok(logout.cookies.some(cookie => cookie.startsWith(`sj_auth_${id}=;`)));
	assert.ok(!logout.cookies.some(cookie => cookie.startsWith("sj_auth_session=")), "Delayed logout does not overwrite a newer selection");
	const signup = await request("/auth/credentials/signup", "POST", { name: "New learner", email: "new@example.test", password, passwordConfirm: password }, { Cookie: undefined, "X-StudyJony-Auth-Attempt": "b".repeat(32) });
	assert.equal(signup.status, 201); assert.equal(signup.cookies.length, 1);
});
for (const locale of ["vi", "en"]) test(`${locale}: OAuth callback remains state-verified without an Origin mutation exemption`, async t => {
	t.mock.method(console, "error", () => {});
	t.mock.method(OAuth2Client.prototype, "getToken", async () => ({ tokens: { id_token: "mock-token" } }));
	t.mock.method(OAuth2Client.prototype, "verifyIdToken", async () => ({ getPayload: () => ({ email: googleUser.email, sub: googleUser.googleId, email_verified: true, name: googleUser.name }) }));
	const callback = `/auth/google/callback?state=known-state&code=mock-code`;
	const response = await request(callback, "GET", undefined, { Origin: undefined, Cookie: `google_oauth_state=known-state; google_oauth_locale=${locale}` });
	assert.equal(response.status, 303);
	assert.equal(response.headers.get("location"), `${frontend}${locale === "en" ? "/en" : ""}/oauth/google/callback`);
	assert.ok(response.cookies.some(cookie => cookie.startsWith("jwt=")));
	assert.ok(response.cookies.filter(cookie => cookie.startsWith("google_oauth_")).every(cookie => !/Domain=/i.test(cookie)), "OAuth state cookies remain host-only");
	const failed = await request(callback, "GET", undefined, { Origin: undefined, Cookie: "google_oauth_state=wrong-state" });
	assert.match(failed.headers.get("location"), /google_oauth_failed/); assert.ok(!failed.cookies.some(cookie => cookie.startsWith("jwt=")));
});
