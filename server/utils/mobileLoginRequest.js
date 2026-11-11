const AppError = require("./appError");

// Header absence is a CSRF boundary, not proof of an app's identity.
// Password verification and throttling still apply to every native login.
function isNativeMobileAuthRequest(req, endpoint) {
	return req.method === "POST" && req.originalUrl === `/api/v1/auth/mobile/${endpoint}` &&
		["Cookie", "Origin", "Referer", "Sec-Fetch-Site", "Sec-Fetch-Mode", "Sec-Fetch-Dest", "Sec-Fetch-User"]
			.every(header => req.get(header) === undefined) &&
		req.get("Content-Type")?.split(";")[0].trim().toLowerCase() === "application/json";
}

function isMobileLoginRequest(req) { return isNativeMobileAuthRequest(req, "login"); }
function isMobileSignupRequest(req) { return isNativeMobileAuthRequest(req, "signup"); }

function requireMobileLoginRequest(req, res, next) {
	if (!isMobileLoginRequest(req)) return next(new AppError("Mobile login requires a native JSON request without cookies or browser headers.", 403));
	next();
}

function requireMobileSignupRequest(req, res, next) {
	if (!isMobileSignupRequest(req)) return next(new AppError("Mobile signup requires a native JSON request without cookies or browser headers.", 403));
	next();
}

module.exports = { isMobileLoginRequest, isMobileSignupRequest, requireMobileLoginRequest, requireMobileSignupRequest };
