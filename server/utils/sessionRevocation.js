const crypto = require("node:crypto");
const RevokedSession = require("../models/revokedSessionModel");

const fingerprint = token => crypto.createHash("sha256").update(token).digest("hex");
exports.isRevoked = async token => {
	await RevokedSession.init();
	return Boolean(await RevokedSession.exists({ _id: fingerprint(token) }));
};
exports.revoke = async (token, decoded) => {
	await RevokedSession.init();
	await RevokedSession.updateOne({ _id: fingerprint(token) }, {
		$setOnInsert: { expiresAt: new Date(decoded.exp * 1000) },
	}, { upsert: true });
};
