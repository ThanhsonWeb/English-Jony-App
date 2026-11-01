const Feedback = require("../models/feedbackModel");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");

const allowedTypes = new Set(["suggestion", "bug", "general"]);
const allowedFields = new Set(["type", "message", "website"]);

exports.submitFeedback = catchAsync(async (req, res, next) => {
	const body = req.body;
	if (!body || typeof body !== "object" || Array.isArray(body)) {
		return next(new AppError("Please check your feedback and try again.", 400));
	}
	if (Object.keys(body).some((key) => !allowedFields.has(key))) {
		return next(new AppError("Please check your feedback and try again.", 400));
	}

	// Quietly accept honeypot submissions without saving them.
	if (typeof body.website === "string" && body.website.trim()) {
		return res.status(202).json({ status: "success" });
	}

	const type = typeof body.type === "string" ? body.type : "";
	const message = typeof body.message === "string" ? body.message.trim() : "";
	if (!allowedTypes.has(type) || message.length < 10 || message.length > 2000) {
		return next(new AppError("Please check your feedback and try again.", 400));
	}
	if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(message)) {
		return next(new AppError("Please check your feedback and try again.", 400));
	}

	await Feedback.create({ type, message });
	return res.status(201).json({ status: "success" });
});
