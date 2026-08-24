const User = require("../models/userModel");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const { promisify } = require("util");
const jwt = require("jsonwebtoken");
const sendEmail = require("../utils/email");
const crypto = require("crypto");
const { OAuth2Client } = require("google-auth-library");

const GOOGLE_OAUTH_STATE_COOKIE = "google_oauth_state";
const GOOGLE_OAUTH_LOCALE_COOKIE = "google_oauth_locale";
const GOOGLE_OAUTH_COOKIE_PATH = "/api/v1/auth/google";
const GOOGLE_OAUTH_MAX_AGE = 10 * 60 * 1000;

const getGoogleClient = () =>
	new OAuth2Client(
		process.env.GOOGLE_CLIENT_ID,
		process.env.GOOGLE_CLIENT_SECRET,
		process.env.GOOGLE_REDIRECT_URI,
	);

const signToken = (id) => {
	return jwt.sign({ id }, process.env.JWT_SECRET, {
		expiresIn: process.env.JWT_EXPIRES_IN,
	});
};

const setAuthCookie = (user, res) => {
	const token = signToken(user._id);

	res.cookie("jwt", token, {
		expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
		domain:
			process.env.NODE_ENV === "production" ? ".studyjony.com" : undefined,
	});

	return token;
};

const createSendToken = (user, statusCode, res) => {
	setAuthCookie(user, res);
	// Remove password from output
	user.password = undefined;

	res.status(statusCode).json({
		status: "success",
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
		return next(new AppError("Vui lòng nhập đầy đủ email và mật khẩu!", 400));

	// Find user and include password field
	const user = await User.findOne({ email }).select("+password");

	if (!user || !(await user.correctPassword(password, user.password))) {
		return next(new AppError("Email hoặc mật khẩu không chính xác!", 401));
	}

	createSendToken(user, 200, res);
});
exports.logout = catchAsync((req, res) => {
	res.cookie("jwt", "loggedout", {
		expires: new Date(Date.now() + 10 * 1000),
		httpOnly: true,
	});

	res.status(200).json({ status: "success" });
});

exports.protect = catchAsync(async (req, res, next) => {
	let token;

	// 1. Check for Bearer token (Old way)
	if (
		req.headers.authorization &&
		req.headers.authorization.startsWith("Bearer")
	) {
		token = req.headers.authorization.split(" ")[1];
	}

	// 2. Check for Cookie (New way)
	if (!token && req.cookies && req.cookies.jwt) {
		token = req.cookies.jwt;
	}

	if (!token) {
		return next(new AppError("please login to access", 401));
	}

	// Verify token
	const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

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
				new AppError("Bạn không có quyền thực hiện hành động này!", 403),
			);
		}

		next();
	};
};

exports.forgotPassword = catchAsync(async (req, res, next) => {
	// Find user By email they provided
	const user = await User.findOne({ email: req.body.email });
	if (!user) return next(new AppError("please provide your email ", 401));

	// resetToken
	const resetToken = user.createPasswordResetToken(); // token not hash yet
	await user.save({ validateBeforeSave: false }); // hashed and expiration
	// sendEmail
	const resetURL = `${req.protocol}://${req.get("host")}/api/v1/users/resetPassword/${resetToken}`; // token not hash yet

	try {
		await sendEmail({
			email: user.email,
			subject: "Your reset Password here (valid for 10 mins)",
			message: `Forgot your password? Submit a PATCH request with your new password to: ${resetURL}\nIf you didn't request this, ignore this email.`,
		});
	} catch (error) {
		user.passwordResetToken = undefined;
		user.passwordResetExpires = undefined;
		await user.save({ validateBeforeSave: false });
		return next(
			new AppError(
				"There was an error sending the email. Try again later.",
				500,
			),
		);
	}

	res.status(200).json({
		status: "success",
		message: "Token sent to email!",
	});

	next();
});

exports.resetPassword = catchAsync(async (req, res, next) => {
	const hashedToken = crypto
		.createHash("sha256")
		.update(req.params.token)
		.digest("hex");

	console.log(hashedToken);

	const user = await User.findOne({
		passwordResetToken: hashedToken,
		passwordResetExpires: { $gt: Date.now() },
	});
	if (!user) return next(new AppError("Token is invalid or expired", 400));

	//modify and save new pass to mongo
	user.password = req.body.password;
	user.passwordConfirm = req.body.passwordConfirm;
	user.passwordResetExpires = undefined;
	user.passwordResetToken = undefined;

	await user.save();

	createSendToken(user, 200, res);
});

