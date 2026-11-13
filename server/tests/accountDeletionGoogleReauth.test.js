const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { after, before, beforeEach, test } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const Challenge = require("../models/accountDeletionGoogleReauthChallengeModel");
const {
	issueGoogleDeletionReauthChallenge,
	consumeGoogleDeletionReauthChallenge,
	GOOGLE_DELETION_REAUTH_CHALLENGE_TTL_MS,
} = require("../services/accountDeletionGoogleReauth");

let mongo;
const accountA = new mongoose.Types.ObjectId();
const accountB = new mongoose.Types.ObjectId();
const sessionA = "a".repeat(64);
const sessionB = "b".repeat(64);

before(async () => {
	mongo = await MongoMemoryReplSet.create({
		binary: { version: "7.0.14" },
		replSet: { count: 1, storageEngine: "wiredTiger" },
	});
	await mongoose.connect(mongo.getUri(), { dbName: "account_deletion_google_reauth" });
	await Challenge.init();
}, { timeout: 180000 });

after(async () => {
	await mongoose.disconnect();
	await mongo?.stop();
});

beforeEach(async () => { await Challenge.deleteMany({}); });

test("issues a short-lived challenge and stores only its hash with account and session binding", async () => {
	const issuedAt = Date.now();
	const { challenge, expiresAt } = await issueGoogleDeletionReauthChallenge(accountA, sessionA);
	assert.match(challenge, /^[A-Za-z0-9_-]{43}$/);
	assert.ok(expiresAt.getTime() > issuedAt);
	assert.ok(expiresAt.getTime() - issuedAt <= GOOGLE_DELETION_REAUTH_CHALLENGE_TTL_MS);

	const stored = await Challenge.findOne({}).lean();
	assert.equal(stored._id, crypto.createHash("sha256").update(challenge).digest("hex"));
	assert.notEqual(stored._id, challenge);
	assert.equal(stored.user.toString(), accountA.toString());
	assert.equal(stored.sessionFingerprint, sessionA);
	assert.deepEqual(Object.keys(stored).sort(), ["_id", "expiresAt", "sessionFingerprint", "user"]);
});

test("challenge can only be consumed by the same account and authenticated session, once", async () => {
	const { challenge } = await issueGoogleDeletionReauthChallenge(accountA, sessionA);

	assert.equal(await consumeGoogleDeletionReauthChallenge(challenge, accountB, sessionA), false);
	assert.equal(await consumeGoogleDeletionReauthChallenge(challenge, accountA, sessionB), false);
	assert.equal(await consumeGoogleDeletionReauthChallenge(challenge, accountA, sessionA), true);
	assert.equal(await consumeGoogleDeletionReauthChallenge(challenge, accountA, sessionA), false);
});

test("expired challenges fail closed even before the TTL monitor removes them", async () => {
	const { challenge } = await issueGoogleDeletionReauthChallenge(accountA, sessionA);
	await Challenge.updateOne(
		{ _id: crypto.createHash("sha256").update(challenge).digest("hex") },
		{ $set: { expiresAt: new Date(Date.now() - 1) } },
	);

	assert.equal(await consumeGoogleDeletionReauthChallenge(challenge, accountA, sessionA), false);
});

test("concurrent consumers can consume a challenge only once", async () => {
	const { challenge } = await issueGoogleDeletionReauthChallenge(accountA, sessionA);
	const results = await Promise.all([
		consumeGoogleDeletionReauthChallenge(challenge, accountA, sessionA),
		consumeGoogleDeletionReauthChallenge(challenge, accountA, sessionA),
	]);

	assert.equal(results.filter(Boolean).length, 1);
});

test("rejects invalid issue bindings and fails closed for malformed consume inputs", async () => {
	await assert.rejects(issueGoogleDeletionReauthChallenge("not-an-account", sessionA), TypeError);
	await assert.rejects(issueGoogleDeletionReauthChallenge(accountA, "raw-session-token"), TypeError);
	assert.equal(await consumeGoogleDeletionReauthChallenge("malformed", accountA, sessionA), false);
	assert.equal(await consumeGoogleDeletionReauthChallenge("A".repeat(43), accountA, "bad"), false);
	assert.equal(await Challenge.countDocuments({}), 0);
});

test("defines an expiry TTL index for abandoned challenges", async () => {
	const indexes = await Challenge.collection.listIndexes().toArray();
	const ttl = indexes.find(index => index.name === "account_deletion_google_reauth_challenge_ttl");
	assert.deepEqual(ttl?.key, { expiresAt: 1 });
	assert.equal(ttl?.expireAfterSeconds, 0);
});
