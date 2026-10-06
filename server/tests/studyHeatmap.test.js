const assert = require("node:assert/strict");
const { before, after, beforeEach, test } = require("node:test");
const mongoose = require("mongoose");
const express = require("express");
const jwt = require("jsonwebtoken");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const User = require("../models/userModel");
const Vocab = require("../models/vocabModel");
const Topic = require("../models/topicModel");
const StudyActivity = require("../models/studyActivityModel");
const DialogueProgress = require("../models/dialogueProgressModel");
const XPEvent = require("../models/xpEventModel");
const { getStudyStreaks, vietnamDay, markQualifiedStudy } = require("../services/studyStreak");
let db, server, url, token, user, heatmap;
const previousSecret = process.env.JWT_SECRET;
before(async () => {
	process.env.JWT_SECRET = "isolated-heatmap-and-notebook-test";
	db = await MongoMemoryReplSet.create({ binary: { version: "7.0.14" }, replSet: { count: 1, storageEngine: "wiredTiger" } });
	await mongoose.connect(db.getUri(), { dbName: "heatmap_notebook_test" });
	await Promise.all([User, Vocab, Topic, StudyActivity, DialogueProgress, XPEvent].map(model => model.init()));
	heatmap = (await import("../../client/app/_lib/studyHeatmap.mjs")).buildStudyHeatmapDays;
	const app = express();
	app.use(express.json());
	app.use("/api/v1/vocab", require("../routes/vocabRoutes"));
	app.use("/api/v1/topics", require("../routes/topicRoutes"));
	app.use("/api/v1/dialogue-progress", require("../routes/dialogueProgressRoutes"));
	app.use("/api/v1/study-activities", require("../routes/studyActivityRoutes"));
	app.use((error, req, res, next) => res.status(error.statusCode || 500).json({ message: error.message }));
	server = await new Promise(resolve => { const listener = app.listen(0, "127.0.0.1", () => resolve(listener)); });
	url = `http://127.0.0.1:${server.address().port}/api/v1`;
}, { timeout: 180000 });
after(async () => {
	if (server) await new Promise(resolve => server.close(resolve));
	await mongoose.disconnect(); await db?.stop();
	if (previousSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previousSecret;
});
beforeEach(async () => {
	await Promise.all([User, Vocab, Topic, StudyActivity, DialogueProgress, XPEvent].map(model => model.deleteMany({})));
	user = await User.create({ name: "Fresh learner", email: "fresh@example.com", googleId: "fresh-test" });
	token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: "1h" });
});
async function request(path, method = "GET", body) {
	const response = await fetch(url + path, { method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
	assert.ok(response.ok, await response.clone().text());
	return (await response.json()).data;
}
test("fresh account saves a topicless dictionary word to its global notebook without creating a list", async () => {
	assert.equal((await request("/topics")).topics.length, 0);
	const { newVocab } = await request("/vocab", "POST", { english: "apple", vietnamese: "quả táo", pronunciation: "/apple/", example: "An apple." });
	assert.equal(newVocab.topic, undefined);
	assert.equal(newVocab.user, user.id);
	assert.deepEqual((await request("/vocab")).vocabularies.map(word => word._id), [newVocab._id]);
	assert.equal(await Topic.countDocuments(), 0);
});
test("saving with an existing topic preserves assignment and global/topic Wordlist visibility", async () => {
	const topic = await Topic.create({ name: "My words", user: user.id });
	const { newVocab } = await request("/vocab", "POST", { english: "book", vietnamese: "sách", topic: topic.id });
	assert.equal(newVocab.topic, topic.id);
	assert.equal((await request("/vocab")).vocabularies.length, 1);
	assert.equal((await request(`/vocab?topic=${topic.id}`)).vocabularies.length, 1);
	assert.equal(await Topic.countDocuments(), 1);
});
for (const source of ["vocabulary", "dialogue", "story", "mixed", "none"]) test(`${source} activity reaches the heatmap without changing vocabulary counts, streak qualification or XP`, async () => {
	if (["vocabulary", "mixed"].includes(source)) {
		const word = await Vocab.create({ english: "apple", vietnamese: "quả táo", user: user.id });
		await request(`/vocab/${word.id}/review`, "POST", { mode: "flashcard", rating: "easy" });
		// The existing vocabulary client records its legacy activity separately.
		await request("/study-activities", "POST");
	}
	if (["dialogue", "mixed"].includes(source)) await request("/dialogue-progress/asking-for-directions/finding-a-cafe/tasks/1", "PATCH");
	if (["story", "mixed"].includes(source)) await request("/dialogue-progress/ten-minutes-a-day/the-old-book/tasks/1", "PATCH");
	const activities = (await request("/study-activities")).activities;
	const days = heatmap(activities);
	const active = source !== "none";
	assert.equal(days.filter(day => day.level > 0).length, active ? 1 : 0);
	const legacyCount = ["vocabulary", "mixed"].includes(source) ? 1 : 0;
	assert.equal(days.reduce((sum, day) => sum + day.count, 0), legacyCount);
	assert.equal(activities.length, active ? 1 : 0);
	if (active) { assert.equal(activities[0].count, legacyCount); assert.equal(activities[0].hasQualifiedStudy, true); }
	const streak = (await getStudyStreaks([user._id])).get(user.id);
	assert.equal(streak.streakDays, active ? 1 : 0);
	const expectedXp = { vocabulary: 2, dialogue: 10, story: 10, mixed: 22, none: 0 }[source];
	assert.equal((await User.findById(user.id)).totalXp, expectedXp);
});
test("legacy vocabulary counts remain visible without promoting them to qualified streak activity", async () => {
	await request("/study-activities", "POST");
	const activities = (await request("/study-activities")).activities;
	assert.equal(heatmap(activities).at(-1).level, 1);
	assert.equal(activities[0].hasQualifiedStudy, false);
	assert.equal((await getStudyStreaks([user._id])).get(user.id).streakDays, 0);
});
test("stored qualified days and heatmap projection share Vietnam midnight boundaries", async () => {
	await markQualifiedStudy(user._id, { now: new Date("2026-10-06T16:59:59.999Z") });
	await markQualifiedStudy(user._id, { now: new Date("2026-10-06T17:00:00Z") });
	const activities = await StudyActivity.find().sort("date").lean();
	const now = new Date("2026-10-06T17:00:00Z");
	assert.equal(vietnamDay(now), "2026-10-07");
	assert.deepEqual(heatmap(activities, now).slice(-2).map(day => [day.date, day.count, day.level]), [["2026-10-06", 0, 1], ["2026-10-07", 0, 1]]);
	assert.equal((await getStudyStreaks([user._id], now)).get(user.id).streakDays, 2);
});
