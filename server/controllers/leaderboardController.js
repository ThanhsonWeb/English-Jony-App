const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const { getLeaderboard } = require("../services/leaderboard");

exports.getLeaderboard = catchAsync(async (req, res) => {
	const { period = "month", timeframe = "current", limit = "10" } = req.query;
	if (typeof limit !== "string" || !/^\d+$/.test(limit)) {
		throw new AppError("limit must be an integer from 1 to 100", 400);
	}
	const data = await getLeaderboard({ userId: req.user._id, period, timeframe, limit: Number(limit) });
	res.set("Cache-Control", "private, no-store");
	res.status(200).json({ status: "success", data });
});
