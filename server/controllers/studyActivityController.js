const StudyActivity = require("../models/studyActivityModel");
const catchAsync = require("../utils/catchAsync");

function formatDate(date) {
	return new Intl.DateTimeFormat("en-CA", {
		timeZone: "Asia/Ho_Chi_Minh",
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).format(date);
}

exports.recordActivity = catchAsync(async (req, res) => {
	const date = formatDate(new Date());

	const activity = await StudyActivity.findOneAndUpdate(
		{ user: req.user.id, date },
		{ $inc: { count: 1 } },
		{
			new: true,
			upsert: true,
			setDefaultsOnInsert: true,
		},
	);

	res.status(200).json({
		status: "success",
		data: { activity },
	});
});

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
