const mongoose = require("mongoose");

const MAX_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

const schema = new mongoose.Schema({
	_id: {
		type: String,
		required: true,
		match: [/^v1:[a-f0-9]{64}$/, "Receipt ID must be a versioned HMAC"],
	},
	completedAt: { type: Date, required: true },
	expiresAt: {
		type: Date,
		required: true,
		validate: {
			validator(expiresAt) {
				const update = typeof this.getUpdate === "function" ? this.getUpdate() : null;
				const completedAt = this.completedAt || update?.$set?.completedAt || update?.completedAt;
				return completedAt instanceof Date && expiresAt instanceof Date &&
					expiresAt.getTime() > completedAt.getTime() &&
					expiresAt.getTime() - completedAt.getTime() <= MAX_RETENTION_MS;
			},
			message: "Receipt expiry must be after completion and within 30 days",
		},
	},
}, { versionKey: false, timestamps: false, autoIndex: true });

schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("AccountDeletionReceipt", schema);
