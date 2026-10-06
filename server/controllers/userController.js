const User = require("../models/userModel");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const { isValidAvatar, uploadAvatar } = require("../services/avatarUpload");
const { validateProfileName } = require("../../shared/profileName.cjs");

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

exports.updateTheme = catchAsync(async (req, res, next) => {
	const { theme, expectedUserId } = req.body || {};
	if (typeof theme !== "string" || !User.schema.path("theme").enumValues.includes(theme)) {
		return next(new AppError("Invalid theme preference.", 400));
	}
	if (expectedUserId !== req.user.id) {
		return next(new AppError("Account changed. Please try again.", 409));
	}

	const user = await User.findByIdAndUpdate(
		req.user.id,
		{ theme },
		{ returnDocument: "after", runValidators: true },
	);
	res.status(200).json({ status: "success", data: { theme: user.theme } });
});

exports.updateMe = catchAsync(async (req, res, next) => {
	const code = validateProfileName(req.body?.name);
	if (code) return res.status(400).json({ status: "fail", code, message: "Name must contain 3 to 20 characters." });
	const updatedUser = await User.findByIdAndUpdate(
		req.user.id,
		{
			name: req.body.name.trim(),
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
