const assert = require("node:assert/strict");
const { test, before, after, beforeEach } = require("node:test");
const express = require("express");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const User = require("../models/userModel");

let db, server, url, owner, other, token;
const previousSecret = process.env.JWT_SECRET;
const secret = "isolated-profile-write-fence-secret";

before(async () => {
	process.env.JWT_SECRET = secret;
	db = await MongoMemoryReplSet.create({ binary: { version: "7.0.14" }, replSet: { count: 1, storageEngine: "wiredTiger" } });
	await mongoose.connect(db.getUri(), { dbName: "profile_write_fence_test", monitorCommands: true });
	await User.init();
	const app = express();
	app.use(express.json());
	app.use("/users", require("../routes/userRoutes"));
	app.use((error, req, res, next) => res.status(error.statusCode || 500).json({ message: error.message }));
	server = await new Promise(resolve => { const listener = app.listen(0, "127.0.0.1", () => resolve(listener)); });
	url = `http://127.0.0.1:${server.address().port}/users`;
}, { timeout: 180000 });

after(async () => {
	if (server) await new Promise(resolve => server.close(resolve));
	await mongoose.disconnect();
	await db?.stop();
	if (previousSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previousSecret;
});

beforeEach(async () => {
	await User.deleteMany({});
	[owner, other] = await User.create([
		{ name: "Owner learner", email: "owner@example.test", googleId: "owner", language: "vi", theme: "system" },
		{ name: "Other learner", email: "other@example.test", googleId: "other", language: "en", theme: "light" },
	]);
	token = jwt.sign({ id: owner.id }, secret, { expiresIn: "1h" });
});

function update(kind) {
	const path = kind === "name" ? "/updateMe" : `/${kind}`;
	const body = kind === "name" ? { name: "Updated learner" }
		: { [kind]: kind === "language" ? "en" : "dark", expectedUserId: owner.id };
	return fetch(url + path, { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

const profile = user => ({ name: user.name, language: user.language, theme: user.theme });
function waitForAccountCommand(isMatch, count = 1) {
	return new Promise(resolve => {
		const client = mongoose.connection.getClient();
		let seen = 0;
		const listener = event => {
			if (event.commandName !== "findAndModify" || event.command.findAndModify !== User.collection.name || !isMatch(event.command.update)) return;
			if (++seen < count) return;
			client.off("commandStarted", listener);
			resolve();
		};
		client.on("commandStarted", listener);
	});
}

function isProfileUpdate(query, kind) {
	const update = query.getUpdate() || {};
	return query.model === User && query.op === "findOneAndUpdate" &&
		(Object.hasOwn(update, kind) || Object.hasOwn(update.$set || {}, kind));
}

for (const kind of ["name", "language", "theme"]) {
	test(`${kind} update commits before a racing account deletion transition`, { timeout: 15000 }, async () => {
		const original = mongoose.Query.prototype.exec;
		let entered, release;
		const enteredWrite = new Promise(resolve => { entered = resolve; });
		const releaseWrite = new Promise(resolve => { release = resolve; });
		mongoose.Query.prototype.exec = async function (...args) {
			if (!isProfileUpdate(this, kind)) return original.apply(this, args);
			assert.ok(this.getOptions().session?.inTransaction());
			const result = await original.apply(this, args);
			entered();
			await releaseWrite;
			return result;
		};
		let deletionFinished = false;
		try {
			const write = update(kind);
			await enteredWrite;
			const commandSent = waitForAccountCommand(value => value?.$set?.lifecycleState === "deleting");
			const deletion = mongoose.connection.transaction(async session => {
				assert.ok(await User.findOneAndUpdate({ _id: owner._id, lifecycleState: "active" },
					{ $set: { lifecycleState: "deleting" } }, { session, returnDocument: "after" }));
			}).then(() => { deletionFinished = true; });
			await commandSent;
			assert.equal(deletionFinished, false);
			release();
			assert.equal((await write).status, 200);
			await deletion;
			const saved = await User.findById(owner.id).select("+lifecycleState");
			assert.equal(saved.lifecycleState, "deleting");
			assert.equal(saved[kind], kind === "name" ? "Updated learner" : kind === "language" ? "en" : "dark");
			assert.deepEqual(profile(await User.findById(other.id)), profile(other));
		} finally {
			release();
			mongoose.Query.prototype.exec = original;
		}
	});
}

test("profile writes racing behind account deletion are rejected without changing either account", { timeout: 15000 }, async () => {
	let entered, release;
	const enteredDeletion = new Promise(resolve => { entered = resolve; });
	const releaseDeletion = new Promise(resolve => { release = resolve; });
	const deletion = mongoose.connection.transaction(async session => {
		assert.ok(await User.findOneAndUpdate({ _id: owner._id, lifecycleState: "active" },
			{ $set: { lifecycleState: "deleting" } }, { session, returnDocument: "after" }));
		entered();
		await releaseDeletion;
	});
	await enteredDeletion;
	const commandsSent = waitForAccountCommand(value => value?.$inc?.accountWriteFence === 1, 3);
	const writes = Promise.all([update("name"), update("language"), update("theme")]);
	try { await commandsSent; } finally { release(); }
	await deletion;
	assert.deepEqual((await writes).map(response => response.status), [401, 401, 401]);
	const saved = await User.findById(owner.id).select("+accountWriteFence");
	assert.deepEqual(profile(saved), profile(owner));
	assert.equal(saved.accountWriteFence, 0);
	assert.deepEqual(profile(await User.findById(other.id)), profile(other));
});

test("profile write failures roll back the update and account fence", async () => {
	for (const kind of ["name", "language", "theme"]) {
		const original = mongoose.Query.prototype.exec;
		mongoose.Query.prototype.exec = async function (...args) {
			if (!isProfileUpdate(this, kind)) return original.apply(this, args);
			assert.ok(this.getOptions().session?.inTransaction());
			await original.apply(this, args);
			throw new Error("simulated failure after profile write");
		};
		try { assert.equal((await update(kind)).status, 500); } finally { mongoose.Query.prototype.exec = original; }
		const saved = await User.findById(owner.id).select("+accountWriteFence");
		assert.deepEqual(profile(saved), profile(owner));
		assert.equal(saved.accountWriteFence, 0);
		assert.deepEqual(profile(await User.findById(other.id)), profile(other));
	}
});

test("legacy active accounts can still update name, language and theme", async () => {
	await User.collection.updateOne({ _id: owner._id }, { $unset: { lifecycleState: "" } });
	for (const kind of ["name", "language", "theme"]) assert.equal((await update(kind)).status, 200);
	const saved = await User.findById(owner.id);
	assert.deepEqual(profile(saved), { name: "Updated learner", language: "en", theme: "dark" });
	assert.equal((await User.collection.findOne({ _id: owner._id })).lifecycleState, undefined);
	assert.deepEqual(profile(await User.findById(other.id)), profile(other));
});
