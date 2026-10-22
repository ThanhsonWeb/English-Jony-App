const mongoose = require("mongoose");

// Fixed-window counters are shared across workers. Keys contain only hashes.
// Provision this collection/index before deployment. Runtime needs no DDL rights.
const schema = new mongoose.Schema({
	_id: String,
	attempts: { type: Number, required: true },
	expiresAt: { type: Date, required: true },
}, { versionKey: false, autoCreate: false, autoIndex: false });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("MobileLoginWindow", schema);
