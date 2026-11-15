const mongoose = require("mongoose");

const schema = new mongoose.Schema({
	_id: {
		type: String,
		required: true,
		match: [/^[a-f0-9]{64}$/, "Challenge ID must be a SHA-256 hash"],
	},
	user: { type: mongoose.Schema.Types.ObjectId, required: true, immutable: true, ref: "User" },
	sessionFingerprint: {
		type: String,
		required: true,
		immutable: true,
		match: [/^[a-f0-9]{64}$/, "Session fingerprint must be a SHA-256 hash"],
	},
	expiresAt: { type: Date, required: true },
}, { versionKey: false, timestamps: false });

schema.index({ expiresAt: 1 }, {
	expireAfterSeconds: 0,
	name: "account_deletion_google_reauth_challenge_ttl",
});

module.exports = mongoose.model("AccountDeletionGoogleReauthChallenge", schema);
