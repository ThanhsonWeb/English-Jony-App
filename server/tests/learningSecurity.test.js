const { completionFor, idsFromPath } = require("./helpers/learningAttempt");
const assert = require("node:assert/strict");
const { test, before, after, beforeEach } = require("node:test");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const User = require("../models/userModel");
const DialogueProgress = require("../models/dialogueProgressModel");
const StudyActivity = require("../models/studyActivityModel");
const XPEvent = require("../models/xpEventModel");
const { getStudyStreaks } = require("../services/studyStreak");
const learningLimits = require("../middleware/learningRateLimit");
const originalGuards = { peer: learningLimits.peer, user: learningLimits.user };
const frontend = "https://studyjony.test";
const env = { NODE_ENV: "production", FRONTEND_URL: frontend, JWT_SECRET: "isolated-learning-security", JWT_EXPIRES_IN: "1h" };
const previous = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
const dialogue = "/dialogue-progress/asking-for-directions/finding-a-cafe/tasks/1";
const story = "/dialogue-progress/ten-minutes-a-day/the-old-book/tasks/1";
let db, server, url, userA, userB, tokenA, tokenB, activeLimits;
function resetLimits(overrides = {}) {
	activeLimits = learningLimits.createLearningRateLimits({ ...learningLimits.learningRateLimitPolicy,
		readPeer: 100, writePeer: 100, readUser: 20, writeUser: 8, ...overrides });
}
before(async () => {
	Object.assign(process.env, env);
	db = await MongoMemoryReplSet.create({ binary: { version: "7.0.14" }, replSet: { count: 1 } });
	await mongoose.connect(db.getUri(), { dbName: "learning_security" });
	await Promise.all([User, DialogueProgress, StudyActivity, XPEvent].map(model => model.init()));
	// Real production routers/controllers/auth/CSRF, with small test-only windows/budgets.
	learningLimits.peer = (req, res, next) => activeLimits.peer(req, res, next);
	learningLimits.user = (req, res, next) => activeLimits.user(req, res, next);
	const app = require("../app");
	server = await new Promise(resolve => { const listener = app.listen(0, "127.0.0.1", () => resolve(listener)); });
	url = `http://127.0.0.1:${server.address().port}/api/v1`;
}, { timeout: 180000 });
after(async () => {
	Object.assign(learningLimits, originalGuards);
	if (server) await new Promise(resolve => server.close(resolve));
	await mongoose.disconnect(); await db?.stop();
	for (const [key, value] of Object.entries(previous)) {
		if (value === undefined) delete process.env[key]; else process.env[key] = value;
	}
});
beforeEach(async () => {
	resetLimits();
	await Promise.all([User, DialogueProgress, StudyActivity, XPEvent].map(model => model.deleteMany({})));
	[userA, userB] = await User.create([
		{ name: "Learner A", email: "a@example.test", googleId: "isolated-a" },
		{ name: "Learner B", email: "b@example.test", googleId: "isolated-b" },
	]);
	tokenA = jwt.sign({ id: userA.id }, env.JWT_SECRET, { expiresIn: "1h" });
	tokenB = jwt.sign({ id: userB.id }, env.JWT_SECRET, { expiresIn: "1h" });
});
async function request(path, method = "GET", { token = tokenA, body, headers = {} } = {}) {
	const values = { Origin: frontend, ...(token ? { Cookie: `jwt=${token}` } : {}), "Content-Type": "application/json", ...headers };
	if (method === "PATCH" && token && idsFromPath(path) && require("../utils/dialogueCatalogue").isKnownDialogueTask(...idsFromPath(path))) body = { ...await completionFor(jwt.decode(token).id, idsFromPath(path)), ...body };
	const response = await fetch(url + path, { method, headers: values, ...(body ? { body: JSON.stringify(body) } : {}) });
	return { status: response.status, headers: response.headers, body: await response.json() };
}
const limited = response => { assert.equal(response.status, 429); assert.equal(response.body.code, "learningRateLimited"); assert.ok(Number(response.headers.get("retry-after")) >= 1); };

