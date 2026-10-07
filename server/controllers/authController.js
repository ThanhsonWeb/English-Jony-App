const User = require("../models/userModel");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");
const { promisify } = require("util");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { OAuth2Client } = require("google-auth-library");
const googleDisplayName = require("../utils/googleDisplayName");
const mongoose = require("mongoose");
const { validateProfileName } = require("../utils/profileName");
const validator = require("validator");
const passwordResetOrigin = require("../utils/passwordResetOrigin");
const credentialCookies = require("../utils/credentialCookies");
const sessionRevocation = require("../utils/sessionRevocation");
const { claimRecovery, recoveryResponse } = require("../middleware/recoveryRateLimit");
const deliverPasswordRecovery = require("../utils/passwordRecovery");
const { assertPasswordByteLimit } = require("../utils/passwordPolicy");
const { CLIENT_USER_FIELDS, AUTH_USER_FIELDS, clientUser } = require("../utils/clientUser");
const privateResponse = require("../middleware/privateResponse");

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

const signToken = (user, attemptId) => {
	const payload = { id: user._id, jti: crypto.randomBytes(32).toString("hex") };
	if (attemptId) payload.credentialAttempt = attemptId;
	if (user.passwordChangedAt) {
		payload.passwordChangedAt = user.passwordChangedAt.getTime();
	}
	if (user.passwordSessionVersion) {
		payload.passwordSessionVersion = user.passwordSessionVersion;
	}
	return jwt.sign(payload, process.env.JWT_SECRET, {
		expiresIn: process.env.JWT_EXPIRES_IN,
	});
};

const getAuthCookieOptions = () => ({
	httpOnly: true,
	secure: process.env.NODE_ENV === "production",
	sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
	domain: process.env.NODE_ENV === "production" ? ".studyjony.com" : undefined,
	path: "/",
});

const setAuthCookie = (user, res, attemptId) => {
	// Google/reset/legacy API sessions also need an exact logout identity. Reuse
	// F06's isolated-cookie format; keep jwt for existing cookie/Bearer API clients.
	const sessionId = attemptId || crypto.randomBytes(16).toString("hex");
	const token = signToken(user, sessionId);
	const tokenExpiresAt = new Date(jwt.decode(token).exp * 1000);
	const options = {
		...getAuthCookieOptions(),
		expires: tokenExpiresAt,
	};
	if (!attemptId) res.cookie("jwt", token, options);
	res.cookie(credentialCookies.cookieName(sessionId), token, options);
	// Credential responses never write the shared selection or legacy cookie.
	if (!attemptId) res.cookie(credentialCookies.selectionCookie, sessionId, {
		...getAuthCookieOptions(), httpOnly: false, expires: tokenExpiresAt,
	});
	if (!attemptId) res.cookie(credentialCookies.intentCookie, crypto.randomBytes(16).toString("hex"), {
		...getAuthCookieOptions(), httpOnly: false, expires: tokenExpiresAt,
	});

	return token;
};

const createSendToken = (user, statusCode, res, attemptId) => {
	setAuthCookie(user, res, attemptId);
	res.status(statusCode).json({
		status: "success",
		data: { user: clientUser(user), ...(attemptId ? { credentialAttempt: attemptId } : {}) },
	});
};

const verifySessionForRevocation = async token => {
	if (!process.env.JWT_SECRET) throw new Error("JWT verification is not configured");
	try {
		const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
		return Number.isFinite(decoded.exp) ? decoded : null;
	} catch (error) {
		if (error instanceof jwt.JsonWebTokenError) return null;
		throw error;
	}
};

const revokeCookieSession = async token => {
	if (!token) return;
	const decoded = await verifySessionForRevocation(token);
	if (decoded) await sessionRevocation.revoke(token, decoded);
};

// request Handlers
exports.signup = catchAsync(async (req, res, next) => {
	const { name, email, password, passwordConfirm } = req.body;
	assertPasswordByteLimit(password);
	let newUser;
	try {
		newUser = await User.create({ name, email, password, passwordConfirm });
	} catch (error) {
		if (error.code === 11000 && (error.keyPattern?.email || error.keyValue?.email)) {
			return res.status(400).json({ status: "fail", code: "signupUnavailable",
				message: "Unable to create an account with these details. Try signing in or use account recovery." });
		}
		throw error;
	}

	createSendToken(newUser, 201, res, req.credentialAttempt);
});

