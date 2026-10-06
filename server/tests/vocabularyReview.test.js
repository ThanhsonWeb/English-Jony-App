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
const { reviewVocabulary, stableWordKey, getReviewOutcome, scheduleVocabularyReview } = require("../services/vocabularyReview");
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

test("all review modes use the same schedule for correct and incorrect outcomes", () => {
	const cases = [
		[{ mode: "flashcard", rating: "again" }, false, 0, 0, "2026-09-19T11:00:00.000Z"],
		[{ mode: "flashcard", rating: "hard" }, true, 1, 3, "2026-09-26T10:00:00.000Z"],
		[{ mode: "flashcard", rating: "medium" }, true, 2, 3, "2026-10-03T10:00:00.000Z"],
		[{ mode: "flashcard", rating: "easy" }, true, 3, 3, "2026-10-19T10:00:00.000Z"],
		[{ mode: "quiz", answer: "xin chao" }, true, 2, 3, "2026-10-03T10:00:00.000Z"],
		[{ mode: "quiz", answer: "wrong" }, false, 0, 0, "2026-09-19T11:00:00.000Z"],
		[{ mode: "writing", answer: "hello" }, true, 2, 3, "2026-10-03T10:00:00.000Z"],
		[{ mode: "writing", answer: "wrong" }, false, 0, 0, "2026-09-19T11:00:00.000Z"],
	];
	for (const [input, correct, level, count, nextReview] of cases) {
		const reviewWord = { english: "hello", vietnamese: "xin chao", reviewCount: 2, status: true };
		const outcome = getReviewOutcome(reviewWord, input);
		scheduleVocabularyReview(reviewWord, outcome.rating, NOW);
		assert.equal(outcome.correct, correct, JSON.stringify(input));
		assert.equal(reviewWord.learningLevel, level, JSON.stringify(input));
		assert.equal(reviewWord.reviewCount, count, JSON.stringify(input));
		assert.deepEqual(reviewWord.lastReviewedAt, NOW, JSON.stringify(input));
		assert.equal(reviewWord.nextReview.toISOString(), nextReview, JSON.stringify(input));
		assert.equal(reviewWord.status, correct, JSON.stringify(input));
	}
});

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

for (const [mode, correct, incorrect] of [
	["flashcard", flashcard, { mode: "flashcard", rating: "again" }],
	["quiz", quiz, { mode: "quiz", answer: "wrong" }],
	["writing", writing, { mode: "writing", answer: "wrong" }],
]) {
	test(`${mode}: new → first review → forgotten → one-hour retry → Due → correct recovery`, async () => {
		const { getWordStatus, isReviewDue, selectReviewWords } = await import("../../client/app/_lib/vocabulary.mjs");
		const createdAt = new Date(NOW.getTime() - 60000);
		await Vocab.updateOne({ _id: word.id }, { createdAt, nextReview: createdAt });
		let saved = await Vocab.findById(word.id).lean();
		assert.equal(getWordStatus(saved, NOW), "new");
		assert.equal(isReviewDue(saved, NOW), false);
		assert.equal(selectReviewWords([saved], { global: true, dueOnly: true, now: NOW }).length, 0);
		assert.equal(selectReviewWords([saved], { global: true, now: NOW }).length, 1);
		await review(correct);
		saved = await Vocab.findById(word.id).lean();
		assert.equal(saved.reviewCount, 1);
		assert.deepEqual(saved.lastReviewedAt, NOW);
		assert.equal(getWordStatus(saved, NOW), "learning");
		const forgottenAt = new Date(NOW.getTime() + 30 * 60000);
		const forgotten = await review(incorrect, word, forgottenAt);
		assert.equal(forgotten.correct, false);
		assert.equal(forgotten.xp.awarded, 0);
		saved = JSON.parse(JSON.stringify(await Vocab.findById(word.id).lean()));
		assert.equal(saved.reviewCount, 0); // Reset the success streak, not the review history.
		assert.equal(saved.learningLevel, 0);
		assert.equal(saved.status, false);
		assert.equal(saved.lastReviewedAt, forgottenAt.toISOString());
		const retryAt = new Date(forgottenAt.getTime() + 60 * 60000);
		assert.equal(saved.nextReview, retryAt.toISOString());
		const justBeforeRetry = new Date(retryAt.getTime() - 1);
		assert.equal(getWordStatus(saved, justBeforeRetry), "learning");
		assert.equal(isReviewDue(saved, justBeforeRetry), false);
		assert.equal(selectReviewWords([saved], { global: true, dueOnly: true, now: justBeforeRetry }).length, 0);
		assert.equal(selectReviewWords([saved], { global: true, now: justBeforeRetry }).length, 1);
		assert.equal(getWordStatus(saved, retryAt), "review");
		assert.equal(isReviewDue(saved, retryAt), true);
		assert.equal(selectReviewWords([saved], { dueOnly: true, now: retryAt }).length, 1);
		assert.equal(selectReviewWords([saved], { global: true, dueOnly: true, now: retryAt }).length, 1);
		const recovered = await review(correct, word, retryAt);
		assert.equal(recovered.correct, true);
		assert.equal(recovered.updatedVocab.reviewCount, 1);
		assert.deepEqual(recovered.updatedVocab.lastReviewedAt, retryAt);
		assert.equal(getWordStatus(recovered.updatedVocab, retryAt), "learning");
		assert.equal(isReviewDue(recovered.updatedVocab, retryAt), false);
		const days = mode === "flashcard" ? 1 : 3;
		assert.equal(recovered.updatedVocab.nextReview.getTime(), retryAt.getTime() + days * 86400000);
	});
}

