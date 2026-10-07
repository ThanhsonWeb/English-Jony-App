const catchAsync = require("../utils/catchAsync");
const { reviewVocabulary } = require("../services/vocabularyReview");
const AppError = require("../utils/appError");

exports.reviewVocabulary = catchAsync(async (req, res) => {
	if (typeof req.body?.reviewId !== "string") throw new AppError("A review identity is required", 400);
	const data = await reviewVocabulary(req.user._id, req.params.id, req.body || {});
	res.status(200).json({ status: "success", data });
});
