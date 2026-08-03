const User = require("../models/userModel");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const { promisify } = require("util");
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
	if (
		req.headers.authorization &&
		req.headers.authorization.startsWith("Bearer")
	) {
		token = req.headers.authorization.split(" ")[1];
	}

	if (!token) {
		return next(new AppError("please login to access", 401));
	}

	// Verify token
	const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
	console.log(decoded);

	// check if user still exist
	const currentUser = await User.findById(decoded.id);
	if (!currentUser)
		return next(
			new AppError(" User belong to this token is no longer exist ", 401),
		);

	// 4️⃣ Check if password changed after JWT was issued
	if (currentUser.changedPasswordAfter(decoded.iat)) {
		return next(
			new AppError("User recently changed password. Please log in again.", 401),
		);
	}
	// Attach req.user
	req.user = currentUser;
	next();
});

exports.restrictTo = (...roles) => {
	return (req, res, next) => {
		if (!roles.includes(req.user.role)) {
			return next(
				new AppError("You don't have a permission to do this action", 403),
			);
		}
		next();
	};
};

exports.forgotPassword = catchAsync(async (req, res, next) => {
	// Find user By email they provided
	const user = await User.findOne({ email: req.body.email });
	if (!user) return next(new AppError("please provide your email "), 401);

	// resetToken
	const resetToken = user.createPasswordResetToken();
	await user.save({ validateBeforeSave: false });

	createSendToken(user, 200, res);

	next();
});
