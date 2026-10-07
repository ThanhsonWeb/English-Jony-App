const mongoose = require("mongoose");

// Durable receipts keep network retries from advancing SRS or activity twice.
const schema = new mongoose.Schema({
	_id: String,
	user: { type: mongoose.Schema.ObjectId, required: true, ref: "User" },
	word: { type: mongoose.Schema.ObjectId, required: true, ref: "Vocab" },
	inputHash: { type: String, required: true },
	correct: { type: Boolean, required: true },
	completedAt: { type: Date, required: true },
});

module.exports = mongoose.model("VocabularyReviewEvent", schema);
