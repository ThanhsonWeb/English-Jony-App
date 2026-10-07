const mongoose = require("mongoose");

// Store fingerprints, never credentials. Expired JWTs cannot authenticate even
// if MongoDB's asynchronous TTL cleanup has not removed their records yet.
const schema = new mongoose.Schema({
	_id: String,
	expiresAt: { type: Date, required: true },
}, { versionKey: false, autoIndex: true });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
module.exports = mongoose.model("RevokedSession", schema);
