import assert from "node:assert/strict";
import test from "node:test";

import { lookupWord } from "./lookupWord.js";
import { resolveMeaning } from "./resolveMeaning.js";

function resolveWord(text, primaryMeaning, transcript = "", meanings = []) {
	return resolveMeaning({
		result: { text, source: "word", primaryMeaning, meanings, pos: ["n"], pron: ["/test/"] },
		transcript,
		clickedWord: text,
	});
}

test("uses the v3 primary meaning and exposes alternatives", () => {
	const result = resolveWord("break", "vỡ; gãy; đập vỡ", "The glass can break.", ["giờ giải lao"]);
	assert.equal(result.displayMeaning, "vỡ; gãy; đập vỡ");
	assert.deepEqual(result.alternativeMeanings, ["giờ giải lao"]);
	assert.deepEqual(result.pos, ["n"]);
	assert.deepEqual(result.pron, ["/test/"]);
	assert.deepEqual(resolveWord("team", "đội, nhóm").alternativeMeanings, []);
});

test("keeps an exact phrase meaning as the highest priority", () => {
	const result = resolveMeaning({
		result: { text: "how many", source: "phrase", type: "phrase", meaning: "bao nhiêu" },
		transcript: "How many nights are you staying?",
		clickedWord: "how",
		matchedPhrase: "how many",
	});
	assert.equal(result.displayMeaning, "bao nhiêu");
	assert.deepEqual(result.alternativeMeanings, []);
});

test("contextual meanings take priority over the v3 primary meaning", () => {
	assert.equal(resolveWord("at", "ở / tại", "Breakfast starts at seven.").displayMeaning, "lúc");
	assert.equal(resolveWord("on", "trên", "The meeting is on Monday.").displayMeaning, "vào");
	assert.equal(resolveWord("for", "cho", "We are staying for three nights.").displayMeaning, "trong");
	assert.equal(resolveWord("to", "đến", "I want to learn.").displayMeaning, "để");
	assert.equal(resolveWord("free", "tự do", "Is Wi-Fi free?").displayMeaning, "miễn phí");
	assert.equal(resolveWord("for", "cho", "A gift for you.").displayMeaning, "cho");
});

test("runtime lookup uses v3 words, preserves phrases and keeps lemma metadata", () => {
	const phrase = lookupWord("Check in!");
	assert.equal(phrase.source, "phrase");
	assert.equal(resolveMeaning({ result: phrase }).displayMeaning, phrase.meaning);
	const making = lookupWord("Making");
	assert.equal(making.lemma, "make");
	assert.deepEqual(making.pos, ["n"]);
	assert.deepEqual(making.pron, ["/ˈmeɪkɪŋ/"]);
	for (const word of "break bring feeling team making planning thanks helping nice".split(" ")) {
		const result = lookupWord(word);
		assert.equal(result?.source, "word", word);
		assert.equal(resolveMeaning({ result, clickedWord: word }).displayMeaning, result.primaryMeaning, word);
	}
	for (const word of "this that these those alright".split(" ")) assert.equal(lookupWord(word), null, word);
});