exports.updatePassword = catchAsync(async (req, res, next) => {
	// 1. Get current user (+password)
	const user = await User.findOne({ email: req.user.email }).select(
		"+password",
	);

	// check passwordCurrent
	const correct = await user.correctPassword(
		req.body.passwordCurrent,
		user.password,
	);

	if (!correct)
		return next(new AppError("Your current password is wrong", 401));

	// modify new pass and save
	user.password = req.body.password;
	user.passwordConfirm = req.body.passwordConfirm;

	await user.save();

	// 5. Send new JWT
	createSendToken(user, 200, res);
});
const filterOjb = (obj, ...allowedFields) => {
	const newObj = {};
	Object.keys(obj).forEach((el) => {
		if (allowedFields.includes(el)) newObj[el] = obj[el];
	});
	return newObj;
};
exports.updateMe = catchAsync(async (req, res, next) => {
	const filteredBody = filterOjb(req.body, "name", "email");

	const updatedUser = await User.findByIdAndUpdate(req.user.id, filteredBody, {
		new: true,
		runValidators: true,
	});
	res.status(200).json({
		status: "success",
		data: {
			user: updatedUser,
		},
	});
});
const googleOAuthCookieOptions = {
	httpOnly: true,
	secure: process.env.NODE_ENV === "production",
	sameSite: "lax",
	path: GOOGLE_OAUTH_COOKIE_PATH,
};

const clearGoogleOAuthCookies = (res) => {
	res.clearCookie(GOOGLE_OAUTH_STATE_COOKIE, googleOAuthCookieOptions);
	res.clearCookie(GOOGLE_OAUTH_LOCALE_COOKIE, googleOAuthCookieOptions);
};

const getGoogleCallbackUrl = (locale, error) => {
	const frontendUrl = process.env.FRONTEND_URL.replace(/\/$/, "");
	const localePrefix = locale === "en" ? "/en" : "";
	const errorQuery = error ? `?error=${encodeURIComponent(error)}` : "";
	return `${frontendUrl}${localePrefix}/oauth/google/callback${errorQuery}`;
};

exports.createGoogleOAuthState = (req, res, next) => {
	if (
		!process.env.GOOGLE_CLIENT_ID ||
		!process.env.GOOGLE_CLIENT_SECRET ||
		!process.env.GOOGLE_REDIRECT_URI ||
		!process.env.FRONTEND_URL
	) {
		return next(new AppError("Google Sign-In is not configured.", 500));
	}

	const state = crypto.randomBytes(32).toString("hex");
	const locale = req.query.locale === "en" ? "en" : "vi";
	const cookieOptions = {
		...googleOAuthCookieOptions,
		maxAge: GOOGLE_OAUTH_MAX_AGE,
	};

	res.cookie(GOOGLE_OAUTH_STATE_COOKIE, state, cookieOptions);
	res.cookie(GOOGLE_OAUTH_LOCALE_COOKIE, locale, cookieOptions);
	res.status(200).json({
		status: "success",
		data: {
			state,
			redirectUri: process.env.GOOGLE_REDIRECT_URI,
		},
	});
};

exports.googleOAuthCallback = async (req, res) => {
	const locale = req.cookies[GOOGLE_OAUTH_LOCALE_COOKIE] === "en" ? "en" : "vi";
	const storedState = req.cookies[GOOGLE_OAUTH_STATE_COOKIE];
	const returnedState =
		typeof req.query.state === "string" ? req.query.state : "";

	try {
		const stateMatches =
			typeof storedState === "string" &&
			storedState.length === returnedState.length &&
			crypto.timingSafeEqual(
				Buffer.from(storedState),
				Buffer.from(returnedState),
			);

		if (!stateMatches) {
			throw new Error("Invalid OAuth state");
		}

		if (req.query.error || typeof req.query.code !== "string") {
			throw new Error("Google authorization was not completed");
		}

		const googleClient = getGoogleClient();
		const { tokens } = await googleClient.getToken({
			code: req.query.code,
			redirect_uri: process.env.GOOGLE_REDIRECT_URI,
		});

		if (!tokens.id_token) {
			throw new Error("Google did not return an ID token");
		}

		const ticket = await googleClient.verifyIdToken({
			idToken: tokens.id_token,
			audience: process.env.GOOGLE_CLIENT_ID,
		});
		const { email, name, sub, picture } = ticket.getPayload();

		let user = await User.findOne({ email });
		if (!user) {
			user = await User.create({
				name,
				email,
				googleId: sub,
				photo: picture,
			});
		}

		clearGoogleOAuthCookies(res);
		setAuthCookie(user, res);
		return res.redirect(303, getGoogleCallbackUrl(locale));
	} catch (error) {
		clearGoogleOAuthCookies(res);
		return res.redirect(
			303,
			getGoogleCallbackUrl(locale, "google_oauth_failed"),
		);
	}
};
