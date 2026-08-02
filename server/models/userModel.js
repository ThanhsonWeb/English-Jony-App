const mongoose = require("mongoose");
const validator = require("validator");
const bcrypt = require("bcrypt");
const userSchema = new mongoose.Schema({
	name: {
		type: String,
		required: [true, "user must have a name"],
		trim: true,
		minLength: [3, "name must have at least 3 characters"],
		maxLength: [20, " maximum 20 characters"],
	},
	email: {
		type: String,
		required: [true, "user must have an email"],
		unique: true,
		lowercase: true,
		validate: [validator.isEmail, "please provide a valid email"],
	},
	password: {
		type: String,
		required: [true, "user must have a password"],
		minLength: [8, "Password must be at least 8 characters"],
	},
	passwordConfirm: {
		type: String,
		required: [true, "please confirm your password"],
		// This validator only works on save() and create()
		// because "this" refers to current document !
		// so findByIdAndUpdate() ≠ current document -> validator doesn't work .
		validate: {
			validator: function (curValue) {
				return curValue === this.password;
			},
			message: "Passwords are not the same",
		},
	},
});

userSchema.pre("save", async function () {
	if (!this.isModified("password")) return;
	// Hash passwords with bcryptjs.
	this.password = await bcrypt.hash(this.password, 12);
	// Remove passwordConfirm before saving.
	this.passwordConfirm = undefined;
});

const User = mongoose.model("User", userSchema);

module.exports = User;
