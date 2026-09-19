const mongoose = require("mongoose");

const xpEventSchema = new mongoose.Schema(
	{
		user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, immutable: true },
		awardKey: { type: String, required: true, trim: true, maxlength: 300, immutable: true },
		sourceType: { type: String, enum: ["dialogue_task", "vocabulary_review"], required: true, immutable: true },
		sourceId: { type: String, required: true, trim: true, maxlength: 300, immutable: true },
		attemptId: { type: mongoose.Schema.Types.ObjectId, immutable: true },
		amount: {
			type: Number,
			required: true,
			min: 1,
			max: Number.MAX_SAFE_INTEGER,
			validate: { validator: Number.isSafeInteger, message: "XP amount must be a positive safe integer" },
			immutable: true,
		},
		earnedAt: { type: Date, required: true, immutable: true },
		dayKey: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/, immutable: true },
		ruleVersion: { type: Number, required: true, min: 1, validate: Number.isSafeInteger, immutable: true },
	},
	{ versionKey: false },
);

xpEventSchema.index({ user: 1, awardKey: 1 }, { unique: true, name: "xp_award_once" });
xpEventSchema.index({ earnedAt: 1, user: 1 });
xpEventSchema.index({ user: 1, earnedAt: -1 });

module.exports = mongoose.model("XPEvent", xpEventSchema);
