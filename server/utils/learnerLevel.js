// Total lifetime KN needed to enter each level. Append new thresholds to extend it.
const LEVEL_STARTS = Object.freeze([
	0, 200, 500, 900, 1400, 2000, 2700, 3500, 4400, 5500,
	6800, 8300, 10000, 11900, 14000, 16300, 18800, 21500, 24400, 27500,
]);

// Derived only from User.totalXp; levels are never stored separately.
function getLearnerLevel(totalXp = 0) {
	if (!Number.isSafeInteger(totalXp) || totalXp < 0) {
		throw new TypeError("totalXp must be a non-negative safe integer");
	}
	let index = LEVEL_STARTS.length - 1;
	while (totalXp < LEVEL_STARTS[index]) index -= 1;
	const currentLevelXp = totalXp - LEVEL_STARTS[index];
	const nextLevelTotalXp = LEVEL_STARTS[index + 1] ?? null;
	const nextLevelXp = nextLevelTotalXp === null ? null : nextLevelTotalXp - LEVEL_STARTS[index];
	return {
		level: index + 1,
		currentLevelXp,
		nextLevelXp,
		nextLevelTotalXp,
		xpToNextLevel: nextLevelTotalXp === null ? null : nextLevelTotalXp - totalXp,
		progressPercent: nextLevelXp === null ? 100 : currentLevelXp / nextLevelXp * 100,
	};
}

module.exports = { getLearnerLevel, LEVEL_STARTS };
