const assert = require("node:assert/strict");
const { after, before, beforeEach, test } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const { OAuth2Client } = require("google-auth-library");
const User = require("../models/userModel");
const {
	verifyGoogleDeletionReauthToken,
	GOOGLE_DELETION_REAUTH_MAX_AUTH_TIME_AGE_SECONDS,
} = require("../services/googleDeletionReauthTokenVerifier");

const clientId = "google-deletion-test-client.apps.test";
const storedGoogleId = "stored-google-subject";
const originalClientId = process.env.GOOGLE_CLIENT_ID;
const originalVerifyIdToken = OAuth2Client.prototype.verifyIdToken;
let mongo;
let account;
let claimsByToken;
let invalidSignatureTokens;
let verificationCalls;

function freshClaims(overrides = {}) {
	const now = Math.floor(Date.now() / 1000);
	return {
		iss: "https://accounts.google.com",
		aud: clientId,
		exp: now + 300,
		auth_time: now - 30,
		sub: storedGoogleId,
		...overrides,
	};
}

before(async () => {
	process.env.GOOGLE_CLIENT_ID = clientId;
	OAuth2Client.prototype.verifyIdToken = async function (options) {
		verificationCalls.push(options);
		if (invalidSignatureTokens.has(options.idToken)) throw new Error("invalid signature");
		return { getPayload: () => claimsByToken.get(options.idToken) };
	};
	mongo = await MongoMemoryReplSet.create({
		binary: { version: "7.0.14" },
		replSet: { count: 1, storageEngine: "wiredTiger" },
	});
	await mongoose.connect(mongo.getUri(), { dbName: "google_deletion_reauth_verifier" });
	await User.init();
}, { timeout: 180000 });

after(async () => {
	OAuth2Client.prototype.verifyIdToken = originalVerifyIdToken;
	await mongoose.disconnect();
	await mongo?.stop();
	if (originalClientId === undefined) delete process.env.GOOGLE_CLIENT_ID;
	else process.env.GOOGLE_CLIENT_ID = originalClientId;
});

beforeEach(async () => {
	claimsByToken = new Map();
	invalidSignatureTokens = new Set();
	verificationCalls = [];
	await User.deleteMany({});
	account = await User.create({
		name: "Google test account",
		email: "google-deletion-test@example.test",
		googleId: storedGoogleId,
	});
});

function tokenFor(claims, token = "mocked-google-id-token") {
	claimsByToken.set(token, claims);
	return token;
}

test("verifies through Google's ID-token verifier with the configured audience", async () => {
	const idToken = tokenFor(freshClaims());
	assert.equal(await verifyGoogleDeletionReauthToken(idToken, account.id), true);
	assert.deepEqual(verificationCalls, [{ idToken, audience: clientId }]);
});

test("rejects invalid signatures and fails closed when Google's verifier rejects a token", async () => {
	const idToken = "mocked-invalid-signature";
	invalidSignatureTokens.add(idToken);
	assert.equal(await verifyGoogleDeletionReauthToken(idToken, account.id), false);
	assert.equal(verificationCalls.length, 1);
});

test("rejects invalid issuer, audience, authorized party, subject, and expiration", async () => {
	const now = Math.floor(Date.now() / 1000);
	const invalidClaims = [
		{ iss: "https://attacker.example" },
		{ aud: "another-client.apps.test" },
		{ aud: [clientId, "another-client.apps.test"] },
		{ azp: "another-client.apps.test" },
		{ sub: "" },
		{ exp: now },
	];

	for (const claims of invalidClaims) {
		const idToken = tokenFor(freshClaims(claims), `claim-case-${verificationCalls.length}`);
		assert.equal(await verifyGoogleDeletionReauthToken(idToken, account.id), false);
	}
});

test("rejects missing, malformed, stale, or implausibly future auth_time evidence", async () => {
	const now = Math.floor(Date.now() / 1000);
	const invalidAuthTimes = [
		undefined,
		"not-a-number",
		now - GOOGLE_DELETION_REAUTH_MAX_AUTH_TIME_AGE_SECONDS - 1,
		now + 61,
		(now - 30) + 0.5,
	];

	for (let index = 0; index < invalidAuthTimes.length; index += 1) {
		const idToken = tokenFor(
			freshClaims({ auth_time: invalidAuthTimes[index] }),
			`auth-time-case-${index}`,
		);
		assert.equal(await verifyGoogleDeletionReauthToken(idToken, account.id), false);
	}
});

test("accepts only recent authentication evidence within the configured window", async () => {
	const now = Math.floor(Date.now() / 1000);
	const recentAuthTime = now - GOOGLE_DELETION_REAUTH_MAX_AUTH_TIME_AGE_SECONDS;
	const idToken = tokenFor(freshClaims({ auth_time: recentAuthTime }));
	assert.equal(await verifyGoogleDeletionReauthToken(idToken, account.id), true);
});

test("requires the verified subject to match the account's current stored Google ID", async () => {
	const idToken = tokenFor(freshClaims({ sub: "different-google-subject" }));
	assert.equal(await verifyGoogleDeletionReauthToken(idToken, account.id), false);
	assert.equal(await verifyGoogleDeletionReauthToken(tokenFor(freshClaims()), new mongoose.Types.ObjectId()), false);
});

test("rejects malformed inputs and fails closed when Google client configuration is missing", async () => {
	assert.equal(await verifyGoogleDeletionReauthToken("", account.id), false);
	assert.equal(await verifyGoogleDeletionReauthToken("valid-shaped-token", "not-an-object-id"), false);
	assert.equal(verificationCalls.length, 0);

	delete process.env.GOOGLE_CLIENT_ID;
	await assert.rejects(verifyGoogleDeletionReauthToken("valid-shaped-token", account.id), /not configured/);
});
