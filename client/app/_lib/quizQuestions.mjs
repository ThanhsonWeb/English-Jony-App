export function normalizeText(value) {
	return String(value || "").trim().toLowerCase();
}

export function eligibleQuizWords(words) {
	return words.filter(word => word.english?.trim() && word.vietnamese?.trim());
}

function shuffle(items) {
	const shuffled = [...items];
	for (let index = shuffled.length - 1; index > 0; index -= 1) {
		const randomIndex = Math.floor(Math.random() * (index + 1));
		[shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
	}
	return shuffled;
}

export function getUniqueTranslations(words) {
	const translations = new Map();
	for (const word of eligibleQuizWords(words)) {
		const normalized = normalizeText(word.vietnamese);
		if (!translations.has(normalized)) translations.set(normalized, word.vietnamese.trim());
	}
	return [...translations.values()];
}

// Only review targets create questions. The user's other saved words supply
// answer strings, never additional review targets or progress submissions.
export function buildQuestions(reviewWords, vocabularyPool) {
	const translations = getUniqueTranslations(vocabularyPool);
	if (translations.length < 4) return [];
	return eligibleQuizWords(reviewWords).map(word => {
		const correctAnswer = word.vietnamese.trim();
		const distractors = shuffle(translations.filter(translation =>
			normalizeText(translation) !== normalizeText(correctAnswer))).slice(0, 3);
		return { word, correctAnswer, choices: shuffle([correctAnswer, ...distractors]) };
	});
}
