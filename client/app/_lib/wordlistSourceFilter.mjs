import { getWordStatus } from "./vocabulary.mjs";
import { lessonData } from "../[locale]/(main)/dialogue/_data/lessonData.js";
import { getCourseCategory } from "./dialogue/catalogueCategories.mjs";

export function sourceKey(word) {
	const source = word.source;
	if (!source?.lessonId) return "custom";
	const course = lessonData[source.lessonId];
	if (!course) return "other";
	return getCourseCategory(course);
}

export function filterReviewWords(words, { status, lessonId, dialogueId, sourceType, category } = {}) {
	return words.filter((word) => {
		if (status && status !== "all" && getWordStatus(word) !== status) return false;
		if (sourceType === "custom") return sourceKey(word) === "custom";
		if (category) return sourceKey(word) === category;
		if (lessonId && dialogueId) return word.source?.lessonId === lessonId && word.source?.dialogueId === dialogueId;
		return true;
	});
}

export function selectFilteredReviewWords(words, options, filters) {
	const hasFilter = (filters.status && filters.status !== "all") || filters.sourceType === "custom" || filters.category || (filters.lessonId && filters.dialogueId);
	if (!hasFilter) return null;
	return filterReviewWords(words, filters).filter((word) => word.english?.trim() && word.vietnamese?.trim());
}
