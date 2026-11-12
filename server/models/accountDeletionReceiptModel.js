const mongoose = require("mongoose");

const schema = new mongoose.Schema({
	_id: { type: String, required: true },
	completedAt: { type: Date, required: true },
	expiresAt: { type: Date, required: true },
}, { versionKey: false, timestamps: false, autoIndex: true });

schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("AccountDeletionReceipt", schema);
