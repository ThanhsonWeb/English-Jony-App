const assert = require("node:assert/strict");
const { test, before, after, beforeEach } = require("node:test");
const express = require("express");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const User = require("../models/userModel");
const { CLIENT_USER_FIELDS, clientUser } = require("../utils/clientUser");
const { passwordFitsBcrypt } = require("../utils/passwordPolicy");
const { completionFor } = require("./helpers/learningAttempt");
let db, server, url, user, token, sequence = 0;
const oldEnv = Object.fromEntries(["NODE_ENV", "JWT_SECRET", "JWT_EXPIRES_IN"].map(key => [key, process.env[key]]));
const password = "original-password";
before(async () => {
	Object.assign(process.env, { NODE_ENV: "production", JWT_SECRET: "isolated-private-password-test", JWT_EXPIRES_IN: "1h" });
	db = await MongoMemoryReplSet.create({ binary: { version: "7.0.14" }, replSet: { count: 1 } });
	await mongoose.connect(db.getUri(), { dbName: "private_password_test" }); await User.init();
	const app = express(); app.use(express.json());
	for (const [route, file] of [["auth", "authRoutes"], ["users", "userRoutes"], ["vocab", "vocabRoutes"], ["topics", "topicRoutes"], ["dialogue-progress", "dialogueProgressRoutes"], ["study-activities", "studyActivityRoutes"], ["leaderboard", "leaderboardRoutes"]]) app.use(`/api/v1/${route}`, require(`../routes/${file}`));
	app.use(require("../controllers/errorController"));
	server = await new Promise(resolve => { const listener = app.listen(0, "127.0.0.1", () => resolve(listener)); });
	url = `http://127.0.0.1:${server.address().port}/api/v1`;
}, { timeout: 180000 });
after(async () => {
	if (server) await new Promise(resolve => server.close(resolve)); await mongoose.disconnect(); await db?.stop();
	for (const [key, value] of Object.entries(oldEnv)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
});
beforeEach(async () => {
	await User.deleteMany({});
	user = await User.create({ name: "Test Learner", email: `learner-${++sequence}@example.test`, password, passwordConfirm: password });
	token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: "1h" });
});
async function request(path, method = "GET", body, auth = token) {
	const res = await fetch(url + path, { method, headers: { "Content-Type": "application/json", ...(auth ? { Authorization: `Bearer ${auth}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
	return { status: res.status, cache: res.headers.get("cache-control"), body: await res.json() };
}
function safeUser(value) {
	assert.ok(value._id); assert.ok(value.email); assert.equal(typeof value.totalXp, "number");
	for (const field of Object.keys(value)) assert.ok(CLIENT_USER_FIELDS.split(" ").includes(field), field);
}
const boundaries = [["ASCII", "a".repeat(72), "a".repeat(73)], ["Vietnamese", "ế".repeat(24), "ế".repeat(25)], ["emoji", "🙂".repeat(18), "🙂".repeat(19)]];
for (const [label, exact, over] of boundaries) test(`${label}: signup/change/reset accept 72 UTF-8 bytes and reject over-limit input without writes`, async () => {
	assert.equal(Buffer.byteLength(exact), 72); assert.equal(passwordFitsBcrypt(exact), true); assert.equal(passwordFitsBcrypt(over), false);
	const email = `boundary-${++sequence}@example.test`;
	assert.equal((await request("/auth/signup", "POST", { name: "Boundary Learner", email, password: over, passwordConfirm: over })).status, 400);
	assert.equal(await User.exists({ email }), null);
	const signup = await request("/auth/signup", "POST", { name: "Boundary Learner", email, password: exact, passwordConfirm: exact });
	assert.equal(signup.status, 201); safeUser(signup.body.data.user);
	const hash = (await User.findById(user.id).select("+password")).password;
	const change = await request("/users/updatePassword", "PATCH", { passwordCurrent: password, password: over, passwordConfirm: over });
	assert.equal(change.status, 400); assert.equal(change.body.code, "passwordTooLong");
	assert.equal((await User.findById(user.id).select("+password")).password, hash);
	let raw = user.createPasswordResetToken(); await user.save({ validateBeforeSave: false });
	assert.equal((await request(`/users/resetPassword/${raw}`, "PATCH", { password: over, passwordConfirm: over })).status, 400);
	assert.ok((await User.findById(user.id)).passwordResetToken);
	const reset = await request(`/users/resetPassword/${raw}`, "PATCH", { password: exact, passwordConfirm: exact });
	assert.equal(reset.status, 200); safeUser(reset.body.data.user);
	const newToken = jwt.sign({ id: user.id, passwordChangedAt: (await User.findById(user.id)).passwordChangedAt.getTime(), passwordSessionVersion: (await User.findById(user.id)).passwordSessionVersion }, process.env.JWT_SECRET, { expiresIn: "1h" });
	const update = await request("/users/updatePassword", "PATCH", { passwordCurrent: exact, password: exact, passwordConfirm: exact }, newToken);
	assert.equal(update.status, 200); safeUser(update.body.data.user);
});

test("minimum and model-level byte limits hold; existing long-password hashes still authenticate", async () => {
	for (const value of ["short", "ế".repeat(25), "🙂".repeat(19)]) {
		const doc = new User({ email: "invalid@example.test", password: value, passwordConfirm: value });
		assert.ok(doc.validateSync()?.errors.password);
	}
	const legacy = "a".repeat(72) + "legacy-suffix", hash = await bcrypt.hash(legacy, 4);
	await User.updateOne({ _id: user.id }, { password: hash });
	const login = await request("/auth/login", "POST", { email: user.email, password: legacy });
	assert.equal(login.status, 200); safeUser(login.body.data.user);
});

test("me/auth/profile/admin responses omit auth metadata; clean profile projections do not fetch it", async t => {
	await User.updateOne({ _id: user.id }, { passwordResetToken: "private-reset", passwordResetExpires: new Date(Date.now() + 60000), googleId: "private-google-subject" });
	for (const [path, method, body] of [["/users/me", "GET"], ["/auth/login", "POST", { email: user.email, password }], ["/users/updateMe", "PATCH", { name: "Updated Learner" }]]) {
		const result = await request(path, method, body); assert.equal(result.status, 200); assert.equal(result.cache, "private, no-store"); safeUser(result.body.data.user);
	}
	const collected = [], find = User.findByIdAndUpdate;
	t.mock.method(User, "findByIdAndUpdate", function (...args) { const query = find.apply(this, args); const select = query.select; query.select = function (fields) { collected.push(fields); return select.call(this, fields); }; return query; });
	await request("/users/updateMe", "PATCH", { name: "Projected Learner" }); assert.ok(collected.includes(CLIENT_USER_FIELDS));
	await User.updateOne({ _id: user.id }, { role: "admin" });
	const admin = await request("/users"); assert.equal(admin.status, 200); admin.body.data.users.forEach(safeUser);
	const source = { ...user.toObject(), password: "hash", passwordConfirm: "secret", futureSecret: "secret", passwordSessionVersion: "secret", googleId: "secret" };
	safeUser(clientUser(source)); assert.equal(clientUser(source).futureSecret, undefined);
});

test("Google-only user restoration stays safe; private CRUD/progress/reviews stay no-store and leaderboard remains separate", async () => {
	const google = await User.create({ name: "Google Learner", email: `google-${++sequence}@example.test`, googleId: "isolated-google" });
	const googleToken = jwt.sign({ id: google.id }, process.env.JWT_SECRET, { expiresIn: "1h" });
	safeUser((await request("/users/me", "GET", undefined, googleToken)).body.data.user);
	const created = await request("/vocab", "POST", { english: "apple", vietnamese: "quả táo" }); assert.equal(created.status, 201); assert.equal(created.cache, "private, no-store");
	const word = await require("../models/vocabModel").findOne({ user: user.id });
	const review = await request(`/vocab/${word.id}/review`, "POST", { mode: "writing", answer: "apple", reviewId: require("node:crypto").randomUUID() }); assert.equal(review.status, 200); assert.equal(review.cache, "private, no-store");
	const ids = ["asking-for-directions", "finding-a-cafe", "1"];
	const progress = await request(`/dialogue-progress/${ids[0]}/${ids[1]}/tasks/${ids[2]}`, "PATCH", await completionFor(user.id, ids)); assert.equal(progress.status, 200); assert.equal(progress.cache, "private, no-store");
	for (const path of ["/topics", "/vocab", "/study-activities", "/dialogue-progress/latest", "/leaderboard"]) {
		const result = await request(path); assert.equal(result.status, 200); assert.equal(result.cache, "private, no-store");
		if (path === "/leaderboard") for (const entry of result.body.data.leaderboard) assert.equal(entry.email, undefined);
	}
	const malformed = await request("/vocab/not-an-object-id"); assert.equal(malformed.status, 400); assert.doesNotMatch(JSON.stringify(malformed.body), /Cast|ObjectId|Mongoose|not-an-object-id/);
});
