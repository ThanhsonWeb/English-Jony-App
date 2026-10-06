export function vietnamStudyDay(now = new Date()) {
	return new Intl.DateTimeFormat("en-CA", {
		timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit",
	}).format(now);
}

function vocabularyLevel(count) {
	if (count === 0) return 0;
	if (count <= 2) return 1;
	if (count <= 5) return 2;
	if (count <= 9) return 3;
	return 4;
}

export function buildStudyHeatmapDays(activities, now = new Date()) {
	const activityMap = new Map(activities.map(activity => [activity.date, activity]));
	// UTC arithmetic on Vietnam calendar dates avoids device timezones and DST.
	const today = new Date(`${vietnamStudyDay(now)}T00:00:00Z`);
	const start = new Date(today);
	start.setUTCMonth(today.getUTCMonth() - 5, 1);
	start.setUTCDate(start.getUTCDate() - start.getUTCDay());
	const totalDays = Math.round((today - start) / 86400000) + 1;
	return Array.from({ length: totalDays }, (_, index) => {
		const date = new Date(start);
		date.setUTCDate(start.getUTCDate() + index);
		const day = date.toISOString().slice(0, 10);
		const activity = activityMap.get(day);
		const count = activity?.count || 0;
		const hasQualifiedStudy = activity?.hasQualifiedStudy === true;
		return { date: day, count, hasQualifiedStudy, level: Math.max(vocabularyLevel(count), hasQualifiedStudy ? 1 : 0) };
	});
}
