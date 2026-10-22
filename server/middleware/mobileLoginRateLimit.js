const crypto = require("node:crypto");
const { mobileClientIpKey } = require("../utils/trustedProxy");
const validator = require("validator");
const MobileLoginWindow = require("../models/mobileLoginWindowModel");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const { passwordFitsBcrypt } = require("../utils/passwordPolicy");

const mobileLoginPolicy = Object.freeze({ windowMs: 15 * 60 * 1000, peerLimit: 60, accountLimit: 10 });

async function claim(kind, key, limit, windowMs, now) {
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
		throw new AppError("Sign-in is temporarily unavailable. Please try again later.", 503);
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

module.exports = { mobileLoginRateLimit: createMobileLoginRateLimit(), createMobileLoginRateLimit, mobileLoginPolicy };
