const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { after, before, beforeEach, test } = require("node:test");
const mongoose = require("mongoose");
const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/userModel");
const RevokedSession = require("../models/revokedSessionModel");
const authController = require("../controllers/authController");
const sessionRevocation = require("../utils/sessionRevocation");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const Challenge = require("../models/accountDeletionGoogleReauthChallengeModel");
const {
	issueGoogleDeletionReauthChallenge,
	consumeGoogleDeletionReauthChallenge,
	GOOGLE_DELETION_REAUTH_CHALLENGE_TTL_MS,
} = require("../services/accountDeletionGoogleReauth");

let mongo;
const jwtSecret = "test-only-google-deletion-session-secret";
const previousJwtSecret = process.env.JWT_SECRET;
const accountA = new mongoose.Types.ObjectId();
const accountB = new mongoose.Types.ObjectId();
const sessionA = "a".repeat(64);
const sessionB = "b".repeat(64);

before(async () => {
	process.env.JWT_SECRET = jwtSecret;
	mongo = await MongoMemoryReplSet.create({
		binary: { version: "7.0.14" },
		replSet: { count: 1, storageEngine: "wiredTiger" },
	});
	await mongoose.connect(mongo.getUri(), { dbName: "account_deletion_google_reauth" });
	await Promise.all([Challenge.init(), User.init(), RevokedSession.init()]);
}, { timeout: 180000 });

after(async () => {
	await mongoose.disconnect();
	await mongo?.stop();
	if (previousJwtSecret === undefined) delete process.env.JWT_SECRET;
	else process.env.JWT_SECRET = previousJwtSecret;
});

beforeEach(async () => { await Promise.all([Challenge.deleteMany({}), User.deleteMany({}), RevokedSession.deleteMany({})]); });

test("auth middleware exposes only the fingerprint of the exact verified session", async () => {
	const user = await User.create({
		name: "Google learner",
		email: "google-learner@example.test",
		googleId: "test-google-subject",
	});
	const token = jwt.sign({ id: user.id, jti: "test-session-id" }, jwtSecret, { expiresIn: "5m" });
	const app = express();
	app.get("/session", authController.protect, (req, res) => res.json({
		userId: req.user.id,
		sessionFingerprint: req.authSessionFingerprint,
	}));
	const server = await new Promise(resolve => {
		const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
	});

	try {
		const response = await fetch(`http://127.0.0.1:${server.address().port}/session`, {
			headers: { authorization: `Bearer ${token}` },
		});
		const body = await response.json();
		assert.equal(response.status, 200);
		assert.equal(body.userId, user.id);
		assert.equal(body.sessionFingerprint, sessionRevocation.fingerprint(token));
		assert.equal(JSON.stringify(body).includes(token), false);
	} finally {
		await new Promise(resolve => server.close(resolve));
	}
});

test("issues a short-lived challenge and stores only its hash with account and session binding", async () => {
	const issuedAt = Date.now();
	const { challenge, expiresAt } = await issueGoogleDeletionReauthChallenge(accountA, sessionA);
	assert.match(challenge, /^[A-Za-z0-9_-]{43}$/);
	assert.ok(expiresAt.getTime() > issuedAt);
	assert.ok(expiresAt.getTime() - issuedAt <= GOOGLE_DELETION_REAUTH_CHALLENGE_TTL_MS + 1000);

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
