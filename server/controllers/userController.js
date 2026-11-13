const User = require("../models/userModel");
const mongoose = require("mongoose");
const { randomUUID } = require("node:crypto");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const { isValidAvatar, uploadAvatar, getAvatarStorageProvider } = require("../services/avatarUpload");
const { reserveAvatarUpload, beginAvatarUpload, recordUploadOutcome, attachAvatarUpload } = require("../services/avatarUploadIntent");
const { CLIENT_USER_FIELDS, clientUser } = require("../utils/clientUser");
const { isActiveAccount, activeAccountFilter, fenceActiveAccountWrite } = require("../utils/accountLifecycle");
const { initiateAccountDeletion } = require("../services/accountDeletion");

const ACCOUNT_WRITE_TRANSACTION_OPTIONS = {
	readPreference: "primary",
	readConcern: { level: "snapshot" },
	writeConcern: { w: "majority" },
};

exports.getAllUsers = catchAsync(async (req, res, next) => {
	const users = await User.find().select(CLIENT_USER_FIELDS);

	res.status(200).json({
		status: " success",
		data: { users: users.map(clientUser) },
	});
});

exports.getMe = catchAsync(async (req, res, next) => {
	//  so req.user is available from protect
	res.status(200).json({
		status: "success",
		data: {
			user: {
				...clientUser(req.user),
				canRequestPasswordAccountDeletion: !req.user.googleId,
			},
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

	const user = await mongoose.connection.transaction(async session => {
		await fenceActiveAccountWrite(req.user.id, session);
		return User.findByIdAndUpdate(
			req.user.id,
			{ theme },
			{ returnDocument: "after", runValidators: true, session },
		).select(CLIENT_USER_FIELDS);
	}, ACCOUNT_WRITE_TRANSACTION_OPTIONS);
	res.status(200).json({ status: "success", data: { theme: user.theme } });
});

exports.updateLanguage = catchAsync(async (req, res, next) => {
	const { language, expectedUserId } = req.body || {};
	if (typeof language !== "string" || !User.schema.path("language").enumValues.includes(language) ||
		Object.keys(req.body).some(key => !["language", "expectedUserId"].includes(key))) {
		return next(new AppError("Invalid language preference.", 400));
	}
	// A request started by A must not update B after a cookie/account switch.
	if (expectedUserId !== req.user.id) {
		return next(new AppError("Account changed. Please try again.", 409));
	}
	const user = await mongoose.connection.transaction(async session => {
		await fenceActiveAccountWrite(req.user.id, session);
		return User.findByIdAndUpdate(req.user.id, { language }, {
			returnDocument: "after", runValidators: true, session,
		}).select("language");
	}, ACCOUNT_WRITE_TRANSACTION_OPTIONS);
	if (!user) return next(new AppError("Account no longer exists.", 401));
	res.status(200).json({ status: "success", data: { language: user.language } });
});

exports.updateMe = catchAsync(async (req, res, next) => {
	const updatedUser = await mongoose.connection.transaction(async session => {
		await fenceActiveAccountWrite(req.user.id, session);
		return User.findByIdAndUpdate(
			req.user.id,
			{ name: req.body.name },
			{ new: true, runValidators: true, session },
		).select(CLIENT_USER_FIELDS);
	}, ACCOUNT_WRITE_TRANSACTION_OPTIONS);

	res.status(200).json({
		status: "success",
		data: {
			user: clientUser(updatedUser),
		},
	});
});

exports.updateAvatar = catchAsync(async (req, res, next) => {
	const type = req.headers["content-type"]?.split(";")[0].toLowerCase();
	if (!isValidAvatar(req.body, type)) {
		return next(new AppError("Choose a JPG, PNG, or WebP image under 2 MB.", 400));
	}

	let provider;
	try {
		provider = getAvatarStorageProvider();
	} catch (error) {
		console.error("Avatar upload failed:", error.message);
		if (error.message === "Avatar storage is not configured") {
			return next(new AppError("Avatar storage is not configured.", 503));
		}
		return next(new AppError("Could not upload avatar. Please try again.", 502));
	}

	const intent = await reserveAvatarUpload(req.user.id, {
		operationId: randomUUID(), provider, cloudName: provider === "cloudinary" ? process.env.CLOUDINARY_CLOUD_NAME?.trim() : undefined,
		contentType: type,
	});
	const claim = await beginAvatarUpload(req.user.id, intent.id);
	if (!claim.claimed) throw new AppError("Could not start avatar upload. Please try again.", 409);
	let avatar;
	try {
		avatar = await uploadAvatar(req.body, type, req.user.id, intent.storageKey, process.env,
			provider === "cloudinary" ? claim.intent.cloudName : undefined);
	} catch (error) {
		// The pending cleanup record remains durable even if recording the result fails.
		try { await recordUploadOutcome(req.user.id, intent.id, error.uploadOutcome || "uncertain"); }
		catch { console.error("Could not record avatar upload outcome"); }
		console.error("Avatar upload failed:", error.message);
		if (error.message === "Avatar storage is not configured") {
			return next(new AppError("Avatar storage is not configured.", 503));
		}
		return next(new AppError("Could not upload avatar. Please try again.", 502));
	}

	let user;
	try {
		user = await attachAvatarUpload(req.user.id, intent.id, avatar);
	} catch (error) {
		// This conditional update cannot mark an already-attached intent for cleanup.
		try { await recordUploadOutcome(req.user.id, intent.id, "success"); }
		catch { /* A committed or unresolved transaction remains discoverable. */ }
		throw error;
	}
	res.status(200).json({ status: "success", data: { user: clientUser(user) } });
});

exports.requestAccountDeletion = catchAsync(async (req, res, next) => {
	const body = req.body;
	if (!body || typeof body !== "object" || Array.isArray(body) ||
		Object.keys(body).some(key => !["confirmation", "currentPassword"].includes(key)) ||
		body.confirmation !== "DELETE MY ACCOUNT" ||
		typeof body.currentPassword !== "string" || !body.currentPassword) {
		return next(new AppError("Confirm deletion and provide your current password.", 400));
	}

	const account = await User.findById(req.user.id).select("+password +lifecycleState");
	if (!isActiveAccount(account)) {
		return next(new AppError("Invalid or expired session. Please log in again.", 401));
	}
	if (typeof account.password !== "string" || !account.password) {
		return next(new AppError("Password reauthentication is unavailable for this account.", 403));
	}

	const correct = await account.correctPassword(body.currentPassword, account.password);
	if (!correct) return next(new AppError("Your current password is wrong.", 401));

	// Reject a password change or lifecycle transition that won while bcrypt was running.
	const stillCurrent = await User.exists({
		_id: account._id,
		password: account.password,
		...activeAccountFilter(),
	});
	if (!stillCurrent) return next(new AppError("Please reauthenticate and try again.", 401));

	await initiateAccountDeletion(account._id, { expectedPasswordHash: account.password });
	return res.status(202).json({ status: "success", data: { requested: true } });
});
