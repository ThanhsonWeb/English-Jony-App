const crypto = require("node:crypto");
const { mobileClientIpKey } = require("../utils/trustedProxy");
const validator = require("validator");
const MobileLoginWindow = require("../models/mobileLoginWindowModel");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const { passwordFitsBcrypt } = require("../utils/passwordPolicy");

const mobileLoginPolicy = Object.freeze({ windowMs: 15 * 60 * 1000, peerLimit: 60, accountLimit: 10 });
const mobileSignupPolicy = Object.freeze({ windowMs: 15 * 60 * 1000, peerLimit: 30, accountLimit: 5 });

async function claim(kind, key, limit, windowMs, now, failureMessage = "Sign-in is temporarily unavailable. Please try again later.") {
	const window = Math.floor(now / windowMs);
	const id = crypto.createHash("sha256").update(`${kind}:${window}:${key}`).digest("hex");
	const resetAt = (window + 1) * windowMs;
	try {
		await MobileLoginWindow.init();
		let counter;
		try {
			counter = await MobileLoginWindow.findOneAndUpdate({ _id: id }, {
				$inc: { attempts: 1 }, $setOnInsert: { expiresAt: new Date(resetAt) },
			}, { upsert: true, returnDocument: "after" });
		} catch (error) {
			if (error.code !== 11000) throw error;
			// A concurrent worker may have inserted the same window first.
			counter = await MobileLoginWindow.findOneAndUpdate({ _id: id }, { $inc: { attempts: 1 } }, { returnDocument: "after" });
		}
		if (!counter) throw new Error("Missing login counter");
		return { allowed: counter.attempts <= limit, retryAfter: Math.max(1, Math.ceil((resetAt - now) / 1000)) };
	} catch {
		// A failed limiter must never turn into unlimited password attempts.
		throw new AppError(failureMessage, 503);
	}
}

function createMobileLoginRateLimit({ windowMs, peerLimit, accountLimit, now = Date.now } = mobileLoginPolicy) {
	return catchAsync(async (req, res, next) => {
		const timestamp = now();
		const peer = mobileClientIpKey(req);
		const rejectLimit = result => {
			res.set("Retry-After", String(result.retryAfter));
			return res.status(429).json({ status: "fail", message: "Too many sign-in attempts. Please wait and try again." });
		};
		const peerClaim = await claim("peer", peer, peerLimit, windowMs, timestamp);
		if (!peerClaim.allowed) return rejectLimit(peerClaim);

		const body = req.body;
		if (!body || typeof body !== "object" || Array.isArray(body) ||
			Object.keys(body).some(key => !["email", "password"].includes(key)) ||
			typeof body.email !== "string" || !validator.isEmail(body.email.trim()) ||
			typeof body.password !== "string" || !body.password.length || !passwordFitsBcrypt(body.password)) {
			return next(new AppError("Provide a valid email and password (at most 72 UTF-8 bytes).", 400));
		}
		const email = body.email.trim().toLowerCase();
		// Charge every attempt, including unknown accounts and successful logins.
		// Resetting a counter on success would allow concurrent attempts to erase it.
		const accountClaim = await claim("account", email, accountLimit, windowMs, timestamp);
		if (!accountClaim.allowed) return rejectLimit(accountClaim);
		req.mobileCredentials = { email, password: body.password };
		next();
	});
}

function createMobileSignupRateLimit({ windowMs, peerLimit, accountLimit, now = Date.now } = mobileSignupPolicy) {
	return catchAsync(async (req, res, next) => {
		const timestamp = now();
		const peer = mobileClientIpKey(req);
		const rejectLimit = result => {
			res.set("Retry-After", String(result.retryAfter));
			return res.status(429).json({ status: "fail", message: "Too many registration attempts. Please wait and try again." });
		};
		const storageFailure = "Registration is temporarily unavailable. Please try again later.";
		const peerClaim = await claim("signup-peer", peer, peerLimit, windowMs, timestamp, storageFailure);
		if (!peerClaim.allowed) return rejectLimit(peerClaim);

		const body = req.body;
		if (!body || typeof body !== "object" || Array.isArray(body) ||
			Object.keys(body).some(key => !["name", "email", "password", "passwordConfirm"].includes(key)) ||
			typeof body.name !== "string" || !body.name.trim() ||
			typeof body.email !== "string" || !validator.isEmail(body.email.trim()) ||
			typeof body.password !== "string" || !body.password.length || !passwordFitsBcrypt(body.password) ||
			typeof body.passwordConfirm !== "string" || body.passwordConfirm !== body.password) {
			return next(new AppError("Provide a name, valid email and matching password (8 to 72 UTF-8 bytes).", 400));
		}
		const email = body.email.trim().toLowerCase();
		const accountClaim = await claim("signup-account", email, accountLimit, windowMs, timestamp, storageFailure);
		if (!accountClaim.allowed) return rejectLimit(accountClaim);
		req.mobileSignup = { name: body.name, email, password: body.password, passwordConfirm: body.passwordConfirm };
		next();
	});
}

module.exports = {
	mobileLoginRateLimit: createMobileLoginRateLimit(), createMobileLoginRateLimit, mobileLoginPolicy,
	mobileSignupRateLimit: createMobileSignupRateLimit(), createMobileSignupRateLimit, mobileSignupPolicy,
};
