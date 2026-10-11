"use client";

import { useCachedResource } from "./useCachedResource";
import { fetchVocabulary, vocabularyKey } from "./vocabulary.mjs";
import { resourceCache } from "./resourceCache.mjs";

export { vocabularyKey };
export const progressKey = lessonId => `progress:${lessonId}`;
export async function fetchLessonProgress(lessonId) {
	const response = await fetch(`/api/v1/dialogue-progress/${lessonId}`, { credentials: "include", cache: "no-store" });
	if (!response.ok) throw new Error(response.status === 401 ? "unauthorized" : "loadError");
	return (await response.json()).data.progress || [];
}

export function useVocabularyResource(userId, topicId, enabled = true) {
	return useCachedResource({ userId, key: vocabularyKey(topicId), enabled: enabled && Boolean(userId),
		persist: true, staleTime: 30_000, fetcher: () => fetchVocabulary(topicId) });
}

export function useLessonProgressResource(userId, lessonId, enabled = true) {
	return useCachedResource({ userId, key: progressKey(lessonId), enabled: enabled && Boolean(userId && lessonId),
		persist: true, staleTime: 30_000, fetcher: () => fetchLessonProgress(lessonId) });
}

export function useCatalogueProgressResource(userId, courses, enabled = true) {
	return useCachedResource({ userId, key: "progress:catalogue", enabled: enabled && Boolean(userId),
		persist: true, staleTime: 30_000, fetcher: async () => Object.fromEntries(await Promise.all(courses.map(async course => [
			course.id,
			await resourceCache.load(userId, progressKey(course.id), () => fetchLessonProgress(course.id), { persist: true, staleTime: 30_000 }),
		]))) });
}

export function useLeaderboardResource(userId, period, timeframe, enabled = true) {
	const query = new URLSearchParams({ period, timeframe, limit: "10" });
	return useCachedResource({ userId: userId || "guest", key: `leaderboard:${period}:${timeframe}`,
		enabled, staleTime: 30_000, fetcher: async () => {
			const response = await fetch(`/api/v1/leaderboard?${query}`, { credentials: "include", cache: "no-store" });
			if (!response.ok) throw new Error(response.status === 401 ? (userId ? "unauthorized" : "signIn") : "loadError");
			return (await response.json()).data;
		} });
}

export function useStudyActivitiesResource(userId, enabled = true) {
	return useCachedResource({ userId, key: "study-activities", enabled: enabled && Boolean(userId),
		persist: true, staleTime: 60_000, fetcher: async () => {
			const response = await fetch("/api/v1/study-activities", { credentials: "include", cache: "no-store" });
			if (!response.ok) throw new Error(response.status === 401 ? "unauthorized" : "loadError");
			return (await response.json()).data.activities || [];
		} });
}
