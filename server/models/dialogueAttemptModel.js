const mongoose = require("mongoose");

// Short-lived receipts also let lost successful responses be retried safely.
const schema = new mongoose.Schema({
	_id: String,
	user: { type: mongoose.Schema.ObjectId, required: true, ref: "User" },
	taskKey: { type: String, required: true },
	startedAt: { type: Date, required: true },
	expiresAt: { type: Date, required: true },
	consumedAt: Date,
}, { autoIndex: true });
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
schema.index({ user: 1, taskKey: 1, startedAt: -1 });

module.exports = mongoose.model("DialogueAttempt", schema);