test("normal Dialogue/Story reads, writes, replay and activity preserve XP, streak and heatmap semantics", async () => {
	assert.equal((await request("/dialogue-progress/asking-for-directions")).status, 200);
	assert.equal((await request("/dialogue-progress/ten-minutes-a-day")).status, 200);
	assert.equal((await request(dialogue, "PATCH")).body.data.xp.awarded, 10);
	assert.equal((await request(story, "PATCH")).body.data.xp.awarded, 10);
	assert.equal((await request(story, "PATCH")).body.data.xp.awarded, 0);
	assert.equal((await request("/study-activities", "POST")).status, 405);
	const activities = (await request("/study-activities")).body.data.activities;
	assert.equal(activities.length, 1); assert.equal(activities[0].count, 0); assert.equal(activities[0].hasQualifiedStudy, true);
	const { buildStudyHeatmapDays } = await import("../../client/app/_lib/studyHeatmap.mjs");
	assert.equal(buildStudyHeatmapDays(activities).filter(day => day.level > 0).length, 1);
	assert.equal((await getStudyStreaks([userA._id])).get(userA.id).streakDays, 1);
	assert.equal(await XPEvent.countDocuments({ user: userA.id }), 2);
	assert.equal((await User.findById(userA.id)).totalXp, 20);
	assert.equal((await request("/dialogue-progress/latest", "GET", { token: tokenB })).body.data.progress, null);
});

test("shared user write quota blocks altered task IDs, payloads and activity without extra rewards", async () => {
	resetLimits({ writeUser: 3 });
	assert.equal((await request(dialogue, "PATCH")).status, 200);
	assert.equal((await request(dialogue, "PATCH")).body.data.xp.awarded, 0);
	assert.equal((await request(story, "PATCH")).status, 200);
	limited(await request(dialogue.replace(/1$/, "2"), "PATCH", { body: { user: userB.id, xp: 999 }, headers: { "X-Forwarded-For": "198.51.100.2" } }));
	limited(await request("/study-activities", "POST", { headers: { "X-Forwarded-For": "203.0.113.5" } }));
	assert.equal((await request("/dialogue-progress/latest")).status, 200);
	assert.equal(await XPEvent.countDocuments({ user: userA.id }), 2);
	assert.equal((await User.findById(userA.id)).totalXp, 20);
	assert.equal((await StudyActivity.findOne({ user: userA.id })).count, 0);
	assert.equal((await request(story, "PATCH", { token: tokenB })).status, 200, "Another user behind the same peer can study");
});

test("unauthenticated/expired requests consume only the peer budget; forwarding spoof cannot bypass it", async () => {
	resetLimits({ writePeer: 2 });
	assert.equal((await request(dialogue, "PATCH", { token: null })).status, 401);
	const expired = jwt.sign({ id: userA.id }, env.JWT_SECRET, { expiresIn: -1 });
	assert.equal((await request(story, "PATCH", { token: expired, headers: { "X-Forwarded-For": "198.51.100.2" } })).status, 401);
	limited(await request("/study-activities", "POST", { headers: { "X-Forwarded-For": "203.0.113.9" } }));
	assert.equal(await DialogueProgress.countDocuments(), 0); assert.equal(await StudyActivity.countDocuments(), 0); assert.equal(await XPEvent.countDocuments(), 0);
});

test("F09 rejects foreign/null origins before consuming learning write quotas", async () => {
	resetLimits({ writePeer: 1, writeUser: 1 });
	for (const Origin of ["https://attacker.test", "null"]) assert.equal((await request(dialogue, "PATCH", { headers: { Origin } })).status, 403);
	assert.equal((await request(dialogue, "PATCH")).status, 200);
	limited(await request(story, "PATCH"));
	assert.equal((await request("/users/me")).body.data.user._id, userA.id);
});

test("read exhaustion does not stop legitimate completion; failed tasks still spend write budget", async () => {
	resetLimits({ readUser: 1, writeUser: 2 });
	assert.equal((await request("/study-activities")).status, 200);
	limited(await request("/dialogue-progress/latest"));
	assert.equal((await request(dialogue, "PATCH")).status, 200);
	assert.equal((await request(dialogue.replace(/1$/, "unknown"), "PATCH")).status, 404);
	limited(await request(story, "PATCH"));
	assert.equal(await XPEvent.countDocuments(), 1);
});

test("429 save failure can safely retry after window expiry without duplicate XP or streak days", async () => {
	resetLimits({ windowMs: 1000, writeUser: 1 });
	assert.equal((await request(dialogue, "PATCH")).body.data.xp.awarded, 10);
	limited(await request(dialogue, "PATCH"));
	await new Promise(resolve => setTimeout(resolve, 1100));
	assert.equal((await request(dialogue, "PATCH")).body.data.xp.awarded, 0);
	assert.equal(await XPEvent.countDocuments(), 1); assert.equal(await StudyActivity.countDocuments(), 1);
	assert.deepEqual((await DialogueProgress.findOne()).completedTaskIds, ["1"]);
	assert.equal((await User.findById(userA.id)).totalXp, 10);
});
