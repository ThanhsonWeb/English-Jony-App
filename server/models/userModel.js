const mongoose = require("mongoose");
const validator = require("validator");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const userSchema = new mongoose.Schema({
	name: {
		type: String,
		// required: [true, "user must have a name"],
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
		select: false,
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
	role: {
		type: String,
		enum: ["user", "admin"],
		default: "user",
	},
	passwordChangedAt: Date,
	passwordResetToken: String,
	passwordResetExpires: Date,
});
// methods
userSchema.methods.correctPassword = async function (candidatePass, userPass) {
	return await bcrypt.compare(candidatePass, userPass);
};

userSchema.methods.changedPasswordAfter = function (jwtTimeStamp) {
	if (this.passwordChangedAt) {
		// convert to timestamp
		const changedTimeStamp = parseInt(
			this.passwordChangedAt.getTime() / 1000,
			10,
		);
		console.log(jwtTimeStamp);
		return jwtTimeStamp < changedTimeStamp;
	}

	return false;
};

userSchema.methods.createPasswordResetToken = function () {
	const resetToken = crypto.randomBytes(32).toString("hex");
	this.passwordResetToken = crypto
		.createHash("sha256")
		.update(resetToken)
		.digest("hex");
	this.passwordResetExpires = Date.now() + 20 * 60 * 1000;  // 10p
	return resetToken;
};

//  document middleware
userSchema.pre("save", async function () {
	if (!this.isModified("password")) return;
	// Hash passwords with bcryptjs.
	this.password = await bcrypt.hash(this.password, 12);
	// Remove passwordConfirm before saving.
	this.passwordConfirm = undefined;
});

const User = mongoose.model("User", userSchema);

module.exports = User;
