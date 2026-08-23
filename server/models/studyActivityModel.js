const mongoose = require("mongoose");

const studyActivitySchema = new mongoose.Schema(
	{
		user: {
			type: mongoose.Schema.ObjectId,
			ref: "User",
			required: true,
		},
		date: {
			type: String, // Example: "2026-08-23"
			required: true,
		},
		count: {
			type: Number,
			default: 1,
		},
	},
	{ timestamps: true },
);

studyActivitySchema.index({ user: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("StudyActivity", studyActivitySchema);
