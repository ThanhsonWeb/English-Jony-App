const StudyActivity = require("../models/studyActivityModel");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");

function formatDate(date) {
	return new Intl.DateTimeFormat("en-CA", {
		timeZone: "Asia/Ho_Chi_Minh",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).format(date);
}

// Keep a controlled response for old clients; visits/claims are not study events.
exports.recordActivity = (req, res, next) => next(new AppError("Study activity is recorded with completed reviews", 405));

exports.getActivities = catchAsync(async (req, res) => {
	const startDate = new Date();
	startDate.setDate(startDate.getDate() - 364);

	const activities = await StudyActivity.find({
		user: req.user.id,
		date: { $gte: formatDate(startDate) },
	}).sort("date");

	res.status(200).json({
		status: "success",
		data: { activities },
	});
});
