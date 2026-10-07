const { rateLimit, ipKeyGenerator } = require("express-rate-limit");

const learningRateLimitPolicy = Object.freeze({
	windowMs: 10 * 60 * 1000,
	readUser: 3000,
	writeUser: 600,
	readPeer: 60000,
	writePeer: 12000,
});

// Forwarding headers are not a verified client identity in this deployment yet.
// Behind a proxy this is a generous aggregate safety budget, not an end-user IP.
const peerKey = req => req.socket?.remoteAddress
	? ipKeyGenerator(req.socket.remoteAddress) : "unknown-peer";
const userKey = req => String(req.user._id);
const isRead = req => ["GET", "HEAD", "OPTIONS"].includes(req.method);

function createLearningRateLimits(policy = learningRateLimitPolicy) {
	function create(name, keyGenerator) {
		return rateLimit({
			windowMs: policy.windowMs,
			limit: policy[name],
			keyGenerator,
			identifier: `learning-${name}`,
			standardHeaders: "draft-8",
			legacyHeaders: false,
			message: {
				status: "fail",
				code: "learningRateLimited",
				message: "Too many learning requests. Please wait and try again.",
			},
		});
	}
	const readPeer = create("readPeer", peerKey), writePeer = create("writePeer", peerKey);
	const readUser = create("readUser", userKey), writeUser = create("writeUser", userKey);
	return {
		peer: (req, res, next) => (isRead(req) ? readPeer : writePeer)(req, res, next),
		user: (req, res, next) => (isRead(req) ? readUser : writeUser)(req, res, next),
	};
}

// The same instances cover both routers: switching routes/tasks cannot reset a quota.
const learningRateLimits = createLearningRateLimits();
module.exports = { ...learningRateLimits, createLearningRateLimits, learningRateLimitPolicy, peerKey };
