const mongoose = require("mongoose");

const feedbackSchema = new mongoose.Schema({
	type: {
		type: String,
		enum: ["suggestion", "bug", "general"],
		required: true,
	},
	message: {
		type: String,
		required: true,
		trim: true,
		minlength: 10,
		maxlength: 2000,
	},
	createdAt: {
		type: Date,
		default: Date.now,
	},
}, { versionKey: false });

module.exports = mongoose.model("Feedback", feedbackSchema);