exports.login = catchAsync(async (req, res, next) => {
	const { email, password } = req.body;

	// check email && password
	if (!email || !password)
		return next(new AppError("Vui lòng nhập đầy đủ email và mật khẩu!", 400));

	// Find user and include password field
	const user = await User.findOne({ email }).select(`${AUTH_USER_FIELDS} +password`);

	if (!user || !(await user.correctPassword(password, user.password))) {
		return next(new AppError("Email hoặc mật khẩu không chính xác!", 401));
	}

	createSendToken(user, 200, res, req.credentialAttempt);
});
exports.logout = catchAsync(async (req, res, next) => {
	// The client captures this selector before invalidating local auth state.
	// It is not a credential: only a verified JWT can be revoked.
	const hint = req.get("X-StudyJony-Logout-Session");
	if (hint !== undefined && hint !== "none" && hint !== "legacy" && !credentialCookies.validAttemptId(hint)) {
		return next(new AppError("Invalid logout request.", 400));
	}
	const selected = hint ?? req.cookies?.[credentialCookies.selectionCookie];
	const candidates = [];
	if (req.headers.authorization?.startsWith("Bearer ")) candidates.push({ token: req.headers.authorization.slice(7) });
	else if (credentialCookies.validAttemptId(selected)) candidates.push({
		name: credentialCookies.cookieName(selected), token: req.cookies?.[credentialCookies.cookieName(selected)],
	});
	else if (selected === "legacy" || selected === undefined) candidates.push({ token: req.cookies?.jwt });
	else if (hint === undefined && selected === "none") {
		// Compatibility with the previous frontend, which cleared its selector first.
		candidates.push({ token: req.cookies?.jwt });
		for (const name of credentialCookies.attemptCookies(req.cookies)) candidates.push({ name, token: req.cookies[name] });
	}
	for (const { token, name } of candidates) {
		if (!token) {
			if (hint && hint !== "none") return next(new AppError("Session changed before logout. Please try again.", 409));
			continue;
		}
		const decoded = await verifySessionForRevocation(token);
		if (!decoded) { if (name) res.clearCookie(name, getAuthCookieOptions()); continue; }
		if (hint === "legacy" && credentialCookies.validAttemptId(req.cookies?.[credentialCookies.selectionCookie]) &&
			decoded.credentialAttempt === req.cookies[credentialCookies.selectionCookie]) {
			// A pre-upgrade legacy logout must not revoke a newer isolated session
			// whose compatibility jwt cookie was installed before request dispatch.
			return next(new AppError("Session changed before logout. Please try again.", 409));
		}
		if (Number.isFinite(decoded.exp)) await sessionRevocation.revoke(token, decoded);
		if (name) res.clearCookie(name, getAuthCookieOptions());
	}
	// Do not clear the shared legacy cookie here: a delayed logout response could
	// otherwise erase a newer Google session. Its old JWT is now server-revoked.
	res.status(200).json({ status: "success" });
});

exports.discardCredentialAttempt = catchAsync(async (req, res) => {
	if (req.cookies?.[credentialCookies.selectionCookie] !== req.credentialAttempt) {
		// Older clients discard their selected cookie immediately before logout.
		// Revoke before clearing so their copied JWT cannot survive that sequence.
		await revokeCookieSession(req.cookies?.[credentialCookies.cookieName(req.credentialAttempt)]);
		res.clearCookie(credentialCookies.cookieName(req.credentialAttempt), getAuthCookieOptions());
	}
	res.status(204).end();
});

const cleanupCredentialCookies = async (req, res) => {
	const selected = req.cookies?.[credentialCookies.selectionCookie];
	const pending = req.cookies?.[credentialCookies.intentCookie];
	for (const name of credentialCookies.attemptCookies(req.cookies)) {
		if (name !== credentialCookies.cookieName(selected) && name !== credentialCookies.cookieName(pending)) {
			await revokeCookieSession(req.cookies[name]);
			res.clearCookie(name, getAuthCookieOptions());
		}
	}
};

