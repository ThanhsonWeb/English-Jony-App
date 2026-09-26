const User = require("../models/userModel");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const { isValidAvatar, uploadAvatar } = require("../services/avatarUpload");

exports.getAllUsers = catchAsync(async (req, res, next) => {
	const users = await User.find();

	res.status(200).json({
		status: " success",
		data: { users },
	});
});

exports.getMe = catchAsync(async (req, res, next) => {
	//  so req.user is available from protect
	res.status(200).json({
		status: "success",
		data: {
			user: req.user,
		},
	});
});

exports.updateMe = catchAsync(async (req, res, next) => {
	const updatedUser = await User.findByIdAndUpdate(
		req.user.id,
		{
			name: req.body.name,
		},
		{
			new: true,
			runValidators: true,
		},
	);

	res.status(200).json({
		status: "success",
		data: {
			user: updatedUser,
		},
	});
});

exports.updateAvatar = catchAsync(async (req, res, next) => {
	const type = req.headers["content-type"]?.split(";")[0].toLowerCase();
	if (!isValidAvatar(req.body, type)) {
		return next(new AppError("Choose a JPG, PNG, or WebP image under 2 MB.", 400));
	}

	let avatar;
	try {
		avatar = await uploadAvatar(req.body, type, req.user.id);
	} catch (error) {
		console.error("Avatar upload failed:", error.message);
		if (error.message === "Avatar storage is not configured") {
			return next(new AppError("Avatar storage is not configured.", 503));
		}
		return next(new AppError("Could not upload avatar. Please try again.", 502));
	}

	const user = await User.findByIdAndUpdate(req.user.id, { avatar }, {
		returnDocument: "after",
		runValidators: true,
	});
	res.status(200).json({ status: "success", data: { user } });
});
