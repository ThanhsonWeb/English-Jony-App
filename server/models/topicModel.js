const mongoose = require("mongoose");

const topicSchema = new mongoose.Schema({
	name: {
		type: String,
		required: [true, "A topic must have a name"],
	},
	description: {
		type: String,
		trim: true,
	},
	user: {
		//  Creating a foreign key (a link to another document ).
		// This topic belongs to the user with this specific ID.
		type: mongoose.Schema.Types.ObjectId,
		ref: "User",
		required: [true, "A topic must belong to a user"],
	},
	createdAt: {
		type: Date,
		default: Date.now,
	},
});

const Topic = mongoose.model("Topic", topicSchema);

module.exports = Topic;
