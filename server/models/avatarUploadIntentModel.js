const mongoose = require("mongoose");

// Retained independently of User so outstanding cleanup survives account removal.
const schema = new mongoose.Schema({
	user: { type: mongoose.Schema.ObjectId, required: true, ref: "User", immutable: true },
	operationId: { type: String, required: true, immutable: true },
	provider: { type: String, enum: ["cloudinary", "local"], required: true, immutable: true },
	contentType: { type: String, enum: ["image/jpeg", "image/png", "image/webp"], required: true, immutable: true },
	storageKey: { type: String, required: true, immutable: true },
	uploadStatus: { type: String, enum: ["reserved", "uploading", "uncertain", "finished"], default: "reserved", required: true },
	uploadResult: { type: String, enum: ["success", "failure", "unknown"], default: null },
	attachmentStatus: { type: String, enum: ["unattached", "attached"], default: "unattached", required: true },
	cleanupStatus: { type: String, enum: ["none", "pending", "claimed", "retry", "complete"], default: "none", required: true },
	cleanupGeneration: { type: Number, default: 0, min: 0, required: true },
	cleanupClaimToken: { type: String, select: false },
	lastCleanupClaimToken: { type: String, select: false },
}, { timestamps: true, autoIndex: true });

schema.index({ user: 1, operationId: 1 }, { unique: true });
schema.index({ storageKey: 1 }, { unique: true });
schema.index({ cleanupStatus: 1, updatedAt: 1 });

module.exports = mongoose.model("AvatarUploadIntent", schema);
