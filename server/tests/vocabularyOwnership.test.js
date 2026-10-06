const assert = require("node:assert/strict");
const { test, before, after, beforeEach } = require("node:test");
const mongoose = require("mongoose");
const express = require("express");
const jwt = require("jsonwebtoken");
const { MongoMemoryServer } = require("mongodb-memory-server");
const User = require("../models/userModel");
const Vocab = require("../models/vocabModel");
const Topic = require("../models/topicModel");
let db, server, url, user, otherUser, word, otherWord, topic, otherTopic, token;
const originalSecret = process.env.JWT_SECRET;
before(async () => {
	process.env.JWT_SECRET = "isolated-vocabulary-ownership-test";
	db = await MongoMemoryServer.create({ binary: { version: "7.0.14" } });
	await mongoose.connect(db.getUri(), { dbName: "vocabulary_ownership_test" });
	await Promise.all([User.init(), Vocab.init(), Topic.init()]);
	const app = express();
	app.use(express.json());
	app.use("/api/v1/vocab", require("../routes/vocabRoutes"));
	app.use((error, req, res, next) => res.status(error.statusCode || (error.name === "ValidationError" ? 400 : 500)).json({ message: error.message }));
	server = await new Promise(resolve => { const listener = app.listen(0, "127.0.0.1", () => resolve(listener)); });
	url = `http://127.0.0.1:${server.address().port}/api/v1/vocab`;
}, { timeout: 180000 });
after(async () => {
	if (server) await new Promise(resolve => server.close(resolve));
	await mongoose.disconnect();
	await db?.stop();
	if (originalSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = originalSecret;
});
beforeEach(async () => {
	await Promise.all([User.deleteMany({}), Vocab.deleteMany({}), Topic.deleteMany({})]);
	[user, otherUser] = await User.create([
		{ name: "Learner", email: "owner@example.com", googleId: "owner" },
		{ name: "Other learner", email: "other@example.com", googleId: "other" },
	]);
	[topic, otherTopic] = await Topic.create([
		{ name: "My topic", user: user.id }, { name: "Their topic", user: otherUser.id },
	]);
	[word, otherWord] = await Vocab.create([
		{ user: user.id, topic: topic.id, english: "hello", vietnamese: "xin chao" },
		{ user: otherUser.id, topic: otherTopic.id, english: "book", vietnamese: "sach" },
	]);
	token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: "1h" });
});
const request = (path, method = "GET", body) => fetch(url + path, {
	method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
	...(body ? { body: JSON.stringify(body) } : {}),
});

test("ownership, scheduler fields, source metadata and update operators cannot be changed through PATCH", async () => {
	const original = await Vocab.findById(word.id).lean();
	for (const payload of [
		{ user: otherUser.id, english: "updated", reviewCount: 99, learningLevel: 3, nextReview: "2099-01-01", lastReviewedAt: "2020-01-01", createdAt: "2020-01-01", source: { type: "dialogue", lessonId: "forged" } },
		{ $set: { user: otherUser.id, english: "injected" }, $unset: { user: 1 }, "source.lessonId": "forged" },
		{ user: null },
	]) {
		const response = await request(`/${word.id}`, "PATCH", payload);
		assert.equal(response.status, 200);
		const saved = await Vocab.findById(word.id).lean();
		assert.equal(saved.user.toString(), user.id);
		assert.equal(saved.english, "updated");
		for (const field of ["topic", "reviewCount", "learningLevel", "nextReview", "lastReviewedAt", "createdAt", "source"]) {
			assert.deepEqual(saved[field], original[field], field);
		}
	}
	const ownerWords = (await (await request("")).json()).data.vocabularies;
	assert.deepEqual(ownerWords.map(item => item._id), [word.id]);
	const otherToken = jwt.sign({ id: otherUser.id }, process.env.JWT_SECRET, { expiresIn: "1h" });
	assert.equal((await fetch(`${url}/${word.id}`, { headers: { Authorization: `Bearer ${otherToken}` } })).status, 404);
});

test("PATCH cannot edit another user's word, even when claiming ownership", async () => {
	const before = await Vocab.findById(otherWord.id).lean();
	assert.equal((await request(`/${otherWord.id}`, "PATCH", { user: user.id, english: "stolen", topic: topic.id })).status, 404);
	assert.deepEqual(await Vocab.findById(otherWord.id).lean(), before);
});

test("editable text, learned status, owned topic reassignment and clearing a topic remain supported", async () => {
	const secondTopic = await Topic.create({ name: "Second topic", user: user.id });
	const response = await request(`/${word.id}`, "PATCH", {
		english: " good morning ", vietnamese: " chao buoi sang ", pronunciation: "/morning/", example: "Good morning!", status: true, topic: secondTopic.id,
	});
	assert.equal(response.status, 200);
	const saved = (await response.json()).data.updatedVocab;
	assert.equal(saved.english, "good morning");
	assert.equal(saved.vietnamese, "chao buoi sang");
	assert.equal(saved.pronunciation, "/morning/");
	assert.equal(saved.example, "Good morning!");
	assert.equal(saved.status, true);
	assert.equal(saved.topic, secondTopic.id);
	assert.equal((await request(`/${word.id}`, "PATCH", { topic: null })).status, 200);
	assert.equal((await Vocab.findById(word.id)).topic, null);
});

test("foreign, nonexistent and malformed topics are rejected without changing the word", async () => {
	const before = await Vocab.findById(word.id).lean();
	for (const value of [otherTopic.id, new mongoose.Types.ObjectId().toString(), "not-an-id", "", { $ne: null }]) {
		assert.equal((await request(`/${word.id}`, "PATCH", { topic: value, english: "should not save" })).status, 400);
		assert.deepEqual(await Vocab.findById(word.id).lean(), before);
	}
});

test("ordinary edits keep legacy topic links and still run field validation", async () => {
	const legacyTopic = new mongoose.Types.ObjectId();
	await Vocab.updateOne({ _id: word.id }, { topic: legacyTopic });
	assert.equal((await request(`/${word.id}`, "PATCH", { example: "A new example" })).status, 200);
	assert.equal((await Vocab.findById(word.id)).topic.toString(), legacyTopic.toString());
	assert.equal((await request(`/${word.id}`, "PATCH", { english: "" })).status, 400);
	assert.equal((await Vocab.findById(word.id)).english, "hello");
});

test("create, read, update and delete keep ownership checks and notebook words working", async () => {
	const created = await request("", "POST", { english: "water", vietnamese: "nuoc", user: otherUser.id });
	assert.equal(created.status, 201);
	const saved = (await created.json()).data.newVocab;
	assert.equal(saved.user, user.id);
	assert.equal(saved.topic, undefined);
	assert.equal((await request(`/${saved._id}`)).status, 200);
	assert.equal((await request(`/${saved._id}`, "PATCH", { example: "Drink water" })).status, 200);
	assert.equal((await request(`/${otherWord.id}`, "DELETE")).status, 204);
	assert.ok(await Vocab.findById(otherWord.id));
	assert.equal((await request(`/${saved._id}`, "DELETE")).status, 204);
	assert.equal(await Vocab.findById(saved._id), null);
});
