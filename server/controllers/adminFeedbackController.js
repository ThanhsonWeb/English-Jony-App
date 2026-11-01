const mongoose = require("mongoose");
const Feedback = require("../models/feedbackModel");
const AppError = require("../utils/appError");
const catchAsync = require("../utils/catchAsync");

const feedbackTypes = new Set(["suggestion", "bug", "general"]);
const feedbackStatuses = new Set(["new", "reviewing", "resolved"]);
const feedbackFields = "_id type message status createdAt";
const allowedQueryFields = new Set(["type", "status", "page", "limit"]);
const defaultLimit = 20;
const maxLimit = 50;

function invalidRequest(next) {
	return next(new AppError("Invalid feedback request.", 400));
}

function positiveInteger(value, fallback) {
	if (value === undefined) return fallback;
	if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) return null;
	const parsed = Number(value);
	return Number.isSafeInteger(parsed) ? parsed : null;
}

exports.listFeedback = catchAsync(async (req, res, next) => {
	const params = req.query || {};
	if (Object.keys(params).some((key) => !allowedQueryFields.has(key))) return invalidRequest(next);

	const { type, status } = params;
	if (type !== undefined && (typeof type !== "string" || !feedbackTypes.has(type))) return invalidRequest(next);
	if (status !== undefined && (typeof status !== "string" || !feedbackStatuses.has(status))) return invalidRequest(next);

	const page = positiveInteger(params.page, 1);
	const limit = positiveInteger(params.limit, defaultLimit);
	const offset = page && limit ? (page - 1) * limit : null;
	if (!page || !limit || limit > maxLimit || !Number.isSafeInteger(offset)) return invalidRequest(next);

	const filter = {};
	if (type) filter.type = type;
	if (status === "new") {
		// Feedback created before statuses existed is treated as new without a migration.
		filter.$or = [{ status: "new" }, { status: { $exists: false } }];
	} else if (status) {
		filter.status = status;
	}

	const totalRecords = await Feedback.countDocuments(filter);
	const totalPages = Math.max(1, Math.ceil(totalRecords / limit));
	const records = offset >= totalRecords ? [] : await Feedback.find(filter)
		.select(feedbackFields)
		.sort({ createdAt: -1, _id: -1 })
		.skip(offset)
		.limit(limit)
		.lean();

	res.status(200).json({
		status: "success",
		data: {
			feedback: records.map((record) => ({ ...record, status: record.status || "new" })),
			pagination: { page, limit, totalRecords, totalPages },
		},
	});
});

exports.updateFeedbackStatus = catchAsync(async (req, res, next) => {
	const body = req.body;
	if (!mongoose.isObjectIdOrHexString(req.params.id) || !body || typeof body !== "object" ||
		Array.isArray(body) || Object.keys(body).length !== 1 || typeof body.status !== "string" ||
		!feedbackStatuses.has(body.status)) return invalidRequest(next);

	const feedback = await Feedback.findOneAndUpdate(
		{ _id: req.params.id },
		{ $set: { status: body.status } },
		{ returnDocument: "after", runValidators: true },
	).select(feedbackFields).lean();
	if (!feedback) return next(new AppError("Feedback not found.", 404));
	res.status(200).json({ status: "success", data: { feedback: { ...feedback, status: feedback.status || "new" } } });
});

exports.deleteFeedback = catchAsync(async (req, res, next) => {
	if (!mongoose.isObjectIdOrHexString(req.params.id)) return invalidRequest(next);
	const feedback = await Feedback.findByIdAndDelete(req.params.id).select("_id");
	if (!feedback) return next(new AppError("Feedback not found.", 404));
	res.status(204).end();
});
