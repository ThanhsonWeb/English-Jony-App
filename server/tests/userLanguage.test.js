const assert = require("node:assert/strict");
const { before, after, test } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const User = require("../models/userModel");
const app = require("../app");
const origin = "https://studyjony.test";
const env = { NODE_ENV: "production", FRONTEND_URL: origin, JWT_SECRET: "local-language-fixture-key", JWT_EXPIRES_IN: "1h" };
const previous = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
let mongo, server, base, a, b;

before(async () => {
	Object.assign(process.env, env);
	mongo = await MongoMemoryServer.create({ binary: { version: "7.0.14" } });
	await mongoose.connect(mongo.getUri(), { dbName: "user_language_fixture" });
	await User.init();
	[a, b] = await User.create([
		{ name: "Language A", email: "language-a@example.test", googleId: "language-a", language: "vi" },
		{ name: "Language B", email: "language-b@example.test", googleId: "language-b", language: "en" },
	]);
	server = await new Promise(resolve => { const listener = app.listen(0, "127.0.0.1", () => resolve(listener)); });
	base = `http://127.0.0.1:${server.address().port}/api/v1`;
}, { timeout: 180000 });
after(async () => {
	if (server) await new Promise(resolve => server.close(resolve));
	await mongoose.disconnect(); await mongo?.stop();
	for (const [key, value] of Object.entries(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
});
const token = user => require("jsonwebtoken").sign({ id: user.id }, env.JWT_SECRET, { expiresIn: "1h" });
async function request(user, body, extraHeaders = {}) {
	const response = await fetch(base + (body === undefined ? "/users/me" : "/users/language"), {
		method: body === undefined ? "GET" : "PATCH",
		headers: { "Content-Type": "application/json", Origin: origin, ...(user ? { Cookie: `jwt=${token(user)}` } : {}), ...extraHeaders },
		...(body === undefined ? {} : { body: JSON.stringify(body) }),
	});
	return { status: response.status, cache: response.headers.get("cache-control"), body: await response.json() };
}

test("two accounts retain separate choices across independent sessions and refreshes", async () => {
	for (const language of ["en", "vi"]) {
		const saved = await request(a, { language, expectedUserId: a.id });
		assert.equal(saved.status, 200); assert.equal(saved.cache, "private, no-store");
		assert.equal((await request(a)).body.data.user.language, language);
		assert.equal((await request(b)).body.data.user.language, "en");
	}
	assert.equal((await User.findById(a.id)).language, "vi");
	assert.equal((await User.findById(b.id)).language, "en");
	assert.equal(await mongoose.connection.db.listCollections({ name: "mobileloginwindows" }).hasNext(), false, "Language preferences require no mobile rate-limit collection");
});

test("stale account writes, invalid inputs, guests and cross-origin requests cannot change preferences", async () => {
	assert.equal((await request(b, { language: "vi", expectedUserId: a.id })).status, 409);
	for (const body of [{ language: "fr", expectedUserId: b.id }, { language: { $ne: null }, expectedUserId: b.id },
		{ language: "vi", expectedUserId: b.id, role: "admin" }, { language: "vi" },
	]) assert.ok([400, 409].includes((await request(b, body)).status));
	assert.equal((await request(null, { language: "en", expectedUserId: a.id })).status, 401);
	assert.equal((await request(a, { language: "en", expectedUserId: a.id }, { Origin: "https://attacker.test" })).status, 403);
	assert.equal((await User.findById(a.id)).language, "vi");
	assert.equal((await User.findById(b.id)).language, "en");
});

test("legacy accounts have a deterministic default without copying browser preferences", async () => {
	await User.collection.updateOne({ _id: a._id }, { $unset: { language: "" } });
	const restored = await request(a, undefined, { Cookie: `jwt=${token(a)}; NEXT_LOCALE=en; sj_guest_language=en` });
	assert.equal(restored.body.data.user.language, "vi");
	assert.equal(restored.cache, "private, no-store");
	assert.equal((await request(b)).body.data.user.language, "en");
	assert.equal((await User.collection.findOne({ _id: a._id })).language, undefined, "restoration is not a data migration");
});
