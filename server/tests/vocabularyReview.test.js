const assert = require("node:assert/strict");
const { test, before, after, beforeEach } = require("node:test");
const mongoose = require("mongoose");
const express = require("express");
const jwt = require("jsonwebtoken");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const User = require("../models/userModel");
const Vocab = require("../models/vocabModel");
const XPEvent = require("../models/xpEventModel");
const StudyActivity = require("../models/studyActivityModel");
const { reviewVocabulary, stableWordKey } = require("../services/vocabularyReview");
const awardXp = require("../services/awardXp");
const NOW = new Date("2026-09-19T10:00:00Z");
let db, server, url, user, word, token;
const oldSecret = process.env.JWT_SECRET;
before(async () => {
	process.env.JWT_SECRET = "isolated-vocabulary-review-test";
	db = await MongoMemoryReplSet.create({ binary: { version: "7.0.14" }, replSet: { count: 1 } });
	await mongoose.connect(db.getUri(), { dbName: "vocabulary_review_test" });
	await Promise.all([User.init(), Vocab.init(), XPEvent.init(), StudyActivity.init()]);
	const app = express();
	app.use(express.json());
	app.use("/api/v1/vocab", require("../routes/vocabRoutes"));
	app.use((error, req, res, next) => res.status(error.statusCode || 500).json({ message: error.message }));
	server = await new Promise(resolve => { const listener = app.listen(0, "127.0.0.1", () => resolve(listener)); });
	url = `http://127.0.0.1:${server.address().port}/api/v1/vocab`;
}, { timeout: 180000 });
after(async () => {
	if (server) await new Promise(resolve => server.close(resolve));
	await mongoose.disconnect();
	await db?.stop();
	if (oldSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = oldSecret;
});
async function makeWord(english = "hello") {
	return Vocab.create({ user: user._id, topic: new mongoose.Types.ObjectId(), english, vietnamese: "xin chao" });
}
beforeEach(async () => {
	await Promise.all([User.deleteMany({}), Vocab.deleteMany({}), XPEvent.deleteMany({}), StudyActivity.deleteMany({})]);
	user = await User.create({ name: "Learner", email: "review@example.com", googleId: "review-test" });
	word = await makeWord();
	token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: "1h" });
});
const review = (input, target = word, now = NOW) => reviewVocabulary(user._id, target._id, input, { now });
const writing = { mode: "writing", answer: "hello" };

test("topic-free notebook words support the existing review and XP flow", async () => {
	const response = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ english: "global word", vietnamese: "tu moi" }) });
	assert.equal(response.status, 201);
	const saved = (await response.json()).data.newVocab;
	assert.equal(saved.topic, undefined);
	const result = await review({ mode: "writing", answer: "global word" }, saved);
	assert.equal(result.xp.awarded, 5);
	assert.equal(result.updatedVocab.reviewCount, 1);
	assert.equal((await StudyActivity.findOne()).hasQualifiedStudy, true);
	assert.equal((await Vocab.findById(word._id)).topic.toString(), word.topic.toString());
});
const quiz = { mode: "quiz", answer: "xin chao" };
const flashcard = { mode: "flashcard", rating: "hard" };

