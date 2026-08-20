const User = require("../models/userModel");
const catchAsync = require("../utils/catchAsync");

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
