const AppError = require("./appError");

// Header absence is a CSRF boundary, not proof of an app's identity.
// Password verification and throttling still apply to every native login.
function isMobileLoginRequest(req) {
	return req.method === "POST" && req.originalUrl === "/api/v1/auth/mobile/login" &&
		["Cookie", "Origin", "Referer", "Sec-Fetch-Site", "Sec-Fetch-Mode", "Sec-Fetch-Dest", "Sec-Fetch-User"]
			.every(header => req.get(header) === undefined) &&
		req.get("Content-Type")?.split(";")[0].trim().toLowerCase() === "application/json";
}

function requireMobileLoginRequest(req, res, next) {
	if (!isMobileLoginRequest(req)) return next(new AppError("Mobile login requires a native JSON request without cookies or browser headers.", 403));
	next();
}

module.exports = { isMobileLoginRequest, requireMobileLoginRequest };
