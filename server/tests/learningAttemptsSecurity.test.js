const assert = require("node:assert/strict");
const { test, before, after, beforeEach } = require("node:test");
const { randomUUID } = require("node:crypto");
const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const User = require("../models/userModel");
const Vocab = require("../models/vocabModel");
const StudyActivity = require("../models/studyActivityModel");
const XPEvent = require("../models/xpEventModel");
const DialogueProgress = require("../models/dialogueProgressModel");
const DialogueAttempt = require("../models/dialogueAttemptModel");
const ReviewEvent = require("../models/vocabularyReviewEventModel");
const { reviewVocabulary } = require("../services/vocabularyReview");
const { startDialogueAttempt, validateCompletion, minimumAttemptMs } = require("../services/dialogueAttempt");
const { getStudyStreaks } = require("../services/studyStreak");
const { completionFor } = require("./helpers/learningAttempt");
const rules = require("../data/dialogueTaskRules.json");
let db, server, url, user, other, word, token;
const models = [User, Vocab, StudyActivity, XPEvent, DialogueProgress, DialogueAttempt, ReviewEvent];
const oldSecret = process.env.JWT_SECRET;
before(async () => {
	process.env.JWT_SECRET = "isolated-learning-attempts";
	db = await MongoMemoryReplSet.create({ binary: { version: "7.0.14" }, replSet: { count: 1 } });
	await mongoose.connect(db.getUri(), { dbName: "learning_attempts" });
	await Promise.all(models.map(model => model.init()));
	const app = express(); app.use(express.json());
	app.use("/api/v1/vocab", require("../routes/vocabRoutes"));
	app.use("/api/v1/dialogue-progress", require("../routes/dialogueProgressRoutes"));
	app.use("/api/v1/study-activities", require("../routes/studyActivityRoutes"));
	app.use((error, req, res, next) => res.status(error.statusCode || 500).json({ message: error.message, code: error.code }));
	server = await new Promise(resolve => { const listener = app.listen(0, "127.0.0.1", () => resolve(listener)); });
	url = `http://127.0.0.1:${server.address().port}/api/v1`;
}, { timeout: 180000 });
after(async () => {
	if (server) await new Promise(resolve => server.close(resolve));
	await mongoose.disconnect(); await db?.stop();
	if (oldSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = oldSecret;
});
beforeEach(async () => {
	await Promise.all(models.map(model => model.deleteMany({})));
	[user, other] = await User.create([
		{ name: "Learner A", email: "a@example.test", googleId: "isolated-a" },
		{ name: "Learner B", email: "b@example.test", googleId: "isolated-b" },
	]);
	word = await Vocab.create({ user: user.id, english: "apple", vietnamese: "quả táo" });
	token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: "1h" });
});
async function request(path, method = "GET", body, auth = token) {
	const response = await fetch(url + path, { method, headers: { Authorization: `Bearer ${auth}`, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
	return { status: response.status, body: await response.json() };
}
const pathFor = ids => `/dialogue-progress/${ids[0]}/${ids[1]}/tasks/${ids[2]}`;
const dialogue = ["asking-for-directions", "finding-a-cafe", "1"];

test("direct activity claims and visits cannot create counts, qualification or rewards", async () => {
	for (const body of [undefined, { count: 100, hasQualifiedStudy: true, amount: 999999 }]) assert.equal((await request("/study-activities", "POST", body)).status, 405);
	assert.equal((await request("/study-activities")).status, 200);
	assert.equal((await request("/dialogue-progress/asking-for-directions")).status, 200);
	assert.equal(await StudyActivity.countDocuments(), 0); assert.equal(await XPEvent.countDocuments(), 0);
});

test("genuine review commits one activity and SRS update; concurrent/lost-response retry cannot count twice", async () => {
	const input = { mode: "writing", answer: "apple", reviewId: randomUUID() };
	const results = await Promise.all(Array.from({ length: 5 }, () => request(`/vocab/${word.id}/review`, "POST", input)));
	results.forEach(result => assert.equal(result.status, 200, JSON.stringify(result.body)));
	assert.equal(results.reduce((sum, result) => sum + result.body.data.xp.awarded, 0), 5);
	assert.equal((await Vocab.findById(word.id)).reviewCount, 1);
	assert.equal((await StudyActivity.findOne()).count, 1);
	assert.equal(await ReviewEvent.countDocuments(), 1);
	assert.equal((await request(`/vocab/${word.id}/review`, "POST", { ...input, answer: "wrong" })).status, 409);
});

test("review identity is mandatory for HTTP and binds payload, word and authenticated user", async () => {
	assert.equal((await request(`/vocab/${word.id}/review`, "POST", { mode: "writing", answer: "apple" })).status, 400);
	const input = { mode: "flashcard", rating: "again", reviewId: randomUUID() };
	assert.equal((await request(`/vocab/${word.id}/review`, "POST", input)).status, 200);
	assert.equal((await StudyActivity.findOne()).count, 1); assert.equal(await XPEvent.countDocuments(), 0);
	const anotherWord = await Vocab.create({ user: user.id, english: "book", vietnamese: "sách" });
	assert.equal((await request(`/vocab/${anotherWord.id}/review`, "POST", input)).status, 409);
	assert.equal((await request(`/vocab/${word.id}/review`, "POST", input, jwt.sign({ id: other.id }, process.env.JWT_SECRET, { expiresIn: "1h" }))).status, 404);
});

test("practice qualification/count/XP remain distinct; failed review rolls everything back", async t => {
	await reviewVocabulary(user.id, word.id, { mode: "writing", answer: "apple", practice: true, reviewId: randomUUID() });
	assert.equal((await StudyActivity.findOne()).count, 0); assert.equal((await StudyActivity.findOne()).hasQualifiedStudy, true);
	assert.equal((await Vocab.findById(word.id)).reviewCount, 0);
	const stub = t.mock.method(ReviewEvent, "create", () => { throw new Error("receipt write failed"); });
	await assert.rejects(reviewVocabulary(user.id, word.id, { mode: "flashcard", rating: "again", reviewId: randomUUID() }), /receipt write failed/);
	stub.mock.restore();
	assert.equal((await StudyActivity.findOne()).count, 0); assert.equal((await Vocab.findById(word.id)).reviewCount, 0);
});

test("review retry across Vietnam midnight does not create a new day; a new genuine event does", async () => {
	const input = { mode: "writing", answer: "apple", reviewId: randomUUID() };
	await reviewVocabulary(user.id, word.id, input, { now: new Date("2026-10-06T16:59:59Z") });
	await reviewVocabulary(user.id, word.id, input, { now: new Date("2026-10-06T17:00:01Z") });
	assert.equal(await StudyActivity.countDocuments(), 1);
	await reviewVocabulary(user.id, word.id, { ...input, reviewId: randomUUID() }, { now: new Date("2026-10-06T17:00:01Z") });
	assert.deepEqual((await StudyActivity.find().sort("date")).map(day => [day.date, day.count]), [["2026-10-06", 1], ["2026-10-07", 1]]);
	assert.equal((await getStudyStreaks([user.id], new Date("2026-10-06T17:00:01Z"))).get(user.id).streakDays, 2);
});

test("known task ID or correct public answer without an issued attempt cannot claim rewards", async () => {
	for (const body of [{}, { answers: ["find"], amount: 999999 }, { attemptId: "f".repeat(64), answers: ["find"] }]) {
		assert.ok([400, 409].includes((await request(pathFor(dialogue), "PATCH", body)).status));
	}
	assert.equal(await DialogueProgress.countDocuments(), 0); assert.equal(await StudyActivity.countDocuments(), 0); assert.equal(await XPEvent.countDocuments(), 0);
});

test("public task visits/attempt creation have no study effect; minimum time and expiry are server enforced", async () => {
	const result = await request(pathFor(dialogue) + "/attempt", "POST");
	assert.equal(result.status, 200); assert.match(result.body.data.attemptId, /^[a-f0-9]{64}$/);
	assert.equal(await StudyActivity.countDocuments(), 0); assert.equal(await XPEvent.countDocuments(), 0);
	const proof = { attemptId: result.body.data.attemptId, answers: ["find"] };
	const early = await request(pathFor(dialogue), "PATCH", proof);
	assert.equal(early.status, 409); assert.equal(early.body.code, "studyAttemptNotReady");
	await DialogueAttempt.updateOne({ _id: proof.attemptId }, { expiresAt: new Date(Date.now() - 1) });
	assert.equal((await request(pathFor(dialogue), "PATCH", proof)).body.code, "studyAttemptExpired");
});

test("attempts bind user/task; wrong answers cannot consume or qualify", async () => {
	const proof = await completionFor(user.id, dialogue);
	const otherToken = jwt.sign({ id: other.id }, process.env.JWT_SECRET, { expiresIn: "1h" });
	assert.equal((await request(pathFor(dialogue), "PATCH", proof, otherToken)).status, 409);
	assert.equal((await request(pathFor([dialogue[0], dialogue[1], "2"]), "PATCH", proof)).status, 409);
	assert.equal((await request(pathFor(dialogue), "PATCH", { ...proof, answers: ["wrong"] })).status, 400);
	assert.equal((await DialogueAttempt.findById(proof.attemptId)).consumedAt, undefined);
	assert.equal(await StudyActivity.countDocuments(), 0);
	assert.equal((await request(pathFor(dialogue), "PATCH", proof)).body.data.xp.awarded, 10);
});

for (const [label, ids] of [["Dialogue", dialogue], ["Story", ["ten-minutes-a-day", "the-old-book", "1"]]]) test(`${label}: correct completion/retries/replays keep fixed rewards and zero legacy vocabulary count`, async () => {
	const proof = { ...await completionFor(user.id, ids), amount: 9999999, totalXp: 9999999, user: other.id };
	const results = await Promise.all(Array.from({ length: 4 }, () => request(pathFor(ids), "PATCH", proof)));
	results.forEach(result => assert.equal(result.status, 200, JSON.stringify(result.body)));
	assert.equal(results.reduce((sum, result) => sum + result.body.data.xp.awarded, 0), 10);
	assert.equal((await StudyActivity.findOne()).count, 0); assert.equal((await StudyActivity.findOne()).hasQualifiedStudy, true);
	assert.equal((await User.findById(other.id)).totalXp, 0);
	const replay = await request(pathFor(ids), "PATCH", await completionFor(user.id, ids));
	assert.equal(replay.body.data.xp.awarded, 0); assert.equal(await XPEvent.countDocuments(), 1);
});

test("failed reward transaction leaves attempt unconsumed so Retry works", async t => {
	const proof = await completionFor(user.id, dialogue);
	const stub = t.mock.method(User, "findOneAndUpdate", () => { throw new Error("reward failed"); });
	assert.equal((await request(pathFor(dialogue), "PATCH", proof)).status, 500); stub.mock.restore();
	assert.equal((await DialogueAttempt.findById(proof.attemptId)).consumedAt, undefined);
	assert.equal(await DialogueProgress.countDocuments(), 0); assert.equal(await StudyActivity.countDocuments(), 0);
	assert.equal((await request(pathFor(dialogue), "PATCH", proof)).body.data.xp.awarded, 10);
});

test("unknown/inactive tasks cannot even start an attempt", async () => {
	for (const ids of [["coffee-shop", "ordering-coffee", "1"], ["fake", "fake", "1"], [dialogue[0], dialogue[1], "unknown"]]) {
		assert.equal((await request(pathFor(ids) + "/attempt", "POST")).status, 404);
		assert.equal((await request(pathFor(ids), "PATCH", {})).status, 404);
	}
	assert.equal(await DialogueAttempt.countDocuments(), 0);
});

test("all active objective tasks accept the existing client answers; malformed/wrong completions are rejected", () => {
	for (const rule of rules) {
		const good = rule.type === "multipleChoice" ? { optionIndex: rule.answers[0] } : { answers: rule.answers };
		assert.equal(validateCompletion(rule, good), true, JSON.stringify(rule.ids));
		assert.equal(validateCompletion(rule, {}), false);
		assert.equal(validateCompletion(rule, { answers: Array(rule.answers.length).fill("definitely wrong"), optionIndex: -1 }), false);
	}
	assert.equal(validateCompletion({ type: "arrangeWords", answers: ["Hello, world!"] }, { answers: ["hello world"] }), true);
	assert.equal(validateCompletion({ type: "review", answers: [] }, { acknowledged: true }), true);
	assert.equal(validateCompletion({ type: "review", answers: [] }, {}), false);
	assert.equal(minimumAttemptMs({ type: "review" }), 2000);
});

test("fill-blank number, punctuation, apostrophe and hyphen matching remains aligned with the frontend", async () => {
	const { fillBlankAnswersMatch: clientMatch } = await import("../../client/app/_utils/fillBlankAnswer.js");
	const { fillBlankAnswersMatch: serverMatch } = require("../utils/fillBlankAnswer");
	for (const [answer, expected] of [["21", "twenty-one"], ["dont", "don't"], ["well known", "well-known"], ["Hello!", "hello"], ["20", "ten"], ["1,200", "one thousand two hundred"]]) assert.equal(serverMatch(answer, expected), clientMatch(answer, expected));
});

test("attempt receipts have a TTL index, and reopening a live attempt preserves its identity/start", async () => {
	const first = await startDialogueAttempt(user.id, dialogue);
	const second = await startDialogueAttempt(user.id, dialogue);
	assert.equal(first.attemptId, second.attemptId);
	const indexes = await DialogueAttempt.collection.indexes();
	assert.equal(indexes.find(index => index.key.expiresAt)?.expireAfterSeconds, 0);
});
