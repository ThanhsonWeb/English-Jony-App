function hasBeenReviewed(word) {
	if ((word.reviewCount || 0) > 0) return true;
	if (word.lastReviewedAt !== undefined) {
		return (
			word.lastReviewedAt !== null &&
			Number.isFinite(new Date(word.lastReviewedAt).getTime())
		);
	}
	// Older Again reviews lack lastReviewedAt, but schedule at least one hour
	// after creation. New words' default nextReview is their creation time.
	if (!word.createdAt || !word.nextReview || word.learningLevel !== 0 || word.status === true) {
		return false;
	}
	return (
		new Date(word.nextReview).getTime() - new Date(word.createdAt).getTime() >= 60 * 60 * 1000
	);
}

export function isReviewDue(word, now = new Date()) {
	return (
		hasBeenReviewed(word) &&
		Boolean(word.nextReview) &&
		new Date(word.nextReview) <= now
	);
}

export function getWordStatus(word, now = new Date()) {
	if (!hasBeenReviewed(word)) return "new";
	if (isReviewDue(word, now)) return "review";
	if (word.status === true) return "mastered";
	return "learning";
}

export function selectReviewWords(
	words,
	{ global = false, dueOnly = false, now = new Date() } = {},
) {
	const valid = words.filter(
		(word) => word.english?.trim() && word.vietnamese?.trim(),
	);
	if (dueOnly) return valid.filter((word) => isReviewDue(word, now));
	if (!global)
		return valid.filter(
			(word) => word.nextReview && new Date(word.nextReview) <= now,
		);
	const priority = { review: 0, learning: 1, new: 2 };
	return valid
		.filter((word) => getWordStatus(word, now) !== "mastered")
		.sort(
			(a, b) =>
				priority[getWordStatus(a, now)] - priority[getWordStatus(b, now)],
		);
}

export async function fetchVocabulary(topicId, signal) {
	const response = await fetch(
		`/api/v1/vocab${topicId ? `?topic=${encodeURIComponent(topicId)}` : ""}`,
		{ credentials: "include", signal, cache: "no-store" },
	);
	if (!response.ok)
		throw new Error(response.status === 401 ? "unauthorized" : "loadError");
	return (await response.json()).data.vocabularies;
}

export function speakWord(english) {
	if (!("speechSynthesis" in window)) return false;
	window.speechSynthesis.cancel();
	const utterance = new SpeechSynthesisUtterance(english);
	utterance.lang = "en-US";
	window.speechSynthesis.speak(utterance);
	return true;
}
