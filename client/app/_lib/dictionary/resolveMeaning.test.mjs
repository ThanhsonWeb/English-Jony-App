import assert from "node:assert/strict";
import test from "node:test";

import { resolveMeaning } from "./resolveMeaning.js";

function resolveWord(text, meaning, transcript) {
	return resolveMeaning({
		result: { text, source: "word", type: "word", meaning },
		transcript,
		clickedWord: text,
	});
}

test("uses short beginner meanings and sentence context", () => {
	assert.equal(
		resolveWord("great", "Lớn, to lớn, vĩ đại.", "Great. Thank you.")
			.displayMeaning,
		"tuyệt",
	);
	assert.equal(
		resolveWord(
			"please",
			"Làm vui lòng; thích; muốn.",
			"Hi. I'd like to check in, please.",
		).displayMeaning,
		"làm ơn",
	);
	assert.equal(
		resolveWord("room", "Buồng, phòng.", "Your room is 204.").displayMeaning,
		"phòng",
	);
	assert.equal(
		resolveWord("free", "Tự do; miễn phí.", "Is Wi-Fi free?")
			.displayMeaning,
		"miễn phí",
	);
	assert.equal(
		resolveWord(
			"reservation",
			"Sự hạn chế; sự đặt trước.",
			"I have a reservation.",
		).displayMeaning,
		"đặt phòng",
	);
});

test("keeps an exact phrase meaning as the highest priority", () => {
	const result = resolveMeaning({
		result: {
			text: "how many",
			source: "phrase",
			type: "phrase",
			meaning: "bao nhiêu",
		},
		transcript: "How many nights are you staying?",
		clickedWord: "how",
		matchedPhrase: "how many",
	});

	assert.equal(result.displayMeaning, "bao nhiêu");
});
