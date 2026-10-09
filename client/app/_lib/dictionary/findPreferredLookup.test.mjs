import assert from "node:assert/strict";
import test from "node:test";

import { findPreferredLookup } from "./findPreferredLookup.js";
import { resolveMeaning } from "./resolveMeaning.js";

function meaning(sentence, clickedWordIndex) {
	const lookup = findPreferredLookup(sentence, clickedWordIndex);
	assert.ok(lookup, `No lookup for word ${clickedWordIndex} in: ${sentence}`);
	return {
		...lookup,
		resolved: resolveMeaning({
			result: lookup.result,
			transcript: sentence,
			clickedWord: lookup.result.text,
			clickedWordIndex,
		}),
	};
}

test("directions greeting selects the whole expression and a natural Vietnamese meaning", () => {
	for (const index of [0, 1]) {
		const lookup = meaning("Excuse me. Where is the nearest bus stop?", index);
		assert.equal(lookup.result.source, "phrase");
		assert.equal(lookup.result.text, "Excuse me");
		assert.equal(lookup.resolved.displayMeaning, "cho tôi hỏi");
		assert.deepEqual([lookup.startWordIndex, lookup.endWordIndex], [0, 1]);
	}
	assert.equal(meaning("Excuse me. I think this is the wrong drink.", 0).resolved.displayMeaning, "xin lỗi");
});

test("common expressions win over their separate words", () => {
	for (const [sentence, index, expected] of [
		["You're welcome. Enjoy your stay.", 1, "không có gì"],
		["How are you?", 1, "bạn khỏe không?"],
		["I see.", 1, "tôi hiểu rồi"],
		["Can I help you?", 2, "tôi có thể giúp gì cho bạn?"],
		["How can I help you?", 3, "tôi có thể giúp gì cho bạn?"],
		["That's right. Thank you.", 1, "đúng vậy"],
		["Turn right at the corner.", 1, "rẽ phải"],
		["Take a break.", 1, "nghỉ một chút"],
		["Take the bus.", 1, "đi xe buýt"],
		["I'd like to book a room.", 3, "đặt phòng"],
	]) {
		assert.equal(meaning(sentence, index).resolved.displayMeaning, expected, sentence);
	}
});

test("clause expressions do not swallow a longer sentence or cross punctuation", () => {
	assert.equal(meaning("I see the bus.", 1).result.source, "word");
	assert.equal(meaning("I see the bus.", 1).resolved.displayMeaning, "thấy; nhìn thấy");
	assert.equal(meaning("How are you feeling today?", 1).result.source, "word");
	assert.equal(meaning("You're welcome to join us.", 1).result.source, "word");
	assert.equal(meaning("You're welcome to join us.", 1).resolved.displayMeaning, "được chào đón");
	assert.equal(meaning("I see. How are you?", 1).result.text, "I see");
	assert.equal(meaning("See. I see the bus.", 0).result.source, "word");
});

test("word senses use the clicked word and nearby words", () => {
	for (const [sentence, index, expected] of [
		["The answer is right.", 3, "đúng"],
		["Come right now.", 1, "ngay"],
		["How do I get to the bus stop?", 3, "đến"],
		["I'm taking the bus.", 1, "đi bằng"],
		["I would like tea.", 2, "muốn"],
		["I like tea.", 1, "thích"],
		["What does this word mean?", 4, "có nghĩa là"],
		["I mean to help.", 1, "định"],
		["Please book a ticket.", 1, "đặt trước"],
		["This book is new.", 1, "sách; quyển sách"],
	]) {
		assert.equal(meaning(sentence, index).resolved.displayMeaning, expected, sentence);
	}
});

test("capitalization, curly apostrophes, punctuation and existing entries still work", () => {
	assert.equal(meaning("YOU’RE WELCOME!", 1).resolved.displayMeaning, "không có gì");
	assert.equal(meaning("Check in!", 0).resolved.displayMeaning, "làm thủ tục nhận phòng");
	assert.equal(meaning("Making a list.", 0).result.lemma, "make");
	assert.equal(meaning("I'm taking the bus.", 1).result.lemma, "take");
	assert.equal(meaning("This book is new.", 1).result.pron[0], "/bʊk/");
});
