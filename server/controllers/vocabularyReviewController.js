const catchAsync = require("../utils/catchAsync");
const { reviewVocabulary } = require("../services/vocabularyReview");

exports.reviewVocabulary = catchAsync(async (req, res) => {
	const data = await reviewVocabulary(req.user._id, req.params.id, req.body || {});
	res.status(200).json({ status: "success", data });
});
