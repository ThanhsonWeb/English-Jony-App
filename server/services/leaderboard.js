const mongoose = require("mongoose");
const XPEvent = require("../models/xpEventModel");
const User = require("../models/userModel");
const AppError = require("../utils/appError");

const TIME_ZONE = "Asia/Ho_Chi_Minh";
// Vietnam uses UTC+07:00 without daylight saving for current ranking periods.
const UTC_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function getPeriodBounds(period, timeframe, now = new Date()) {
	if (!["week", "month"].includes(period) || !["current", "previous"].includes(timeframe)) {
		throw new AppError("Use period=week|month and timeframe=current|previous", 400);
	}
	const parts = new Intl.DateTimeFormat("en-CA", {
		timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit",
	}).formatToParts(now);
	const value = type => Number(parts.find(part => part.type === type).value);
	const year = value("year");
	const month = value("month") - 1;
	const day = value("day");
	let start;
	let end;
	if (period === "month") {
		const selectedMonth = month - (timeframe === "previous" ? 1 : 0);
		start = Date.UTC(year, selectedMonth, 1) - UTC_OFFSET_MS;
		end = Date.UTC(year, selectedMonth + 1, 1) - UTC_OFFSET_MS;
	} else {
		const localDate = Date.UTC(year, month, day);
		const daysSinceMonday = (new Date(localDate).getUTCDay() + 6) % 7;
		start = localDate - daysSinceMonday * DAY_MS - UTC_OFFSET_MS;
		if (timeframe === "previous") start -= 7 * DAY_MS;
		end = start + 7 * DAY_MS;
	}
	return { start: new Date(start), end: new Date(end) };
}

async function getLeaderboard({ userId, period = "month", timeframe = "current", limit = 10, now = new Date() }) {
	if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
		throw new AppError("limit must be an integer from 1 to 100", 400);
	}
	const { start, end } = getPeriodBounds(period, timeframe, now);
	const currentUserId = new mongoose.Types.ObjectId(userId);
	// An explicit allowlist is used both in the lookup and final response.
	const publicFields = {
		_id: 0,
		id: { $toString: "$_id" },
		rank: 1,
		name: { $ifNull: ["$profile.name", "Learner"] },
		avatar: { $ifNull: ["$profile.photo", ""] },
		periodXp: 1,
		lifetimeXp: { $ifNull: ["$profile.totalXp", 0] },
		isCurrentUser: { $eq: ["$_id", currentUserId] },
	};
	const [result] = await XPEvent.aggregate([
		{ $match: { earnedAt: { $gte: start, $lt: end } } },
		{ $group: { _id: "$user", periodXp: { $sum: "$amount" } } },
		{ $match: { periodXp: { $gt: 0 } } },
		{ $lookup: {
			from: User.collection.name,
			localField: "_id",
			foreignField: "_id",
			pipeline: [{ $project: { name: 1, photo: 1, totalXp: 1 } }],
			as: "profile",
		} },
		// Deleted users must not occupy positions or leave gaps in the ranking.
		{ $unwind: "$profile" },
		// documentNumber requires one sort field. Object fields compare in order:
		// negative XP puts larger totals first, then user ID breaks ties.
		{ $set: { rankingKey: { xp: { $multiply: ["$periodXp", -1] }, user: "$_id" } } },
		{ $setWindowFields: {
			sortBy: { rankingKey: 1 },
			output: { rank: { $documentNumber: {} } },
		} },
		{ $facet: {
			leaderboard: [{ $sort: { rank: 1 } }, { $limit: limit }, { $project: publicFields }],
			currentUser: [{ $match: { _id: currentUserId } }, { $project: publicFields }],
			count: [{ $count: "total" }],
		} },
	]);

	let currentUser = result.currentUser[0];
	if (!currentUser) {
		const profile = await User.findById(currentUserId).select("name photo totalXp").lean();
		if (!profile) throw new AppError("User not found", 404);
		currentUser = {
			id: String(profile._id), rank: null, name: profile.name ?? "Learner",
			avatar: profile.photo ?? "", periodXp: 0, lifetimeXp: profile.totalXp ?? 0, isCurrentUser: true,
		};
	}
	return {
		period, timeframe, timeZone: TIME_ZONE,
		start: start.toISOString(), end: end.toISOString(),
		limit, totalRanked: result.count[0]?.total ?? 0,
		leaderboard: result.leaderboard, currentUser,
	};
}

module.exports = { getPeriodBounds, getLeaderboard };
