const mongoose = require("mongoose");
const { OAuth2Client } = require("google-auth-library");
const User = require("../models/userModel");

const GOOGLE_ISSUERS = new Set(["https://accounts.google.com", "accounts.google.com"]);
const MAX_AUTH_TIME_AGE_SECONDS = 5 * 60;
const MAX_AUTH_TIME_FUTURE_SKEW_SECONDS = 60;
const MAX_ID_TOKEN_LENGTH = 16 * 1024;

const isRecentAuthentication = (authTime, nowSeconds) =>
	Number.isSafeInteger(authTime) &&
	authTime > 0 &&
	authTime <= nowSeconds + MAX_AUTH_TIME_FUTURE_SKEW_SECONDS &&
	nowSeconds - authTime <= MAX_AUTH_TIME_AGE_SECONDS;

// Verify a Google ID token for an existing account. OAuth2Client verifies the
// Google signature and standard OIDC claims; the explicit checks below keep
// this sensitive use fail-closed and require deletion-grade recent auth proof.
exports.verifyGoogleDeletionReauthToken = async (idToken, userId) => {
	if (typeof idToken !== "string" || idToken.length === 0 || idToken.length > MAX_ID_TOKEN_LENGTH ||
		!mongoose.isObjectIdOrHexString(userId)) return false;

	const clientId = process.env.GOOGLE_CLIENT_ID;
	if (typeof clientId !== "string" || clientId.trim() === "") {
		throw new Error("Google deletion reauthentication is not configured");
	}

	let payload;
	try {
		const ticket = await new OAuth2Client(clientId).verifyIdToken({
			idToken,
			audience: clientId,
		});
		payload = ticket?.getPayload?.();
	} catch {
		// Includes invalid signatures and any token verification failure.
		return false;
	}

	const nowSeconds = Math.floor(Date.now() / 1000);
	if (!payload ||
		!GOOGLE_ISSUERS.has(payload.iss) ||
		payload.aud !== clientId ||
		(payload.azp !== undefined && payload.azp !== clientId) ||
		!Number.isSafeInteger(payload.exp) ||
		payload.exp <= nowSeconds ||
		typeof payload.sub !== "string" ||
		payload.sub.length === 0 ||
		!isRecentAuthentication(payload.auth_time, nowSeconds)) return false;

	// Read the binding from MongoDB at verification time; never trust an ID
	// supplied by the token caller as the account's expected Google identity.
	const account = await User.findOne({
		_id: userId,
		googleId: payload.sub,
		lifecycleState: "active",
	}).select("_id").lean();

	return Boolean(account);
};

exports.GOOGLE_DELETION_REAUTH_MAX_AUTH_TIME_AGE_SECONDS = MAX_AUTH_TIME_AGE_SECONDS;
