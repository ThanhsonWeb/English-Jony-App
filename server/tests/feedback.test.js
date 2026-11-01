const assert = require("node:assert/strict");
const { after, before, beforeEach, test } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const Feedback = require("../models/feedbackModel");

const previousNodeEnv = process.env.NODE_ENV;
const previousFrontendUrl = process.env.FRONTEND_URL;
process.env.NODE_ENV = "development";
process.env.FRONTEND_URL = "http://localhost:3000";

let db;
let server;
let baseUrl;
before(async () => {
	db = await MongoMemoryReplSet.create({ binary: { version: "7.0.14" }, replSet: { count: 1 } });
	await mongoose.connect(db.getUri(), { dbName: "feedback_test" });
	await Feedback.init();
	const app = require("../app");
	server = await new Promise((resolve) => {
		const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
	});
	baseUrl = `http://127.0.0.1:${server.address().port}/api/v1/feedback`;
}, { timeout: 180000 });

after(async () => {
	if (server) await new Promise((resolve) => server.close(resolve));
	await mongoose.disconnect();
	await db?.stop();
	if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
	else process.env.NODE_ENV = previousNodeEnv;
	if (previousFrontendUrl === undefined) delete process.env.FRONTEND_URL;
	else process.env.FRONTEND_URL = previousFrontendUrl;
});

beforeEach(async () => Feedback.deleteMany({}));

async function post(body) {
	return fetch(baseUrl, {
		method: "POST",
		headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
		body: JSON.stringify(body),
	});
}

test("guest can submit feedback and the response never returns the message", async () => {
	const response = await post({ type: "suggestion", message: "Please add more travel dialogues." });
	assert.equal(response.status, 201);
	assert.deepEqual(await response.json(), { status: "success" });
	assert.deepEqual(await Feedback.find().select("-_id type message").lean(), [
		{ type: "suggestion", message: "Please add more travel dialogues." },
	]);
});

test("invalid types, short messages, long messages, and unexpected fields are rejected", async () => {
	for (const body of [
		{ type: "other", message: "This message is long enough." },
		{ type: "bug", message: "short" },
		{ type: "general", message: "x".repeat(2001) },
		{ type: "bug", message: "This message is long enough.", email: "visitor@example.test" },
	]) {
		const response = await post(body);
		assert.equal(response.status, 400);
	}
	assert.equal(await Feedback.countDocuments(), 0);
});

test("honeypot submissions receive a quiet acknowledgement and are not stored", async () => {
	const response = await post({ type: "general", message: "This looks like a real message.", website: "spam" });
	assert.equal(response.status, 202);
	assert.deepEqual(await response.json(), { status: "success" });
	assert.equal(await Feedback.countDocuments(), 0);
});

test("feedback submissions require the configured frontend origin", async () => {
	for (const origin of ["https://attacker.example", null]) {
		const headers = { "Content-Type": "application/json" };
		if (origin) headers.Origin = origin;
		const response = await fetch(baseUrl, {
			method: "POST",
			headers,
			body: JSON.stringify({ type: "general", message: "A valid length feedback message." }),
		});
		assert.equal(response.status, 403);
	}
	assert.equal(await Feedback.countDocuments(), 0);
});

test("feedback is not publicly readable", async () => {
	const response = await fetch(baseUrl, { headers: { Origin: "http://localhost:3000" } });
	assert.equal(response.status, 404);
	assert.equal(await Feedback.countDocuments(), 0);
});

test("repeated submissions from one client are rate limited", async () => {
	let accepted = 0;
	let limited = false;
	for (let index = 0; index < 25; index++) {
		const response = await post({ type: "general", message: `Repeated feedback number ${index}.` });
		if (response.status === 429) {
			limited = true;
			break;
		}
		assert.equal(response.status, 201);
		accepted++;
	}
	assert.equal(limited, true);
	assert.ok(accepted > 0);
	assert.equal(await Feedback.countDocuments(), accepted);
});
