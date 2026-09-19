const assert = require("node:assert/strict");
const { test } = require("node:test");
const { getLearnerLevel } = require("../utils/learnerLevel");

test("level boundaries and progress use lifetime XP", () => {
	for (const [xp, level, currentLevelXp, nextLevelXp, progressPercent] of [
		[0, 1, 0, 100, 0], [99, 1, 99, 100, 99],
		[100, 2, 0, 150, 0], [175, 2, 75, 150, 50], [249, 2, 149, 150, 149 / 150 * 100],
		[250, 3, 0, 250, 0], [499, 3, 249, 250, 99.6],
		[500, 4, 0, 500, 0], [999, 4, 499, 500, 99.8],
		[1000, 5, 0, null, 100], [5000, 5, 4000, null, 100],
		[Number.MAX_SAFE_INTEGER, 5, Number.MAX_SAFE_INTEGER - 1000, null, 100],
	]) {
		assert.deepEqual(getLearnerLevel(xp), { level, currentLevelXp, nextLevelXp, progressPercent }, `XP ${xp}`);
	}
});

test("missing legacy XP defaults to level one; invalid totals are rejected", () => {
	assert.deepEqual(getLearnerLevel(), getLearnerLevel(0));
	for (const xp of [-1, 0.5, NaN, Infinity, "100", null, Number.MAX_SAFE_INTEGER + 1]) {
		assert.throws(() => getLearnerLevel(xp), TypeError);
	}
});
