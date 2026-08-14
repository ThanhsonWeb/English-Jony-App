const mongoose = require("mongoose");

const vocabSchema = new mongoose.Schema({
	user: {
		type: mongoose.Schema.Types.ObjectId,
		ref: "User",
		required: true,
	},
	topic: {
		type: mongoose.Schema.Types.ObjectId,
		ref: "Topic",
		required: true,
	},

	english: {
		type: String,
		required: true,
		trim: true,
	},
	vietnamese: {
		type: String,
		required: true,
		trim: true,
	},
	pronunciation: {
		type: String,
		default: "",
	},
	example: {
		type: String,
	},
	learningLevel: {
		type: Number,
		default: 0,
	},

	nextReview: {
		type: Date,
		default: Date.now,
	},
	reviewCount: {
		type: Number,
		default: 0,
	},
	status: {
		type: Boolean,
		default: false,
	},
	createdAt: {
		type: Date,
		default: Date.now,
	},
});

const Vocab = mongoose.model("Vocab", vocabSchema);

module.exports = Vocab;
