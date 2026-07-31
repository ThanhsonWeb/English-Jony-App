const mongoose = require("mongoose");

const userModel = new mongoose.Schema({
	name: { type: String, require: "user must have a name" },
	email: { type: String, require: "user must have an email" },
	password: { type: String, require: "user must have a password" },
	passwordConfirm: {
		type: String,
		require: "please confirm your password",
	},
});

const User = mongoose.model("User", userModel);

module.exports = User;
