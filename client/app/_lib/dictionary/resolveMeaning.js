function normalize(value = "") {
	return value.toLowerCase().trim().replace(/[‘’]/g, "'");
}

function getContextualMeaning(word, transcript, clickedWord, clickedWordIndex) {
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
	if (!["right", "get", "take", "like", "mean", "book", "welcome"].includes(word)) return null;

	const words = Array.from(transcript.matchAll(/[A-Za-z]+(?:['’\-][A-Za-z]+)*/g),
		(match) => normalize(match[0]));
	const index = Number.isInteger(clickedWordIndex)
		? clickedWordIndex
		: words.indexOf(clickedWord);
	if (index < 0 || index >= words.length) return null;

	const before = words.slice(Math.max(0, index - 4), index);
	const after = words.slice(index + 1, index + 4);
	const previous = before.at(-1);
	const next = after[0];
	const object = ["a", "an", "the"].includes(next) ? after[1] : next;

	if (word === "welcome" && previous === "you're" && next === "to") return "được chào đón";
	if (word === "right") {
		if (["turn", "go"].includes(previous)) return "phải";
		if (previous === "the" && before.at(-2) === "on") return "bên phải";
		if (["is", "are", "was", "you're", "that's"].includes(previous)) return "đúng";
		if (["now", "here"].includes(next)) return "ngay";
	}
	if (word === "get" && next === "to") {
		const destination = ["a", "an", "the"].includes(after[1]) ? after[2] : after[1];
		if (["bus", "stop", "station", "hotel", "airport", "restaurant", "park", "school", "store", "bank"].includes(destination)) return "đến";
	}
	if (word === "take") {
		if (object === "break") return "nghỉ một chút";
		if (["bus", "train", "taxi", "subway"].includes(object)) return "đi bằng";
	}
	if (word === "like" && ["would", "i'd", "you'd"].includes(previous)) return "muốn";
	if (word === "mean") {
		if (next === "to") return "định";
		if (before.includes("what") && before.some((part) => ["do", "does", "did"].includes(part))) return "có nghĩa là";
		if (previous === "i") return "ý tôi là";
	}
	if (word === "book" && ["room", "table", "ticket", "flight"].includes(object)) return "đặt trước";

	return null;
}

export function resolveMeaning({
	result,
	transcript = "",
	clickedWord = "",
	clickedWordIndex,
	matchedPhrase = "",
}) {
	if (!result) return null;

	if (result.source === "phrase" || matchedPhrase) {
		const asksQuestion = normalize(result.text) === "excuse me" &&
			/\bexcuse me[.!?,]?\s+(?:where|how|what|when|which|could|can|do|does|is|are)\b/i.test(transcript);
		return {
			...result,
			displayMeaning: asksQuestion ? "cho tôi hỏi" : result.meaning,
			alternativeMeanings: result.meanings || [],
		};
	}

	const word = normalize(clickedWord || result.text);
	const displayMeaning =
		getContextualMeaning(result.lemma || word, transcript, word, clickedWordIndex) || result.primaryMeaning;

	return { ...result, displayMeaning, alternativeMeanings: result.meanings || [] };
}
