const { rateLimit, ipKeyGenerator } = require("express-rate-limit");
const crypto = require("node:crypto");
const RecoveryCooldown = require("../models/recoveryCooldownModel");

const recoveryResponse = Object.freeze({
	status: "success",
	message: "If recovery is available for this email, check your inbox for a reset link. Please also check recent emails and spam.",
});
const cooldownMs = 5 * 60 * 1000;

// Do not trust forwarding headers while F17's production topology is unverified.
// Behind Nginx this is an aggregate proxy-peer budget; the account cooldown below
// is shared by all workers/IPs and is the primary email-abuse protection.
const createRecoveryIpLimiter = ({ windowMs = 60 * 60 * 1000, limit = 300 } = {}) => rateLimit({
	windowMs, limit,
	keyGenerator: req => ipKeyGenerator(req.socket.remoteAddress),
	standardHeaders: "draft-8", legacyHeaders: false,
	message: { status: "fail", message: "Too many recovery requests. Please wait and try again." },
});
const recoveryIpLimiter = createRecoveryIpLimiter();

async function claimRecovery(email, now = Date.now()) {
	await RecoveryCooldown.init();
	const id = crypto.createHash("sha256").update(email).digest("hex");
	try {
		await RecoveryCooldown.findOneAndUpdate({ _id: id, expiresAt: { $lte: new Date(now) } }, {
			$set: { expiresAt: new Date(now + cooldownMs) },
		}, { upsert: true });
		return true;
	} catch (error) {
		// An existing, still cooling-down record cannot match and cannot be inserted
		// again. The unique key also serializes simultaneous requests across workers.
		if (error.code === 11000) return false;
		throw error;
	}
}
module.exports = { recoveryResponse, recoveryIpLimiter, createRecoveryIpLimiter, claimRecovery, cooldownMs };
