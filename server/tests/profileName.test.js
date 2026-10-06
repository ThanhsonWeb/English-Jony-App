const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const express = require("express");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const { MongoMemoryServer } = require("mongodb-memory-server");
const User = require("../models/userModel");
const Topic = require("../models/topicModel");
const rules = require("../utils/profileName");
let db, server, url, users;
const secret = "isolated-profile-name-test-secret";
const previous = Object.fromEntries(["JWT_SECRET", "JWT_EXPIRES_IN", "NODE_ENV"].map(key => [key, process.env[key]]));
before(async () => {
	Object.assign(process.env, { JWT_SECRET: secret, JWT_EXPIRES_IN: "1h", NODE_ENV: "production" });
	db = await MongoMemoryServer.create({ binary: { version: "7.0.14" } });
	await mongoose.connect(db.getUri(), { dbName: "profile_name_test" });
	users = await User.create([
		{ name: "Password learner", email: "password@example.com", password: "password-123", passwordConfirm: "password-123" },
		{ name: "Google learner", email: "google@example.com", googleId: "google-test-id" },
	]);
	const app = express(); app.use(express.json(), cookieParser());
	app.use("/users", require("../routes/userRoutes"));
	app.use("/topics", require("../routes/topicRoutes"));
	app.use(require("../controllers/errorController"));
	server = await new Promise(resolve => { const listener = app.listen(0, "127.0.0.1", () => resolve(listener)); });
	url = `http://127.0.0.1:${server.address().port}`;
}, { timeout: 180000 });
after(async () => {
	if (server) await new Promise(resolve => server.close(resolve));
	await mongoose.disconnect(); await db?.stop();
	for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
});
function patch(path, user, body) {
	return fetch(url + path, { method: "PATCH", headers: { "Content-Type": "application/json", Cookie: `jwt=${jwt.sign({ id: user.id }, secret)}` }, body: JSON.stringify(body) });
}
test("frontend and API name rules match Mongoose's trimmed 3–20 character limits", async () => {
	const clientRules = await import("../../client/app/_lib/profileName.mjs");
	for (const [name, expected] of [["", "nameRequired"], ["  ", "nameRequired"], [null, "nameRequired"], [42, "nameRequired"], ["ab", "nameTooShort"], ["  abc  ", null], ["a".repeat(20), null], ["a".repeat(21), "nameTooLong"], ["Nguyễn Ánh", null], ["😀a", null]]) {
		assert.equal(rules.validateProfileName(name), expected);
		assert.equal(clientRules.validateProfileName(name), expected);
		if (typeof name === "string" && name.trim()) {
			const user = new User({ name, email: "test@example.com", googleId: "test" });
			assert.equal(Boolean(user.validateSync()?.errors.name), expected !== null);
		}
	}
});
for (const [index, type] of ["password", "Google"].entries()) {
	test(`${type} account: invalid profile names give safe 400 feedback without changing saved data`, async () => {
		const user = users[index], before = (await User.findById(user.id)).name;
		for (const [name, code] of [["", "nameRequired"], ["  ", "nameRequired"], [null, "nameRequired"], [42, "nameRequired"], ["ab", "nameTooShort"], ["a".repeat(21), "nameTooLong"]]) {
			const response = await patch("/users/updateMe", user, { name });
			assert.equal(response.status, 400);
			const body = await response.json(); assert.equal(body.code, code); assert.equal(body.status, "fail");
			assert.equal(body.stack, undefined); assert.equal(body.error, undefined);
			assert.equal((await User.findById(user.id)).name, before);
		}
	});
	test(`${type} account: boundary/Unicode valid names save, trim, and preserve password/session fields`, async () => {
		const user = users[index], original = await User.findById(user.id).select("+password");
		for (const name of ["abc", "a".repeat(20), "  Nguyễn Ánh  "]) {
			const response = await patch("/users/updateMe", user, { name });
			assert.equal(response.status, 200); assert.equal((await response.json()).data.user.name, name.trim());
			const stored = await User.findById(user.id).select("+password");
			assert.equal(stored.password, original.password); assert.equal(stored.googleId, original.googleId);
			assert.equal(stored.passwordSessionVersion, original.passwordSessionVersion);
			assert.equal((await fetch(url + "/users/me", { headers: { Cookie: `jwt=${jwt.sign({ id: user.id }, secret)}` } })).status, 200);
		}
	});
}
test("topic validation failure preserves the saved name; a valid retry updates exactly one topic", async () => {
	const topic = await Topic.create({ name: "Original topic", user: users[0].id });
	const failed = await patch(`/topics/${topic.id}`, users[0], { name: "" });
	assert.equal(failed.status, 400); assert.equal((await Topic.findById(topic.id)).name, "Original topic");
	const retry = await patch(`/topics/${topic.id}`, users[0], { name: "Edited topic", description: "Notes" });
	assert.equal(retry.status, 200); assert.equal((await retry.json()).data.updatedTopic.name, "Edited topic");
	assert.equal(await Topic.countDocuments(), 1);
});
