const User = require("../models/userModel");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");

// request Handlers
exports.signup = catchAsync(async (req, res, next) => {
	const newUser = await User.create(req.body);
	res.status(201).json({
		status: "success",
		data: newUser,
	});
});
