import { resourceCache } from "./resourceCache.mjs";

// Dialogue and Story routes use the same confirmed progress response.
export function cacheStudyProgress(userId, progress, cache = resourceCache) {
	if (!userId || !progress?.lessonId || !progress.dialogueId) return;
	const key = `progress:${progress.lessonId}`;
	const catalogue = cache.read(userId, "progress:catalogue", true).data;
	const previous = cache.read(userId, key, true).data || catalogue?.[progress.lessonId] || [];
	const oldProgress = previous.find(item => item.dialogueId === progress.dialogueId);
	const latest = Date.parse(oldProgress?.updatedAt) > Date.parse(progress.updatedAt) ? oldProgress : progress;
	const confirmed = { ...latest, completedTaskIds: [...new Set([
		...(oldProgress?.completedTaskIds || []), ...(progress.completedTaskIds || []),
	])] };
	const updated = [...previous.filter(item => item.dialogueId !== progress.dialogueId), confirmed];
	cache.write(userId, key, updated, { persist: true });
	if (catalogue) cache.write(userId, "progress:catalogue", { ...catalogue, [progress.lessonId]: updated }, { persist: true });
	else cache.invalidate(userId, "progress:catalogue");
	cache.invalidate(userId, "study-activities");
	cache.invalidatePrefix(userId, "leaderboard:");
}
