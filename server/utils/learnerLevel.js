const LEVEL_STARTS = [0, 100, 250, 500, 1000];

// Derived only from User.totalXp; levels are never stored separately.
function getLearnerLevel(totalXp = 0) {
	if (!Number.isSafeInteger(totalXp) || totalXp < 0) {
		throw new TypeError("totalXp must be a non-negative safe integer");
	}
	let index = LEVEL_STARTS.length - 1;
	while (totalXp < LEVEL_STARTS[index]) index -= 1;
	const currentLevelXp = totalXp - LEVEL_STARTS[index];
	const nextLevelXp = index === LEVEL_STARTS.length - 1 ? null : LEVEL_STARTS[index + 1] - LEVEL_STARTS[index];
	return {
		level: index + 1,
		currentLevelXp,
		nextLevelXp,
		progressPercent: nextLevelXp === null ? 100 : currentLevelXp / nextLevelXp * 100,
	};
}

module.exports = { getLearnerLevel };
