const mongoose = require("mongoose");

const schema = new mongoose.Schema({
	_id: String, // SHA-256 of the normalized email; no email or user ID is stored.
	expiresAt: { type: Date, required: true },
}, { versionKey: false, autoIndex: true });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
module.exports = mongoose.model("RecoveryCooldown", schema);
