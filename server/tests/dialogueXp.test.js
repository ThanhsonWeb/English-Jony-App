const assert = require("node:assert/strict");
const { before, after, beforeEach, test } = require("node:test");
const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const User = require("../models/userModel");
const DialogueProgress = require("../models/dialogueProgressModel");
const XPEvent = require("../models/xpEventModel");
const awardXp = require("../services/awardXp");
const dialogueRoutes = require("../routes/dialogueProgressRoutes");

let replicaSet;
let server;
let baseUrl;
let user;
let token;
const previousSecret = process.env.JWT_SECRET;
const testSecret = "isolated-dialogue-xp-test-secret";

before(async () => {
	process.env.JWT_SECRET = testSecret;
	// No .env, application database, or external services are used.
	replicaSet = await MongoMemoryReplSet.create({
		binary: { version: "7.0.14" }, replSet: { count: 1, storageEngine: "wiredTiger" },
	});
	await mongoose.connect(replicaSet.getUri(), { dbName: "dialogue_xp_test" });
	await Promise.all([User.init(), DialogueProgress.init(), XPEvent.init()]);
	const app = express();
	app.use(express.json());
	app.use("/api/v1/dialogue-progress", dialogueRoutes);
	app.use((error, req, res, next) => {
		res.status(error.statusCode || 500).json({ code: error.code, message: error.message });
	});
	server = await new Promise(resolve => {
		const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
	});
	baseUrl = `http://127.0.0.1:${server.address().port}/api/v1/dialogue-progress`;
}, { timeout: 180000 });

after(async () => {
	if (server) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
	await mongoose.disconnect();
	await replicaSet?.stop();
	if (previousSecret === undefined) delete process.env.JWT_SECRET;
	else process.env.JWT_SECRET = previousSecret;
});

beforeEach(async () => {
	await Promise.all([DialogueProgress.deleteMany({}), XPEvent.deleteMany({}), User.deleteMany({})]);
	user = await User.create({ name: "Test Learner", email: "dialogue@example.com", googleId: "dialogue-test" });
	token = jwt.sign({ id: user.id }, testSecret, { expiresIn: "1h" });
});

async function complete(taskId = "1", { lessonId = "course", dialogueId = "dialogue", authToken = token, body = {} } = {}) {
	const response = await fetch(`${baseUrl}/${encodeURIComponent(lessonId)}/${encodeURIComponent(dialogueId)}/tasks/${encodeURIComponent(taskId)}`, {
		method: "PATCH",
		headers: { "Content-Type": "application/json", ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) },
		body: JSON.stringify(body),
	});
	return { status: response.status, body: await response.json() };
}

function success(response) {
	assert.equal(response.status, 200, JSON.stringify(response.body));
	assert.equal(response.body.status, "success");
	return response.body.data;
}

async function assertState(taskIds, totalXp, eventCount) {
	const progress = await DialogueProgress.findOne({ user: user._id }).lean();
	assert.deepEqual([...progress.completedTaskIds].sort(), [...taskIds].sort());
	assert.equal((await User.findById(user._id)).totalXp, totalXp);
	assert.equal(await XPEvent.countDocuments({ user: user._id }), eventCount);
}

test("first completion preserves the progress response and awards exactly 10 XP", async () => {
	const data = success(await complete());
	assert.deepEqual(data.progress.completedTaskIds, ["1"]);
	assert.deepEqual(data.xp, { awarded: 10, total: 10, reason: "awarded" });
	const event = await XPEvent.findOne().lean();
	assert.equal(event.awardKey, "dialogue:course:dialogue:1");
	assert.equal(event.sourceType, "dialogue_task");
	assert.equal(event.sourceId, "course/dialogue/1");
	await assertState(["1"], 10, 1);
});

test("duplicate submission returns zero without duplicating the task ID", async () => {
	success(await complete());
	const retry = success(await complete());
	assert.deepEqual(retry.xp, { awarded: 0, total: 10, reason: "already_completed" });
	await assertState(["1"], 10, 1);
});

test("replaying an earlier task after completing another task gives zero XP", async () => {
	success(await complete("1"));
	success(await complete("2"));
	assert.deepEqual(success(await complete("1")).xp, { awarded: 0, total: 20, reason: "already_completed" });
	await assertState(["1", "2"], 20, 2);
});

test("legacy completion without an XP event does not receive a replay reward", async () => {
	await DialogueProgress.create({ user: user._id, lessonId: "course", dialogueId: "dialogue", completedTaskIds: ["1"] });
	assert.deepEqual(success(await complete()).xp, { awarded: 0, total: 0, reason: "already_completed" });
	await assertState(["1"], 0, 0);
	success(await complete("2"));
	await assertState(["1", "2"], 10, 1);
});

test("concurrent duplicate HTTP requests create one progress record and one award", async () => {
	const results = (await Promise.all(Array.from({ length: 12 }, () => complete()))).map(success);
	assert.equal(results.reduce((sum, result) => sum + result.xp.awarded, 0), 10);
	assert.equal(results.filter(result => result.xp.reason === "awarded").length, 1);
	assert.equal(results.filter(result => result.xp.reason === "already_completed").length, 11);
	assert.equal(await DialogueProgress.countDocuments(), 1);
	await assertState(["1"], 10, 1);
});

test("concurrent different tasks retain every completed ID and reward", async () => {
	const tasks = ["1", "2", "3", "4"];
	(await Promise.all(tasks.map(task => complete(task)))).forEach(success);
	await assertState(tasks, 40, 4);
});

test("existing XP event prevents another award if progress needs restoring", async () => {
	await awardXp({ userId: user._id, awardKey: "dialogue:course:dialogue:1", sourceType: "dialogue_task", sourceId: "course/dialogue/1", amount: 10 });
	assert.deepEqual(success(await complete()).xp, { awarded: 0, total: 10, reason: "already_awarded" });
	await assertState(["1"], 10, 1);
});

test("failed XP write rolls back progress and the event; retry can still earn XP", async (t) => {
	const stub = t.mock.method(User, "findOneAndUpdate", () => { throw new Error("Simulated XP write failure"); });
	try {
		assert.equal((await complete()).status, 500);
	} finally {
		stub.mock.restore();
	}
	assert.equal(await DialogueProgress.countDocuments(), 0);
	assert.equal(await XPEvent.countDocuments(), 0);
	assert.equal((await User.findById(user._id)).totalXp, 0);
	assert.equal(success(await complete()).xp.awarded, 10);
	await assertState(["1"], 10, 1);
});

test("the authenticated user and server amount override submitted reward fields", async () => {
	const other = await User.create({ name: "Other Learner", email: "other@example.com", googleId: "other-test" });
	const data = success(await complete("1", { body: { userId: other.id, amount: 999, totalXp: 999, awardKey: "fake" } }));
	assert.equal(data.xp.awarded, 10);
	await assertState(["1"], 10, 1);
	assert.equal((await User.findById(other.id)).totalXp, 0);
});

test("unauthenticated completion cannot save progress or earn XP", async () => {
	assert.equal((await complete("1", { authToken: null })).status, 401);
	assert.equal(await DialogueProgress.countDocuments(), 0);
	assert.equal(await XPEvent.countDocuments(), 0);
});

test("delimiter characters do not create ambiguous award keys", async () => {
	success(await complete("1", { lessonId: "a:b", dialogueId: "c" }));
	success(await complete("1", { lessonId: "a", dialogueId: "b:c" }));
	assert.equal(await XPEvent.countDocuments(), 2);
	assert.equal((await User.findById(user._id)).totalXp, 20);
});
