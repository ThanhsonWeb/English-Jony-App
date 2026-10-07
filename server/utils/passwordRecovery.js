const User = require("../models/userModel");
const sendEmail = require("./email");
const mongoose = require("mongoose");

module.exports = async function deliverPasswordRecovery(email, frontendOrigin) {
	const user = await User.findOne({ email });
	if (!user || user.passwordResetExpires?.getTime() > Date.now()) return;
	const resetToken = user.createPasswordResetToken();
	const hash = user.passwordResetToken;
	// Never replace an unexpired link, including one created concurrently.
	user.$where = { $or: [
		{ passwordResetExpires: { $lte: new Date(Date.now()) } },
		{ passwordResetExpires: null },
	] };
	try {
		await user.save({ validateBeforeSave: false });
	} catch (error) {
		if (error instanceof mongoose.Error.DocumentNotFoundError) return;
		throw error;
	}
	const resetURL = `${frontendOrigin}/api/v1/users/resetPassword/${resetToken}`;
	try {
		await sendEmail({
			email: user.email,
			subject: "Your password reset link (valid for 20 minutes)",
			message: `Forgot your password? Submit a PATCH request with your new password to: ${resetURL}\nIf you didn't request this, ignore this email.`,
		});
	} catch {
		// A late mail failure must not erase a different/new reset credential.
		await User.updateOne({ _id: user._id, passwordResetToken: hash }, {
			$unset: { passwordResetToken: 1, passwordResetExpires: 1 },
		});
		console.warn({ event: "password_recovery_delivery_failed" });
	}
};