test("a first-ever incorrect answer records review history and becomes Due after one hour", async () => {
	const { getWordStatus, isReviewDue } = await import("../../client/app/_lib/vocabulary.mjs");
	await review({ mode: "flashcard", rating: "again" });
	const saved = await Vocab.findById(word.id).lean();
	assert.equal(saved.reviewCount, 0);
	assert.deepEqual(saved.lastReviewedAt, NOW);
	assert.equal(getWordStatus(saved, NOW), "learning");
	assert.equal(isReviewDue(saved, new Date(NOW.getTime() + 3600000)), true);
});

test("new words explicitly record no review history, even when their initial schedule is customized", async () => {
	const { getWordStatus, isReviewDue } = await import("../../client/app/_lib/vocabulary.mjs");
	const fresh = await Vocab.create({
		user: user.id, english: "fresh", vietnamese: "moi",
		createdAt: new Date(NOW.getTime() - 86400000), nextReview: NOW,
	});
	const saved = await Vocab.findById(fresh.id).lean();
	assert.equal(saved.lastReviewedAt, null);
	assert.equal(getWordStatus(saved, NOW), "new");
	assert.equal(isReviewDue(saved, NOW), false);
});

test("legacy database records retain retry detection without mistaking untouched words for Due", async () => {
	const { getWordStatus, isReviewDue } = await import("../../client/app/_lib/vocabulary.mjs");
	const createdAt = new Date(NOW.getTime() - 3600000);
	for (const [english, nextReview, expected] of [
		["legacy forgotten", NOW, "review"],
		["legacy untouched", createdAt, "new"],
	]) {
		// Bypass new-document middleware to reproduce records written before this fix.
		const inserted = await Vocab.collection.insertOne({
			user: user._id, english, vietnamese: "tu cu", reviewCount: 0, learningLevel: 0, status: false, createdAt, nextReview,
		});
		const response = await fetch(`${url}/${inserted.insertedId}`, { headers: { Authorization: `Bearer ${token}` } });
		assert.equal(response.status, 200);
		const saved = (await response.json()).data.vocab;
		assert.equal(saved.lastReviewedAt, undefined);
		assert.equal(getWordStatus(saved, NOW), expected);
		assert.equal(isReviewDue(saved, NOW), expected === "review");
	}
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
	assert.equal((await Vocab.findById(word._id)).lastReviewedAt, null);
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
	assert.equal((await Vocab.findById(word.id)).learningLevel, 0);
	assert.equal((await Vocab.findById(word.id)).reviewCount, 0);
	assert.equal(await XPEvent.countDocuments(), 0);
	assert.equal(await StudyActivity.countDocuments(), 0);
	const response = await request(`/${word.id}/review`, "POST", { ...writing, amount: 999, earnedAt: "2020-01-01" });
	assert.equal(response.status, 200);
	assert.equal((await response.json()).data.xp.awarded, 5);
});
