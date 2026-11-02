const assert = require("node:assert/strict");
const { after, before, beforeEach, test } = require("node:test");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const Feedback = require("../models/feedbackModel");
const User = require("../models/userModel");

const frontend = "http://localhost:3000";
const secret = "isolated-admin-feedback-test-secret";
const password = "isolated-admin-feedback-password";
const envKeys = ["NODE_ENV", "FRONTEND_URL", "JWT_SECRET", "JWT_EXPIRES_IN"];
const previousEnv = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
let db;
let server;
let baseUrl;
let userSequence = 0;

before(async () => {
	Object.assign(process.env, {
		NODE_ENV: "development",
		FRONTEND_URL: frontend,
		JWT_SECRET: secret,
		JWT_EXPIRES_IN: "1h",
	});
	db = await MongoMemoryReplSet.create({ binary: { version: "7.0.14" }, replSet: { count: 1 } });
	await mongoose.connect(db.getUri(), { dbName: "admin_feedback_test" });
	await Promise.all([Feedback.init(), User.init()]);
	const app = require("../app");
	server = await new Promise((resolve) => {
		const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
	});
	baseUrl = `http://127.0.0.1:${server.address().port}/api/v1/admin/feedback`;
}, { timeout: 180000 });

after(async () => {
	if (server) await new Promise((resolve) => server.close(resolve));
	await mongoose.disconnect();
	await db?.stop();
	for (const [key, value] of Object.entries(previousEnv)) {
		if (value === undefined) delete process.env[key];
		else process.env[key] = value;
	}
});

beforeEach(async () => {
	await Promise.all([Feedback.deleteMany({}), User.deleteMany({})]);
});

async function createSession(role) {
	const user = await User.create({
		name: role === "admin" ? "Admin Tester" : "User Tester",
		email: `${role}-${++userSequence}@example.test`,
		password,
		passwordConfirm: password,
		role,
	});
	return jwt.sign({ id: user.id }, secret, { expiresIn: "1h" });
}

async function request(path = "", { method = "GET", token, body, origin = frontend } = {}) {
	const headers = { Origin: origin };
	if (token) headers.Cookie = `jwt=${token}`;
	if (body !== undefined) headers["Content-Type"] = "application/json";
	const response = await fetch(`${baseUrl}${path}`, {
		method,
		headers,
		...(body === undefined ? {} : { body: JSON.stringify(body) }),
	});
	return { status: response.status, headers: response.headers, body: response.status === 204 ? null : await response.json() };
}

test("guest and normal users cannot access any admin feedback endpoint", async () => {
	const userToken = await createSession("user");
	const item = await Feedback.create({ type: "suggestion", message: "Keep adding useful dialogues." });
	const endpoints = [
		["", "GET"],
		["/unread-count", "GET"],
		[`/${item.id}/status`, "PATCH", { status: "resolved" }],
		[`/${item.id}`, "DELETE"],
	];
	for (const [path, method, body] of endpoints) {
		assert.equal((await request(path, { method, body })).status, 401, `guest ${method} ${path}`);
		assert.equal((await request(path, { method, body, token: userToken })).status, 403, `user ${method} ${path}`);
	}
	assert.equal((await Feedback.findById(item.id)).status, "new");
	assert.equal(await Feedback.countDocuments(), 1);
});

test("admin unread count includes only new feedback and legacy records without a status", async () => {
	const adminToken = await createSession("admin");
	const newSuggestion = await Feedback.create({ type: "suggestion", message: "A new suggestion for the count." });
	await Feedback.create({ type: "bug", message: "A new bug report for the count.", status: "new" });
	await Feedback.create({ type: "general", message: "A suggestion already being reviewed.", status: "reviewing" });
	await Feedback.create({ type: "suggestion", message: "An already resolved suggestion.", status: "resolved" });
	const legacy = await Feedback.collection.insertOne({ type: "suggestion", message: "A legacy record without status." });

	const initial = await request("/unread-count", { token: adminToken });
	assert.equal(initial.status, 200);
	assert.equal(initial.headers.get("cache-control"), "private, no-store");
	assert.deepEqual(initial.body, { status: "success", data: { count: 3 } });

	assert.equal((await request(`/${newSuggestion.id}/status`, {
		method: "PATCH", token: adminToken, body: { status: "reviewing" },
	})).status, 200);
	assert.deepEqual((await request("/unread-count", { token: adminToken })).body.data, { count: 2 });

	assert.equal((await request(`/${legacy.insertedId}/status`, {
		method: "PATCH", token: adminToken, body: { status: "resolved" },
	})).status, 200);
	assert.deepEqual((await request("/unread-count", { token: adminToken })).body.data, { count: 1 });
});

