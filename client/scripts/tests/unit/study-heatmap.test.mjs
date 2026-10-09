import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildStudyHeatmapDays, vietnamStudyDay } from "../../../app/_lib/studyHeatmap.mjs";
const now = new Date("2026-10-06T10:00:00Z");
const currentDay = activities => buildStudyHeatmapDays(activities, now).at(-1);

test("vocabulary-only levels and legacy counts remain unchanged", () => {
	for (const [count, level] of [[0, 0], [1, 1], [2, 1], [3, 2], [5, 2], [6, 3], [9, 3], [10, 4]]) {
		const day = currentDay([{ date: "2026-10-06", count, hasQualifiedStudy: false }]);
		assert.equal(day.count, count); assert.equal(day.level, level);
	}
});
test("qualified Dialogue, Story and zero-count vocabulary reviews activate a day without inventing vocabulary counts", () => {
	const activities = Object.freeze([
		Object.freeze({ date: "2026-10-04", count: 0, hasQualifiedStudy: true }),
		Object.freeze({ date: "2026-10-05", count: 0, hasQualifiedStudy: true }),
		Object.freeze({ date: "2026-10-06", count: 0, hasQualifiedStudy: true }),
	]);
	const days = buildStudyHeatmapDays(activities, now).slice(-3);
	assert.deepEqual(days.map(day => day.level), [1, 1, 1]);
	assert.deepEqual(days.map(day => day.count), [0, 0, 0]);
});
test("mixed activity is one active day and preserves vocabulary intensity and totals", () => {
	const days = buildStudyHeatmapDays([{ date: "2026-10-06", count: 6, hasQualifiedStudy: true }], now);
	assert.equal(days.filter(day => day.level > 0).length, 1);
	assert.equal(days.reduce((sum, day) => sum + day.count, 0), 6);
	assert.equal(days.at(-1).level, 3);
});
test("no activity, unqualified zero counts and future activity stay inactive", () => {
	assert.equal(currentDay([]).level, 0);
	assert.equal(currentDay([{ date: "2026-10-06", count: 0 }]).level, 0);
	assert.equal(currentDay([{ date: "2026-10-07", count: 10, hasQualifiedStudy: true }]).level, 0);
});
test("Vietnam midnight determines the final day; adjacent days remain distinct", () => {
	const activities = ["2026-10-06", "2026-10-07"].map(date => ({ date, count: 0, hasQualifiedStudy: true }));
	const before = new Date("2026-10-06T16:59:59.999Z"), after = new Date("2026-10-06T17:00:00Z");
	assert.equal(vietnamStudyDay(before), "2026-10-06");
	assert.equal(vietnamStudyDay(after), "2026-10-07");
	assert.equal(buildStudyHeatmapDays(activities, before).at(-1).date, "2026-10-06");
	assert.deepEqual(buildStudyHeatmapDays(activities, after).slice(-2).map(day => [day.date, day.level]), [["2026-10-06", 1], ["2026-10-07", 1]]);
});
test("six calendar months align to Sunday across year/month/leap boundaries without gaps", () => {
	for (const instant of ["2026-01-01T00:00Z", "2024-03-01T00:00Z", "2026-10-31T17:00Z"]) {
		const days = buildStudyHeatmapDays([], new Date(instant));
		assert.equal(new Date(`${days[0].date}T00:00Z`).getUTCDay(), 0);
		assert.equal(days.at(-1).date, vietnamStudyDay(new Date(instant)));
		assert.equal(new Set(days.map(day => day.date)).size, days.length);
		for (let index = 1; index < days.length; index++) assert.equal(new Date(days[index].date) - new Date(days[index - 1].date), 86400000);
	}
});
test("device timezones and DST do not change Vietnam heatmap days", () => {
	const original = process.env.TZ;
	try {
		const expected = buildStudyHeatmapDays([], new Date("2026-03-08T17:00Z"));
		for (const zone of ["UTC", "America/Los_Angeles", "Pacific/Kiritimati", "Asia/Ho_Chi_Minh"]) {
			process.env.TZ = zone;
			assert.deepEqual(buildStudyHeatmapDays([], new Date("2026-03-08T17:00Z")), expected);
		}
	} finally { if (original === undefined) delete process.env.TZ; else process.env.TZ = original; }
});
for (const locale of ["vi", "en"]) test(`${locale} has pending, retry-error and qualified-activity labels`, () => {
	const messages = JSON.parse(readFileSync(new URL(`../../../messages/${locale}.json`, import.meta.url)));
	for (const value of [messages.Auth.signingUp, messages.WordlistDetail.form.adding, messages.WordlistDetail.form.addError, messages.Profile.qualifiedActivityTooltip, messages.Profile.activitySummary]) assert.ok(value?.trim());
});
