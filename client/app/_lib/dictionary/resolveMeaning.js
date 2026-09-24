function normalize(value = "") {
	return value.toLowerCase().trim();
}

function getContextualMeaning(word, transcript) {
	if (word === "at") {
		if (/\bat\s+(?:\d|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|noon|midnight|night|morning|afternoon|evening)\b/i.test(transcript)) {
			return "lúc";
		}
		if (/\bat\s+(?:home|work|school|the\s+(?:hotel|office|café|cafe|restaurant|desk|reception))\b/i.test(transcript)) {
			return "ở / tại";
		}
		return "tại";
	}

	if (word === "on") {
		if (/\bon\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|\d)/i.test(transcript)) {
			return "vào";
		}
		return "trên";
	}

	if (word === "for") {
		if (/\bfor\s+(?:a|an|one|two|three|four|five|six|seven|eight|nine|ten|\d+)\s+(?:minute|minutes|hour|hours|day|days|night|nights|week|weeks)\b/i.test(transcript)) {
			return "trong";
		}
		if (/\bfor\s+(?:helping|being|doing|coming|your\s+help|that|this)\b/i.test(transcript)) {
			return "vì";
		}
		return "cho";
	}

	if (word === "to") {
		if (/\bto\s+(?:be|check|do|get|go|help|learn|make|meet|see|stay|work)\b/i.test(transcript)) {
			return "để";
		}
		return "đến";
	}

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

export function resolveMeaning({
	result,
	transcript = "",
	clickedWord = "",
	matchedPhrase = "",
}) {
	if (!result) return null;

	if (result.source === "phrase" || matchedPhrase) {
		return { ...result, displayMeaning: result.meaning, alternativeMeanings: result.meanings || [] };
	}

	const word = normalize(clickedWord || result.text);
	const displayMeaning =
		getContextualMeaning(word, transcript) || result.primaryMeaning;

	return { ...result, displayMeaning, alternativeMeanings: result.meanings || [] };
}
