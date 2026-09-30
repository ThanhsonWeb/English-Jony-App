const assert = require("node:assert/strict");
const { test } = require("node:test");
const { getLearnerLevel, LEVEL_STARTS } = require("../utils/learnerLevel");

const expectedStarts = [
	0, 200, 500, 900, 1400, 2000, 2700, 3500, 4400, 5500,
	6800, 8300, 10000, 11900, 14000, 16300, 18800, 21500, 24400, 27500,
];

test("levels 1 through 20 start at the configured lifetime KN thresholds", () => {
	assert.deepEqual(LEVEL_STARTS, expectedStarts);
	for (const [index, start] of expectedStarts.entries()) {
		const nextStart = expectedStarts[index + 1] ?? null;
		assert.deepEqual(getLearnerLevel(start), {
			level: index + 1,
			currentLevelXp: 0,
			nextLevelXp: nextStart === null ? null : nextStart - start,
			nextLevelTotalXp: nextStart,
			xpToNextLevel: nextStart === null ? null : nextStart - start,
			progressPercent: nextStart === null ? 100 : 0,
		}, `KN ${start}`);
		if (start > 0) assert.equal(getLearnerLevel(start - 1).level, index);
	}
});

test("progress counts only KN earned within the current level", () => {
	assert.deepEqual(getLearnerLevel(1422), {
		level: 5,
		currentLevelXp: 22,
		nextLevelXp: 600,
		nextLevelTotalXp: 2000,
		xpToNextLevel: 578,
		progressPercent: 22 / 600 * 100,
	});
	assert.deepEqual(getLearnerLevel(1999), {
		level: 5,
		currentLevelXp: 599,
		nextLevelXp: 600,
		nextLevelTotalXp: 2000,
		xpToNextLevel: 1,
		progressPercent: 599 / 600 * 100,
	});
	assert.deepEqual(getLearnerLevel(27600), {
		level: 20,
		currentLevelXp: 100,
		nextLevelXp: null,
		nextLevelTotalXp: null,
		xpToNextLevel: null,
		progressPercent: 100,
	});
});

test("missing legacy KN defaults to level one; invalid totals are rejected", () => {
	assert.deepEqual(getLearnerLevel(), getLearnerLevel(0));
	for (const xp of [-1, 0.5, NaN, Infinity, "100", null, Number.MAX_SAFE_INTEGER + 1]) {
		assert.throws(() => getLearnerLevel(xp), TypeError);
	}
});
