export function isReviewDue(word, now = new Date()) {
	return (
		(word.reviewCount || 0) > 0 &&
		Boolean(word.nextReview) &&
		new Date(word.nextReview) <= now
	);
}

export function getWordStatus(word, now = new Date()) {
	if ((word.reviewCount || 0) === 0) return "new";
	if (isReviewDue(word, now)) return "review";
	if (word.status === true) return "mastered";
	return "learning";
}

export function selectReviewWords(
	words,
	{ global = false, now = new Date() } = {},
) {
	const valid = words.filter(
		(word) => word.english?.trim() && word.vietnamese?.trim(),
	);
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
