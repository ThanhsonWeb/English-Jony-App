const AppError = require("../utils/appError");

const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);
function parseUrl(value) {
	if (typeof value !== "string" || /[\s,\\]/.test(value) || !/^https?:\/\//.test(value)) return null;
	try {
		const url = new URL(value);
		return url.username || url.password ? null : url;
	} catch { return null; }
}

module.exports = (req, res, next) => {
	if (safeMethods.has(req.method)) return next();

	// Use configured frontend identity, never Host or forwarded request headers.
	const configured = process.env.FRONTEND_URL;
	const frontend = parseUrl(configured);
	if (!frontend || !/^https?:\/\/[^/?#]+\/*$/.test(configured) ||
		(process.env.NODE_ENV === "production" && frontend.protocol !== "https:")) {
		return next(new AppError("Request origin validation is unavailable. Please try again later.", 500));
	}

	const origin = req.get("Origin");
	if (origin !== undefined) {
		const source = parseUrl(origin);
		if (source && origin === source.origin && source.origin === frontend.origin) return next();
		// Explicit null/malformed/untrusted Origin cannot fall back to Referer/Bearer.
		return next(new AppError("Request origin is not allowed.", 403));
	}

	const referer = req.get("Referer");
	if (referer !== undefined) {
		const source = parseUrl(referer);
		if (source && source.origin === frontend.origin) return next();
		return next(new AppError("Request origin is not allowed.", 403));
	}

	// Non-browser API clients can use explicit Bearer auth without ambient cookies.
	// Authentication middleware still verifies the token; this is not auth itself.
	if (!req.get("Cookie") && /^Bearer \S+$/.test(req.get("Authorization") || "") &&
		req.get("Sec-Fetch-Site") === undefined) {
		return next();
	}
	return next(new AppError("Request origin is not allowed.", 403));
};
