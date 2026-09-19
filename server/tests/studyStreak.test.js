const assert = require("node:assert/strict");
const { test } = require("node:test");
const { calculateStreak, vietnamDay } = require("../services/studyStreak");

test("consecutive days, gaps, duplicate days and today-not-yet-studied", () => {
	const now = new Date("2026-09-18T10:00:00Z");
	assert.equal(calculateStreak(["2026-09-16", "2026-09-17", "2026-09-18", "2026-09-18"], now).streakDays, 3);
	assert.equal(calculateStreak(["2026-09-16", "2026-09-17"], now).streakDays, 2);
	assert.equal(calculateStreak(["2026-09-16", "2026-09-18"], now).streakDays, 1);
	assert.equal(calculateStreak(["2026-09-16"], now).streakDays, 0);
	assert.equal(calculateStreak([], now).streakDays, 0);
	assert.deepEqual(calculateStreak(["2026-09-14", "2026-09-17", "2026-09-19"], now).completedWeekdays, [true, false, false, true, false, false, false]);
});

test("Vietnam midnight grace, year boundaries and leap day", () => {
	assert.equal(vietnamDay(new Date("2026-09-18T16:59:59.999Z")), "2026-09-18");
	assert.equal(vietnamDay(new Date("2026-09-18T17:00:00Z")), "2026-09-19");
	const days = ["2026-09-17", "2026-09-18"];
	assert.equal(calculateStreak(days, new Date("2026-09-18T17:00:00Z")).streakDays, 2);
	assert.equal(calculateStreak(days, new Date("2026-09-19T17:00:00Z")).streakDays, 0);
	assert.equal(calculateStreak(["2025-12-31", "2026-01-01"], new Date("2026-01-01T00:00Z")).streakDays, 2);
	assert.equal(calculateStreak(["2024-02-28", "2024-02-29", "2024-03-01"], new Date("2024-03-01T00:00Z")).streakDays, 3);
});
