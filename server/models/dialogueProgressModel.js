const mongoose = require("mongoose");

const dialogueProgressSchema = new mongoose.Schema(
	{
		user: {
			type: mongoose.Schema.ObjectId,
			ref: "User",
			required: true,
		},
		lessonId: {
			type: String,
			required: true,
		},
		dialogueId: {
			type: String,
			required: true,
		},
		completedTaskIds: {
			type: [String],
			default: [],
		},
	},
	{
		timestamps: true,
	},
);

dialogueProgressSchema.index(
	{
		user: 1,
		lessonId: 1,
		dialogueId: 1,
	},
	{
		unique: true,
	},
);

module.exports = mongoose.model(
	"DialogueProgress",
	dialogueProgressSchema,
);