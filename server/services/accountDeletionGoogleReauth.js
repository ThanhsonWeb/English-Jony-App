const crypto = require("node:crypto");
const mongoose = require("mongoose");
const AccountDeletionGoogleReauthChallenge = require("../models/accountDeletionGoogleReauthChallengeModel");

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const SESSION_FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/;
const CHALLENGE_PATTERN = /^[A-Za-z0-9_-]{43}$/;

const challengeIdFor = challenge =>
	crypto.createHash("sha256").update(challenge).digest("hex");

const isValidBinding = (userId, sessionFingerprint) =>
	mongoose.isObjectIdOrHexString(userId) &&
	typeof sessionFingerprint === "string" &&
	SESSION_FINGERPRINT_PATTERN.test(sessionFingerprint);

// Call only after the request has passed authController.protect. The caller
// receives the one-time value; MongoDB stores only its hash and binding.
exports.issueGoogleDeletionReauthChallenge = async (userId, sessionFingerprint) => {
	if (!isValidBinding(userId, sessionFingerprint)) {
		throw new TypeError("A verified account and session binding are required");
	}

	const challenge = crypto.randomBytes(32).toString("base64url");
	const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS);
	await AccountDeletionGoogleReauthChallenge.create({
		_id: challengeIdFor(challenge),
		user: userId,
		sessionFingerprint,
		expiresAt,
	});

	return { challenge, expiresAt };
};

// Atomically consumes only a live challenge for the same account and exact
// authenticated JWT session. Expiry is checked in the query, independent of TTL.
exports.consumeGoogleDeletionReauthChallenge = async (challenge, userId, sessionFingerprint) => {
	if (typeof challenge !== "string" || !CHALLENGE_PATTERN.test(challenge) ||
		!isValidBinding(userId, sessionFingerprint)) return false;

	const consumed = await AccountDeletionGoogleReauthChallenge.findOneAndDelete({
		_id: challengeIdFor(challenge),
		user: userId,
		sessionFingerprint,
		expiresAt: { $gt: new Date() },
	}).lean();

	return Boolean(consumed);
};

exports.GOOGLE_DELETION_REAUTH_CHALLENGE_TTL_MS = CHALLENGE_TTL_MS;