exports.protect = catchAsync(async (req, res, next) => {
	privateResponse(req, res, () => {});
	let token;

	// 1. Check for Bearer token (Old way)
	if (
		req.headers.authorization &&
		req.headers.authorization.startsWith("Bearer")
	) {
		token = req.headers.authorization.split(" ")[1];
	}

	// 2. Check for Cookie (New way)
	let selectedAttempt;
	if (req.get("X-StudyJony-Credential-Cleanup") === "1") await cleanupCredentialCookies(req, res);
	if (!token && req.cookies) {
		const selected = req.cookies[credentialCookies.selectionCookie];
		if (credentialCookies.validAttemptId(selected)) {
			selectedAttempt = selected;
			token = req.cookies[credentialCookies.cookieName(selected)];
		} else if (selected === undefined || selected === "legacy") {
			token = req.cookies.jwt;
		}
	}

	if (!token) {
		return next(new AppError("please login to access", 401));
	}

	// Verify token
	// Configuration/database errors stay internal errors; only token failures are 401.
	if (!process.env.JWT_SECRET) throw new Error("JWT verification is not configured");
	let decoded;
	try {
		decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
	} catch (error) {
		if (error instanceof jwt.JsonWebTokenError) {
			return next(new AppError("Invalid or expired session. Please log in again.", 401));
		}
		throw error;
	}
	if (!decoded || !Number.isFinite(decoded.exp) || typeof decoded.id !== "string" || !mongoose.isObjectIdOrHexString(decoded.id)) {
		return next(new AppError("Invalid or expired session. Please log in again.", 401));
	}
	if (selectedAttempt && decoded.credentialAttempt !== selectedAttempt) {
		return next(new AppError("Invalid or expired session. Please log in again.", 401));
	}
	if (await sessionRevocation.isRevoked(token)) {
		return next(new AppError("Invalid or expired session. Please log in again.", 401));
	}

	// check if user still exist
	const currentUser = await User.findById(decoded.id, AUTH_USER_FIELDS);
	if (!currentUser)
		return next(
			new AppError(" User belong to this token is no longer exist ", 401),
		);

	// 4️⃣ Check if password changed after JWT was issued
	if (currentUser.changedPasswordAfter(
		decoded.iat,
		decoded.passwordChangedAt,
		decoded.passwordSessionVersion,
	)) {
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
	// Configuration failures are independent of account existence and fail closed.
	const frontendOrigin = passwordResetOrigin();
	const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
	const eligible = validator.isEmail(email) && await claimRecovery(email);
	// Account lookup and SMTP are outside the public response path, so neither
	// their results nor their latency can disclose whether an account exists.
	if (eligible) void deliverPasswordRecovery(email, frontendOrigin).catch(() => {
		console.warn({ event: "password_recovery_processing_failed" });
	});
	return res.status(200).json(recoveryResponse);
});

exports.resetPassword = catchAsync(async (req, res, next) => {
	assertPasswordByteLimit(req.body.password);
	const hashedToken = crypto
		.createHash("sha256")
		.update(req.params.token)
		.digest("hex");

	const user = await User.findOne({
		passwordResetToken: hashedToken,
		passwordResetExpires: { $gt: Date.now() },
	}).select(`${AUTH_USER_FIELDS} passwordResetToken passwordResetExpires`);
	if (!user) return next(new AppError("Token is invalid or expired", 400));

	//modify and save new pass to mongo
	// Mongoose merges $where into the save filter. Validation/bcrypt hooks run
	// normally; token consumption and the password/version write are atomic.
	user.$where = { passwordResetToken: hashedToken,
		$expr: { $gt: ["$passwordResetExpires", "$$NOW"] } };
	user.password = req.body.password;
	user.passwordConfirm = req.body.passwordConfirm;
	user.passwordResetExpires = undefined;
	user.passwordResetToken = undefined;

	try { await user.save(); }
	catch (error) {
		if (error instanceof mongoose.Error.DocumentNotFoundError) {
			return next(new AppError("Token is invalid or expired", 400));
		}
		throw error;
	}

	createSendToken(user, 200, res);
});

exports.updatePassword = catchAsync(async (req, res, next) => {
	// 1. Get current user (+password)
	const user = await User.findOne({ email: req.user.email }).select(
		`${AUTH_USER_FIELDS} +password`,
	);

	// check passwordCurrent
	const correct = await user.correctPassword(
		req.body.passwordCurrent,
		user.password,
	);

	if (!correct)
		return next(new AppError("Your current password is wrong", 401));

	// modify new pass and save
	assertPasswordByteLimit(req.body.password);
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
	// Email is an authentication identifier. Profile edits cannot verify a new owner.
	if (Object.hasOwn(filteredBody, "email")) {
		if (typeof filteredBody.email !== "string" ||
			filteredBody.email.trim().toLowerCase() !== req.user.email) {
			return res.status(400).json({
				status: "fail",
				code: "emailChangeRequiresVerification",
				message: "Email changes require a verified account recovery process.",
			});
		}
		delete filteredBody.email;
	}
	if (Object.hasOwn(filteredBody, "name")) {
		const code = validateProfileName(filteredBody.name);
		if (code) return res.status(400).json({ status: "fail", code, message: "Name must contain 3 to 20 characters." });
		filteredBody.name = filteredBody.name.trim();
	}

	const updatedUser = await User.findByIdAndUpdate(req.user.id, filteredBody, {
		new: true,
		runValidators: true,
	}).select(CLIENT_USER_FIELDS);
	res.status(200).json({
		status: "success",
		data: {
			user: clientUser(updatedUser),
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
			clientId: process.env.GOOGLE_CLIENT_ID,
			redirectUri: process.env.GOOGLE_REDIRECT_URI,
		},
	});
};

exports.googleOAuthCallback = async (req, res) => {
	const locale = req.cookies[GOOGLE_OAUTH_LOCALE_COOKIE] === "en" ? "en" : "vi";
	const storedState = req.cookies[GOOGLE_OAUTH_STATE_COOKIE];
	const returnedState =
		typeof req.query.state === "string" ? req.query.state : "";
	let stage = "state_validation";
	let callbackError = "google_oauth_failed";

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

		stage = "token_exchange";
		const googleClient = getGoogleClient();
		const { tokens } = await googleClient.getToken({
			code: req.query.code,
			redirect_uri: process.env.GOOGLE_REDIRECT_URI,
		});

		if (!tokens.id_token) {
			throw new Error("Google did not return an ID token");
		}

		stage = "id_token_verification";
		const ticket = await googleClient.verifyIdToken({
			idToken: tokens.id_token,
			audience: process.env.GOOGLE_CLIENT_ID,
		});
		const payload = ticket.getPayload();
		if (typeof payload?.sub !== "string" || !payload.sub.trim() ||
			payload.sub !== payload.sub.trim() || payload.sub.length > 255 ||
			payload.email_verified !== true || typeof payload.email !== "string" ||
			!validator.isEmail(payload.email.trim())) {
			throw new Error("Invalid Google identity claims");
		}
		const { name, sub, picture } = payload;
		const email = payload.email.trim().toLowerCase();

		stage = "user_lookup";
		// A verified subject identifies the account; email never authorizes linking.
		// Fail closed for ambiguous legacy records without modifying their data.
		const matches = await User.find({ googleId: sub }).select(AUTH_USER_FIELDS).limit(2);
		if (matches.length > 1) {
			callbackError = "google_account_conflict";
			throw new Error("Google identity requires account reconciliation");
		}
		let user = matches[0];
		if (!user) {
			if (await User.exists({ email })) {
				callbackError = "google_account_conflict";
				throw new Error("Email collision requires explicit account linking");
			}
			stage = "user_creation";
			try {
				user = await User.create({
					name: googleDisplayName(name),
					email,
					googleId: sub,
					photo: picture,
				});
			} catch (error) {
				// Signup/another callback may have claimed the email after the lookup.
				if (error.code === 11000) callbackError = "google_account_conflict";
				throw error;
			}
		}

		stage = "auth_cookie";
		clearGoogleOAuthCookies(res);
		setAuthCookie(user, res);
		return res.redirect(303, getGoogleCallbackUrl(locale));
	} catch (error) {
		console.error("[Google OAuth] Callback failed", {
			stage,
			errorName: error?.name || "Error",
			oauthError: error?.response?.data?.error || undefined,
			host: req.hostname,
			forwardedHost: req.get("x-forwarded-host") || undefined,
			hasStateCookie: typeof storedState === "string",
		});
		clearGoogleOAuthCookies(res);
		return res.redirect(
			303,
			getGoogleCallbackUrl(locale, callbackError),
		);
	}
};