test("admin can list newest first with pagination and filters, update status, and delete", async () => {
	const adminToken = await createSession("admin");
	const older = await Feedback.create({ type: "suggestion", message: "Older feedback message.", createdAt: new Date("2026-01-01T00:00:00Z") });
	const middle = await Feedback.create({ type: "bug", message: "Middle bug report message.", status: "reviewing", createdAt: new Date("2026-02-01T00:00:00Z") });
	const legacy = await Feedback.collection.insertOne({ type: "bug", message: "Legacy feedback without status.", createdAt: new Date("2026-03-01T00:00:00Z") });

	const firstPage = await request("?page=1&limit=2", { token: adminToken });
	assert.equal(firstPage.status, 200);
	assert.equal(firstPage.headers.get("cache-control"), "private, no-store");
	assert.deepEqual(firstPage.body.data.feedback.map(({ _id, status }) => ({ id: String(_id), status })), [
		{ id: String(legacy.insertedId), status: "new" },
		{ id: middle.id, status: "reviewing" },
	]);
	assert.deepEqual(firstPage.body.data.pagination, { page: 1, limit: 2, totalRecords: 3, totalPages: 2 });
	assert.deepEqual(firstPage.body.data.feedback.map((record) => Object.keys(record).sort()), [
		["_id", "createdAt", "message", "status", "type"],
		["_id", "createdAt", "message", "status", "type"],
	]);

	const secondPage = await request("?page=2&limit=2", { token: adminToken });
	assert.deepEqual(secondPage.body.data.feedback.map((record) => String(record._id)), [older.id]);
	const filtered = await request("?type=bug&status=new", { token: adminToken });
	assert.deepEqual(filtered.body.data.feedback.map((record) => String(record._id)), [String(legacy.insertedId)]);

	const updated = await request(`/${middle.id}/status`, { method: "PATCH", token: adminToken, body: { status: "resolved" } });
	assert.equal(updated.status, 200);
	assert.equal(updated.body.data.feedback.status, "resolved");
	assert.equal((await Feedback.findById(middle.id)).status, "resolved");

	const deleted = await request(`/${middle.id}`, { method: "DELETE", token: adminToken });
	assert.equal(deleted.status, 204);
	assert.equal(await Feedback.exists({ _id: middle.id }), null);
});

test("admin filters, pagination and mutation bodies are validated", async () => {
	const adminToken = await createSession("admin");
	const item = await Feedback.create({ type: "general", message: "Validate admin feedback input." });
	for (const query of ["?type=unknown", "?status=done", "?page=0", "?page=1.5", "?page=9007199254740991&limit=50", "?limit=51", "?unknown=value", "?type=bug&type=general"]) {
		assert.equal((await request(query, { token: adminToken })).status, 400, query);
	}
	for (const body of [{ status: "done" }, { status: "resolved", role: "user" }, {}, null]) {
		assert.equal((await request(`/${item.id}/status`, { method: "PATCH", token: adminToken, body })).status, 400);
	}
	assert.equal((await request("/not-an-object-id/status", { method: "PATCH", token: adminToken, body: { status: "resolved" } })).status, 400);
	assert.equal((await request("/not-an-object-id", { method: "DELETE", token: adminToken })).status, 400);
	assert.equal((await Feedback.findById(item.id)).status, "new");
});

test("cookie mutations require the configured same-origin CSRF policy", async () => {
	const adminToken = await createSession("admin");
	const item = await Feedback.create({ type: "bug", message: "A report for CSRF testing." });
	for (const [path, method, body] of [
		[`/${item.id}/status`, "PATCH", { status: "resolved" }],
		[`/${item.id}`, "DELETE", undefined],
	]) {
		assert.equal((await request(path, { method, body, token: adminToken, origin: "https://attacker.example" })).status, 403);
	}
	assert.equal((await Feedback.findById(item.id)).status, "new");
	assert.equal(await Feedback.countDocuments(), 1);
	assert.equal((await request(`/${item.id}/status`, { method: "PATCH", token: adminToken, body: { status: "resolved" } })).status, 200);
	assert.equal((await request(`/${item.id}`, { method: "DELETE", token: adminToken })).status, 204);
});
