const assert = require("node:assert/strict");
const { test, before, after, beforeEach } = require("node:test");
const mongoose = require("mongoose");
const express = require("express");
const jwt = require("jsonwebtoken");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const User = require("../models/userModel");
const Topic = require("../models/topicModel");
const Vocab = require("../models/vocabModel");
const XPEvent = require("../models/xpEventModel");
const StudyActivity = require("../models/studyActivityModel");
const { reviewVocabulary } = require("../services/vocabularyReview");

let db, server, url, owner, other, topic, foreignTopic, token;
const originalSecret = process.env.JWT_SECRET;
const wordInput = { english: " water ", vietnamese: " nước ", pronunciation: "/water/", example: "Drink water." };
before(async () => {
	process.env.JWT_SECRET = "isolated-topic-vocabulary-security-test";
	db = await MongoMemoryReplSet.create({ binary: { version: "7.0.14" }, replSet: { count: 1 } });
	await mongoose.connect(db.getUri(), { dbName: "topic_vocabulary_security" });
	await Promise.all([User.init(), Topic.init(), Vocab.init(), XPEvent.init(), StudyActivity.init()]);
	const app = express();
	app.use(express.json());
	app.use("/api/v1/topics", require("../routes/topicRoutes"));
	app.use("/api/v1/vocab", require("../routes/vocabRoutes"));
	app.use((error, req, res, next) => res.status(error.statusCode || (error.name === "ValidationError" ? 400 : 500))
		.json({ status: "fail", message: error.message }));
	server = await new Promise(resolve => { const listener = app.listen(0, "127.0.0.1", () => resolve(listener)); });
	url = `http://127.0.0.1:${server.address().port}/api/v1`;
}, { timeout: 180000 });
after(async () => {
	if (server) await new Promise(resolve => server.close(resolve));
	await mongoose.disconnect();
	await db?.stop();
	if (originalSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = originalSecret;
});
beforeEach(async () => {
	await Promise.all([User.deleteMany({}), Topic.deleteMany({}), Vocab.deleteMany({}), XPEvent.deleteMany({}), StudyActivity.deleteMany({})]);
	[owner, other] = await User.create([
		{ name: "Owner", email: "owner@example.test", googleId: "isolated-owner" },
		{ name: "Other", email: "other@example.test", googleId: "isolated-other" },
	]);
	[topic, foreignTopic] = await Topic.create([
		{ name: "Owned topic", description: "Original", user: owner.id },
		{ name: "Foreign topic", user: other.id },
	]);
	token = jwt.sign({ id: owner.id }, process.env.JWT_SECRET, { expiresIn: "1h" });
});
async function request(path, method = "GET", body, auth = token) {
	const response = await fetch(url + path, {
		method, headers: { Authorization: `Bearer ${auth}`, "Content-Type": "application/json" },
		...(body === undefined ? {} : { body: JSON.stringify(body) }),
	});
	return { status: response.status, body: response.status === 204 ? null : await response.json() };
}
const createWord = body => request("/vocab", "POST", { ...wordInput, ...body });
const snapshot = id => Topic.findById(id).lean();

test("Topic allows only name/description and retains normal rename validation", async () => {
	const response = await request(`/topics/${topic.id}`, "PATCH", { name: "Renamed", description: " Updated description " });
	assert.equal(response.status, 200);
	assert.equal(response.body.data.updatedTopic.name, "Renamed");
	assert.equal(response.body.data.updatedTopic.description, "Updated description");
	assert.equal(response.body.data.updatedTopic.user, owner.id);
	assert.equal((await request(`/topics/${topic.id}`, "PATCH", { name: "" })).status, 400);
	assert.equal((await snapshot(topic.id)).name, "Renamed");
});
test("Topic PATCH cannot transfer ownership even alongside a legitimate rename", async () => {
	const response = await request(`/topics/${topic.id}`, "PATCH", { user: other.id, name: "Still mine" });
	assert.equal(response.status, 200);
	assert.equal((await snapshot(topic.id)).user.toString(), owner.id);
	assert.equal((await snapshot(topic.id)).name, "Still mine");
	const otherToken = jwt.sign({ id: other.id }, process.env.JWT_SECRET, { expiresIn: "1h" });
	assert.deepEqual((await request("/topics", "GET", undefined, otherToken)).body.data.topics.map(item => item._id), [foreignTopic.id]);
});
test("Topic rejects foreign-owner and nonexistent updates with the same controlled 404", async () => {
	const original = await snapshot(foreignTopic.id);
	for (const id of [foreignTopic.id, new mongoose.Types.ObjectId().toString()]) {
		const response = await request(`/topics/${id}`, "PATCH", { name: "Stolen", user: owner.id });
		assert.equal(response.status, 404);
		assert.deepEqual(response.body, { status: "fail", message: "Topic not found" });
	}
	assert.deepEqual(await snapshot(foreignTopic.id), original);
});
test("Topic cannot edit IDs, timestamps, version, dotted fields or update operators", async () => {
	const original = await snapshot(topic.id);
	for (const body of [
		{ _id: foreignTopic.id, createdAt: "1990-01-01", updatedAt: "2099-01-01", __v: 99, unexpected: "ignored", user: null },
		{ $set: { user: other.id, name: "Injected" }, $unset: { user: 1 }, "user.id": other.id, "createdAt.year": 1990 },
	]) {
		assert.equal((await request(`/topics/${topic.id}`, "PATCH", body)).status, 200);
		assert.deepEqual(await snapshot(topic.id), original);
	}
});
test("foreign Topic deletion is blocked before vocabulary cleanup, including malformed legacy associations", async () => {
	const words = await Vocab.create([
		{ ...wordInput, user: other.id, topic: foreignTopic.id },
		{ ...wordInput, user: owner.id, topic: foreignTopic.id },
	]);
	for (const id of [foreignTopic.id, new mongoose.Types.ObjectId().toString()]) {
		assert.equal((await request(`/topics/${id}`, "DELETE")).status, 404);
	}
	assert.ok(await snapshot(foreignTopic.id));
	assert.equal(await Vocab.countDocuments({ _id: { $in: words.map(word => word.id) } }), 2);
});
test("own Topic deletion still removes only the owner's attached words", async () => {
	const [ownWord, foreignWord, globalWord] = await Vocab.create([
		{ ...wordInput, user: owner.id, topic: topic.id },
		{ ...wordInput, user: other.id, topic: topic.id },
		{ ...wordInput, user: owner.id },
	]);
	assert.equal((await request(`/topics/${topic.id}`, "DELETE")).status, 204);
	assert.equal(await snapshot(topic.id), null);
	assert.equal(await Vocab.findById(ownWord.id), null);
	assert.ok(await Vocab.findById(foreignWord.id));
	assert.ok(await Vocab.findById(globalWord.id));
});

test("normal vocabulary creation trims required text and preserves pronunciation/example", async () => {
	const before = Date.now(), response = await createWord(), after = Date.now();
	assert.equal(response.status, 201);
	const saved = response.body.data.newVocab;
	assert.equal(saved.english, "water");
	assert.equal(saved.vietnamese, "nước");
	assert.equal(saved.pronunciation, wordInput.pronunciation);
	assert.equal(saved.example, wordInput.example);
	assert.equal(saved.user, owner.id);
	assert.equal(saved.reviewCount, 0);
	assert.equal(saved.learningLevel, 0);
	assert.equal(saved.status, false);
	assert.equal(saved.lastReviewedAt, null);
	for (const field of ["nextReview", "createdAt"]) assert.ok(new Date(saved[field]).getTime() >= before && new Date(saved[field]).getTime() <= after, field);
});
test("global notebook creation supports omitted/null topic and users with no topics", async () => {
	await Topic.deleteMany({ user: owner.id });
	for (const body of [{}, { topic: null }]) {
		const response = await createWord(body);
		assert.equal(response.status, 201);
		assert.equal(response.body.data.newVocab.topic ?? null, null);
	}
	assert.equal((await request("/vocab")).body.data.vocabularies.length, 2);
	assert.equal(await Topic.countDocuments({ user: owner.id }), 0);
});
test("owned-topic creation appears in global and matching topic Wordlist only", async () => {
	const response = await createWord({ topic: topic.id });
	assert.equal(response.status, 201);
	assert.equal(response.body.data.newVocab.topic, topic.id);
	for (const path of ["/vocab", `/vocab?topic=${topic.id}`]) {
		assert.deepEqual((await request(path)).body.data.vocabularies.map(word => word._id), [response.body.data.newVocab._id]);
	}
	const otherToken = jwt.sign({ id: other.id }, process.env.JWT_SECRET, { expiresIn: "1h" });
	assert.equal((await request(`/vocab?topic=${topic.id}`, "GET", undefined, otherToken)).body.data.vocabularies.length, 0);
});
test("foreign, nonexistent, malformed, array and operator topics fail before any word is created", async () => {
	for (const value of [foreignTopic.id, new mongoose.Types.ObjectId().toString(), "not-an-id", "", { $ne: null }, [topic.id]]) {
		const response = await createWord({ topic: value, user: other.id });
		assert.equal(response.status, 400);
		assert.deepEqual(response.body, { status: "fail", message: "Topic must belong to the authenticated user" });
	}
	assert.equal(await Vocab.countDocuments(), 0);
});
test("forged owner, scheduler/history, IDs, timestamps and version are ignored at creation", async () => {
	const forgedId = new mongoose.Types.ObjectId().toString(), before = Date.now();
	const response = await createWord({
		user: other.id, _id: forgedId, __v: 99, createdAt: "1990-01-01", updatedAt: "2099-01-01",
		reviewCount: 999, learningLevel: 99, nextReview: "2099-01-01", lastReviewedAt: "1990-01-01", status: true,
	});
	assert.equal(response.status, 201);
	const saved = await Vocab.findById(response.body.data.newVocab._id).lean();
	assert.notEqual(saved._id.toString(), forgedId);
	assert.equal(await Vocab.findById(forgedId), null);
	assert.equal(saved.user.toString(), owner.id);
	assert.equal(saved.__v, 0);
	assert.equal(saved.updatedAt, undefined);
	assert.equal(saved.reviewCount, 0);
	assert.equal(saved.learningLevel, 0);
	assert.equal(saved.status, false);
	assert.equal(saved.lastReviewedAt, null);
	assert.ok(saved.createdAt.getTime() >= before);
	assert.ok(saved.nextReview.getTime() >= before && saved.nextReview.getTime() <= Date.now());
});
test("browser-supplied dialogue source is ignored, including real and forged IDs; learning text still saves", async () => {
	for (const source of [
		{ type: "dialogue", lessonId: "nonexistent", dialogueId: "forged", dialogueTitle: "Forged title" },
		{ type: "dialogue", lessonId: "asking-for-directions", dialogueId: "finding-a-cafe", dialogueTitle: "Client-supplied title" },
	]) {
		const response = await createWord({ source, "source.lessonId": "dotted", unexpected: "ignored" });
		assert.equal(response.status, 201);
		const saved = await Vocab.findById(response.body.data.newVocab._id).lean();
		assert.equal(saved.source, undefined);
		assert.equal(saved.unexpected, undefined);
		assert.equal(saved.english, "water");
		assert.equal(saved.example, wordInput.example);
	}
});
test("creation does not execute update operators or accept alternate internal/prototype fields", async () => {
	const response = await createWord(JSON.parse('{"$set":{"user":"forged","reviewCount":999},"$unset":{"user":1},"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}},"user.id":"forged"}'));
	assert.equal(response.status, 201);
	const saved = await Vocab.findById(response.body.data.newVocab._id).lean();
	assert.equal(saved.user.toString(), owner.id);
	assert.equal(saved.reviewCount, 0);
	assert.equal({}.polluted, undefined);
});
test("required vocabulary validation still rejects empty/missing text without creating a document", async () => {
	for (const body of [{ english: "" }, { vietnamese: "" }, { english: null }, { vietnamese: null }]) {
		assert.equal((await createWord(body)).status, 400);
	}
	assert.equal((await request("/vocab", "POST", {})).status, 400);
	assert.equal(await Vocab.countDocuments(), 0);
});
test("PATCH ownership and owned-topic validation remain enforced for API-created words", async () => {
	const saved = (await createWord({ topic: topic.id })).body.data.newVocab;
	assert.equal((await request(`/vocab/${saved._id}`, "PATCH", { user: other.id, english: "edited", reviewCount: 9 })).status, 200);
	assert.equal((await Vocab.findById(saved._id)).user.toString(), owner.id);
	assert.equal((await Vocab.findById(saved._id)).reviewCount, 0);
	assert.equal((await request(`/vocab/${saved._id}`, "PATCH", { topic: foreignTopic.id })).status, 400);
	const otherToken = jwt.sign({ id: other.id }, process.env.JWT_SECRET, { expiresIn: "1h" });
	assert.equal((await request(`/vocab/${saved._id}`, "PATCH", { english: "stolen" }, otherToken)).status, 404);
	assert.equal((await Vocab.findById(saved._id)).english, "edited");
	assert.equal((await request(`/vocab/${saved._id}`, "PATCH", { topic: null })).status, 200);
});
for (const mode of ["flashcard", "quiz", "writing"]) test(`${mode}: API-created words retain server scheduling, one-hour retry, Due detection and XP deduplication`, async () => {
	const { getWordStatus, isReviewDue, selectReviewWords } = await import("../../client/app/_lib/vocabulary.mjs");
	let saved = (await createWord({ reviewCount: 99, nextReview: "1990-01-01" })).body.data.newVocab;
	const now = new Date(Date.now() + 1000);
	assert.equal(getWordStatus(saved, now), "new");
	assert.equal(selectReviewWords([saved], { dueOnly: true, now }).length, 0);
	const correct = mode === "flashcard" ? { mode, rating: "hard" } : { mode, answer: mode === "quiz" ? "nước" : "water" };
	const incorrect = mode === "flashcard" ? { mode, rating: "again" } : { mode, answer: "wrong" };
	const first = await reviewVocabulary(owner._id, saved._id, correct, { now });
	assert.equal(first.correct, true);
	assert.equal(first.updatedVocab.reviewCount, 1);
	assert.equal(first.xp.awarded, mode === "flashcard" ? 2 : 5);
	const forgottenAt = new Date(now.getTime() + 60000);
	const forgotten = await reviewVocabulary(owner._id, saved._id, incorrect, { now: forgottenAt });
	saved = forgotten.updatedVocab;
	const retryAt = new Date(forgottenAt.getTime() + 3600000);
	assert.equal(saved.reviewCount, 0);
	assert.equal(saved.lastReviewedAt.getTime(), forgottenAt.getTime());
	assert.equal(saved.nextReview.getTime(), retryAt.getTime());
	assert.equal(isReviewDue(saved, new Date(retryAt.getTime() - 1)), false);
	assert.equal(isReviewDue(saved, retryAt), true);
	const recovered = await reviewVocabulary(owner._id, saved._id, correct, { now: retryAt });
	assert.equal(recovered.updatedVocab.reviewCount, 1);
	assert.equal(recovered.xp.awarded, 0);
	assert.equal(recovered.xp.reason, "already_awarded");
});
