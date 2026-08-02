const User = require("../models/userModel");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const jwt = require("jsonwebtoken");

const signToken = (id) => {
	return jwt.sign({ id }, process.env.JWT_SECRET, {
		expiresIn: process.env.JWT_EXPIRES_IN,
	});
};

// request Handlers
exports.signup = catchAsync(async (req, res, next) => {
	const newUser = await User.create(req.body);

	res.status(201).json({
		status: "success",
		data: newUser,
	});
});

exports.login = catchAsync(async (req, res, next) => {
	const { email, password } = req.body;
	if (!email || !password)
		return next(
			new AppError("please provide your email and password to login", 400),
		);

	// 2️⃣ Find user and include password field
	const user = await User.findOne({ email }).select("+password");

	if (!user || !(await user.correctPassword(password, user.password))) {
		return next(new AppError("Incorrect email or password!", 401));
	}

	const token = signToken(user._id);

	res.status(200).json({
		status: "success",
		token,
		data: { user },
	});
});
