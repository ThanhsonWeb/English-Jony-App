const BEGINNER_OVERRIDES = {
	great: "tuyệt",
	how: "thế nào",
	please: "làm ơn",
	reservation: "đặt phòng",
	room: "phòng",
	stay: "ở / lưu trú",
};

function normalize(value = "") {
	return value.toLowerCase().trim();
}

function getContextualMeaning(word, transcript) {
	if (
		word === "free" &&
		/\b(wi-fi|wifi|breakfast|service|parking)\b/i.test(transcript)
	) {
		return "miễn phí";
	}

	if (
		word === "stay" &&
		/\b(hotel|room|night|nights|check in|reservation)\b/i.test(transcript)
	) {
		return "ở / lưu trú";
	}

	return null;
}

function getShortMeaning(meaning = "") {
	const firstMeaning = meaning
		.split(/[;.]/, 1)[0]
		.split(",", 1)[0]
		.trim()
		.replace(/[.!?]+$/, "");

	if (!firstMeaning) return null;
	return firstMeaning.charAt(0).toLocaleLowerCase("vi") + firstMeaning.slice(1);
}

export function resolveMeaning({
	result,
	transcript = "",
	clickedWord = "",
	matchedPhrase = "",
}) {
	if (!result) return null;

	if (result.source === "phrase" || matchedPhrase) {
		return { ...result, displayMeaning: result.meaning };
	}

	const word = normalize(clickedWord || result.text);
	const displayMeaning =
		getContextualMeaning(word, transcript) ||
		BEGINNER_OVERRIDES[word] ||
		getShortMeaning(result.meaning) ||
		result.meaning;

	return { ...result, displayMeaning };
}