test("correct writing/quiz award five, flashcard ratings award two; scheduling stays compatible", async () => {
	const result = await review(writing);
	assert.deepEqual(result.xp, { awarded: 5, total: 5, reason: "awarded" });
	assert.equal(result.updatedVocab.learningLevel, 2);
	assert.equal(result.updatedVocab.reviewCount, 1);
	assert.equal(result.updatedVocab.nextReview.toISOString(), "2026-09-22T10:00:00.000Z");
	assert.equal((await review(quiz, await makeWord("quiz"))).xp.awarded, 5);
	for (const rating of ["hard", "medium", "easy"]) {
		assert.equal((await review({ mode: "flashcard", rating }, await makeWord(rating))).xp.awarded, 2);
	}
});
test("cross-mode and same-day duplicates share the first reward, including duplicate word records", async () => {
	assert.equal((await review(flashcard)).xp.awarded, 2);
	for (const input of [flashcard, quiz, writing]) assert.equal((await review(input)).xp.reason, "already_awarded");
	const copy = await makeWord(" HELLO ");
	assert.equal((await review(writing, copy)).xp.awarded, 0);
	assert.equal(await XPEvent.countDocuments(), 1);
	assert.equal((await User.findById(user._id)).totalXp, 2);
	assert.equal(stableWordKey("  Take   OFF "), stableWordKey("take off"));
});
test("incorrect and Again award zero but qualify for study, without consuming the word reward", async () => {
	for (const input of [{ mode: "quiz", answer: "wrong", correct: true, amount: 999 }, { mode: "writing", answer: "wrong" }, { mode: "flashcard", rating: "again" }]) {
		const result = await review(input);
		assert.equal(result.correct, false);
		assert.equal(result.xp.awarded, 0);
		assert.equal(result.updatedVocab.reviewCount, 0);
		assert.equal(result.updatedVocab.nextReview.toISOString(), "2026-09-19T11:00:00.000Z");
	}
	assert.equal(await XPEvent.countDocuments(), 0);
	assert.equal((await StudyActivity.findOne()).hasQualifiedStudy, true);
	assert.equal((await review(writing)).xp.awarded, 5);
});
test("practice reviews preserve progress and still qualify for study and daily-limited XP", async () => {
	const before = await Vocab.findById(word._id).lean();
	assert.equal((await review({ ...writing, practice: true })).xp.awarded, 5);
	assert.equal((await review({ ...writing, practice: true })).xp.awarded, 0);
	assert.deepEqual(await Vocab.findById(word._id).lean(), before);
	assert.equal((await StudyActivity.findOne()).count, 0);
});
test("daily cap is safe under concurrent distinct-word reviews; dialogue XP is excluded", async () => {
	await awardXp({ userId: user._id, awardKey: "dialogue:test", sourceType: "dialogue_task", sourceId: "test", amount: 100 }, { now: NOW });
	for (let i = 0; i < 19; i++) await review(quiz, await makeWord(`seed-${i}`));
	const words = await Promise.all(Array.from({ length: 8 }, (_, i) => makeWord(`race-${i}`)));
	const results = await Promise.all(words.map(w => review({ ...quiz, practice: true }, w)));
	assert.equal(results.reduce((sum, result) => sum + result.xp.awarded, 0), 5);
	assert.equal(results.filter(result => result.xp.reason === "daily_cap").length, 7);
	assert.equal((await User.findById(user._id)).totalXp, 200);
	assert.equal(await XPEvent.countDocuments({ sourceType: "vocabulary_review" }), 20);
	assert.equal((await review(quiz, words[0], new Date("2026-09-19T17:00:00Z"))).xp.awarded, 5);
});
test("cap skips rewards that cannot fit and still saves progress; smaller rewards may fill remaining XP", async () => {
	for (let i = 0; i < 49; i++) await review(flashcard, await makeWord(`flash-${i}`));
	const blocked = await review(writing);
	assert.equal(blocked.xp.reason, "daily_cap");
	assert.equal(blocked.updatedVocab.reviewCount, 1);
	assert.equal((await review(flashcard)).xp.awarded, 2);
	assert.equal((await User.findById(user._id)).totalXp, 100);
});
test("concurrent cross-mode reviews award only once", async () => {
	const results = await Promise.all([flashcard, quiz, writing, writing].map(input => review(input)));
	assert.equal(results.filter(result => result.xp.awarded > 0).length, 1);
	assert.equal(await XPEvent.countDocuments(), 1);
});
test("Vietnam midnight resets word eligibility and earnedAt/dayKey agree", async () => {
	const before = new Date("2026-09-19T16:59:59.999Z");
	const after = new Date("2026-09-19T17:00:00Z");
	assert.equal((await review(writing, word, before)).xp.awarded, 5);
	assert.equal((await review(quiz, word, before)).xp.awarded, 0);
	assert.equal((await review(writing, word, after)).xp.awarded, 5);
	const events = await XPEvent.find().sort("earnedAt").lean();
	assert.deepEqual(events.map(event => event.dayKey), ["2026-09-19", "2026-09-20"]);
	assert.deepEqual(events.map(event => event.earnedAt), [before, after]);
	assert.equal(await StudyActivity.countDocuments({ hasQualifiedStudy: true }), 2);
});
test("failure rolls back progress, qualification and XP", async t => {
	const stub = t.mock.method(User, "findOneAndUpdate", () => { throw new Error("write failure"); });
	try { await assert.rejects(review(writing), /write failure/); } finally { stub.mock.restore(); }
	assert.equal((await Vocab.findById(word._id)).reviewCount, 0);
	assert.equal(await StudyActivity.countDocuments(), 0);
	assert.equal(await XPEvent.countDocuments(), 0);
});
test("HTTP requires ownership and valid review input; generic GET/PATCH never earn XP", async () => {
	async function request(path, method, body, auth = token) {
		return fetch(url + path, { method, headers: { "Content-Type": "application/json", ...(auth ? { Authorization: `Bearer ${auth}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
	}
	assert.equal((await request(`/${word.id}/review`, "POST", writing, null)).status, 401);
	assert.equal((await request(`/${new mongoose.Types.ObjectId()}/review`, "POST", writing)).status, 404);
	const otherUser = await User.create({ name: "Other", email: "other-review@example.com", googleId: "other-review" });
	const otherWord = await Vocab.create({ user: otherUser._id, topic: word.topic, english: "hello", vietnamese: "xin chao" });
	assert.equal((await request(`/${otherWord.id}/review`, "POST", writing)).status, 404);
	assert.equal((await request(`/${word.id}/review`, "POST", { mode: "quiz", correct: true })).status, 400);
	assert.equal((await request(`/${word.id}/review`, "POST", { mode: "flashcard", rating: "fake" })).status, 400);
	assert.equal((await request(`/${word.id}`, "GET")).status, 200);
	assert.equal((await request(`/${word.id}`, "PATCH", { learningLevel: 3, reviewCount: 10, amount: 999 })).status, 200);
	assert.equal(await XPEvent.countDocuments(), 0);
	assert.equal(await StudyActivity.countDocuments(), 0);
	const response = await request(`/${word.id}/review`, "POST", { ...writing, amount: 999, earnedAt: "2020-01-01" });
	assert.equal(response.status, 200);
	assert.equal((await response.json()).data.xp.awarded, 5);
});
