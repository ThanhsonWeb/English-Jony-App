const AppError = require("./appError");

const selectionCookie = "sj_auth_session";
const intentCookie = "sj_auth_intent";
const cookiePrefix = "sj_auth_";
const validAttemptId = value => typeof value === "string" && /^[a-f0-9]{32}$/.test(value);
const cookieName = attemptId => `${cookiePrefix}${attemptId}`;
const attemptCookies = cookies => Object.keys(cookies || {}).filter(name =>
	name.startsWith(cookiePrefix) && validAttemptId(name.slice(cookiePrefix.length)),
);

const requireCredentialAttempt = (req, res, next) => {
	const id = req.get("X-StudyJony-Auth-Attempt");
	if (!validAttemptId(id)) return next(new AppError("Invalid authentication attempt. Please try again.", 400));
	req.credentialAttempt = id;
	next();
};

module.exports = { selectionCookie, intentCookie, validAttemptId, cookieName, attemptCookies, requireCredentialAttempt };
