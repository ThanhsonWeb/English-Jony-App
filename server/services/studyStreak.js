const StudyActivity = require("../models/studyActivityModel");

function vietnamDay(now = new Date()) {
	return new Intl.DateTimeFormat("en-CA", {
		timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit",
	}).format(now);
}

function shiftDay(day, offset) {
	const date = new Date(`${day}T00:00:00Z`);
	date.setUTCDate(date.getUTCDate() + offset);
	return date.toISOString().slice(0, 10);
}

function calculateStreak(days, now = new Date()) {
	const qualified = new Set(days);
	const today = vietnamDay(now);
	let cursor = qualified.has(today) ? today : shiftDay(today, -1);
	let streakDays = 0;
	while (qualified.has(cursor)) {
		streakDays += 1;
		cursor = shiftDay(cursor, -1);
	}
	const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
	const monday = shiftDay(today, -((weekday + 6) % 7));
	return {
		streakDays,
		completedWeekdays: Array.from({ length: 7 }, (_, i) => {
			const day = shiftDay(monday, i);
			return day <= today && qualified.has(day);
		}),
	};
}

async function markQualifiedStudy(userId, { session, now = new Date() } = {}) {
	// Qualification never increments the legacy count. A new streak-only day
	// starts at zero; legacy activity writes can continue incrementing it.
	await StudyActivity.updateOne({ user: userId, date: vietnamDay(now) }, {
		$set: { hasQualifiedStudy: true },
		$min: { firstStudyAt: now },
		$max: { lastStudyAt: now },
		$setOnInsert: { count: 0 },
	}, { upsert: true, session });
}

async function getStudyStreaks(userIds, now = new Date()) {
	const daysByUser = new Map(userIds.map(id => [String(id), []]));
	const activities = await StudyActivity.find({
		user: { $in: userIds }, hasQualifiedStudy: true, date: { $lte: vietnamDay(now) },
	}).select("user date -_id").lean();
	for (const activity of activities) daysByUser.get(String(activity.user)).push(activity.date);
	return new Map([...daysByUser].map(([id, days]) => [id, calculateStreak(days, now)]));
}

module.exports = { vietnamDay, calculateStreak, markQualifiedStudy, getStudyStreaks };
