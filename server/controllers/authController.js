const User = require("../models/userModel");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const jwt = require("jsonwebtoken");

const signToken = (id) => {
	return jwt.sign({ id }, process.env.JWT_SECRET, {
		expiresIn: process.env.JWT_EXPIRES_IN,
	});
};

const createSendToken = (user, statusCode, res) => {
	const token = signToken(user._id);
	const cookieOptions = {
		expires: new Date(
			Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000,
		),
		httpOnly: true,
	};
	if (process.env.NODE_ENV === "production") cookieOptions.secure = true;
	res.cookie("jwt", token, cookieOptions);
	res.status(statusCode).json({
		status: "success",
		token,
		data: { user },
	});
};

// request Handlers
exports.signup = catchAsync(async (req, res, next) => {
	const newUser = await User.create(req.body);

	createSendToken(newUser, 201, res);
});

exports.login = catchAsync(async (req, res, next) => {
	const { email, password } = req.body;
	// check email && password
	if (!email || !password)
		return next(
			new AppError("please provide your email and password to login", 400),
		);

	// 2️⃣ Find user and include password field
	const user = await User.findOne({ email }).select("+password");

	if (!user || !(await user.correctPassword(password, user.password))) {
		return next(new AppError("Incorrect email or password!", 401));
	}

	createSendToken(user, 200, res);
});

exports.protect = catchAsync(async (req, res, next) => {
	// Read token
	let token;
	
});
