const assert = require("node:assert/strict");
const { test, before, after, beforeEach } = require("node:test");
const mongoose = require("mongoose");
const express = require("express");
const jwt = require("jsonwebtoken");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const User = require("../models/userModel");
const Vocab = require("../models/vocabModel");
const Topic = require("../models/topicModel");
let db, server, url, user, otherUser, word, otherWord, topic, otherTopic, token;
const originalSecret = process.env.JWT_SECRET;
before(async () => {
	process.env.JWT_SECRET = "isolated-vocabulary-ownership-test";
	db = await MongoMemoryReplSet.create({ binary: { version: "7.0.14" }, replSet: { count: 1, storageEngine: "wiredTiger" } });
	await mongoose.connect(db.getUri(), { dbName: "vocabulary_ownership_test", monitorCommands: true });
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

const mutation = kind => {
	if (kind === "create") return request("", "POST", { english: "water", vietnamese: "nuoc" });
	if (kind === "edit") return request(`/${word.id}`, "PATCH", { english: "updated" });
	return request(`/${word.id}`, "DELETE");
};

function waitForUserFenceCommand(count) {
	return new Promise(resolve => {
		const client = mongoose.connection.getClient();
		let seen = 0;
		const onCommand = event => {
			if (event.commandName !== "findAndModify" || event.command.findAndModify !== User.collection.name) return;
			if (++seen < count) return;
			client.off("commandStarted", onCommand);
			resolve();
		};
		client.on("commandStarted", onCommand);
	});
}

for (const kind of ["create", "edit", "delete"]) {
	test(`${kind} commits before an account deletion transition that races with its write`, async () => {
		const methodName = kind === "create" ? "create" : kind === "edit" ? "findOneAndUpdate" : "findOneAndDelete";
		const original = Vocab[methodName];
		let entered, release;
		const enteredWrite = new Promise(resolve => { entered = resolve; });
		const releaseWrite = new Promise(resolve => { release = resolve; });
		Vocab[methodName] = async function (...args) {
			const options = args[kind === "create" ? 1 : kind === "edit" ? 2 : 1];
			assert.ok(options?.session?.inTransaction(), "vocabulary write uses the transaction session");
			const result = await original.apply(this, args);
			entered();
			await releaseWrite;
			return result;
		};
		const order = [];
		try {
			const write = mutation(kind).then(response => { order.push(kind); return response; });
			await enteredWrite;
			const deletionCommandSent = waitForUserFenceCommand(1);
			const deletion = mongoose.connection.transaction(async session => {
				const account = await User.findOneAndUpdate(
					{ _id: user._id, lifecycleState: "active" },
					{ $set: { lifecycleState: "deleting" } },
					{ session, returnDocument: "after" },
				);
				assert.ok(account);
			}).then(() => { order.push("deletion"); });
			await deletionCommandSent;
			release();
			const response = await write;
			await deletion;
			assert.equal(response.status, kind === "delete" ? 204 : kind === "create" ? 201 : 200);
			assert.deepEqual(order, [kind, "deletion"]);
			assert.equal((await User.findById(user._id).select("+lifecycleState")).lifecycleState, "deleting");
			if (kind === "create") {
				const created = (await response.json()).data.newVocab;
				assert.ok(await Vocab.findOne({ _id: created._id, user: user._id }));
			} else if (kind === "edit") {
				assert.equal((await Vocab.findById(word._id)).english, "updated");
			} else {
				assert.equal(await Vocab.findById(word._id), null);
			}
			assert.ok(await Vocab.findById(otherWord._id), "another account's word remains untouched");
		} finally {
			release();
			Vocab[methodName] = original;
		}
	});
}

test("create, edit and delete racing behind an account deletion are rejected without changing either account", async () => {
	let entered, release;
	const enteredDeletion = new Promise(resolve => { entered = resolve; });
	const releaseDeletion = new Promise(resolve => { release = resolve; });
	const deletion = mongoose.connection.transaction(async session => {
		const account = await User.findOneAndUpdate(
			{ _id: user._id, lifecycleState: "active" },
			{ $set: { lifecycleState: "deleting" } },
			{ session, returnDocument: "after" },
		);
		assert.ok(account);
		entered();
		await releaseDeletion;
	});
	await enteredDeletion;
	const requestsSent = waitForUserFenceCommand(3);
	const writes = Promise.all([mutation("create"), mutation("edit"), mutation("delete")]);
	try {
		await requestsSent;
	} finally {
		release();
	}
	await deletion;
	const responses = await writes;
	assert.deepEqual(responses.map(response => response.status), [401, 401, 401]);
	assert.equal(await Vocab.countDocuments({ user: user._id }), 1);
	assert.equal((await Vocab.findById(word._id)).english, "hello");
	assert.ok(await Vocab.findById(otherWord._id));
	assert.equal((await User.findById(user._id).select("+accountWriteFence")).accountWriteFence, 0);
});

test("create, edit and delete failures after their write roll back data and the account fence", async t => {
	const operations = [
		{ kind: "create", methodName: "create", optionsIndex: 1, run: () => mutation("create") },
		{ kind: "edit", methodName: "findOneAndUpdate", optionsIndex: 2, run: () => mutation("edit") },
		{ kind: "delete", methodName: "findOneAndDelete", optionsIndex: 1, run: () => mutation("delete") },
	];
	for (const operation of operations) {
		const original = Vocab[operation.methodName];
		const stub = t.mock.method(Vocab, operation.methodName, async function (...args) {
			assert.ok(args[operation.optionsIndex]?.session?.inTransaction());
			await original.apply(this, args);
			throw new Error(`simulated ${operation.kind} failure after write`);
		});
		try {
			assert.equal((await operation.run()).status, 500);
		} finally {
			stub.mock.restore();
		}
		assert.equal((await User.findById(user._id).select("+accountWriteFence")).accountWriteFence, 0);
		assert.equal(await Vocab.countDocuments({ user: user._id }), 1);
		assert.equal((await Vocab.findById(word._id)).english, "hello");
		assert.ok(await Vocab.findById(otherWord._id));
	}
});
