const mongoose = require("mongoose");

const userModel = new mongoose.Schema({
	name: { type: String, required: [true, "user must have a name"] },
	email: { type: String, required: [true, "user must have an email"] },
	password: { type: String, required: [true, "user must have a password"] },
	passwordConfirm: {
		type: String,
		required: [true, "please confirm your password"],
	},
});

const User = mongoose.model("User", userModel);

module.exports = User;
