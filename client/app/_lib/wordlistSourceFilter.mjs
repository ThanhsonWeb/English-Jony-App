import { getWordStatus } from "./vocabulary.mjs";

export function sourceKey(word) {
	const source = word.source;
	return source?.lessonId && source?.dialogueId ? JSON.stringify([source.lessonId, source.dialogueId]) : "custom";
}

export function filterReviewWords(words, { status, lessonId, dialogueId, sourceType } = {}) {
	return words.filter((word) => {
		if (status && status !== "all" && getWordStatus(word) !== status) return false;
		if (sourceType === "custom") return sourceKey(word) === "custom";
		if (lessonId && dialogueId) return word.source?.lessonId === lessonId && word.source?.dialogueId === dialogueId;
		return true;
	});
}

export function selectFilteredReviewWords(words, options, filters) {
	const hasFilter = (filters.status && filters.status !== "all") || filters.sourceType === "custom" || (filters.lessonId && filters.dialogueId);
	if (!hasFilter) return null;
	return filterReviewWords(words, filters).filter((word) => word.english?.trim() && word.vietnamese?.trim());
}
