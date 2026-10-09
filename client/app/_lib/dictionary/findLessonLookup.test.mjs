import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import glossary from "./glossaries/restaurant/getting-a-table.json" with { type: "json" };
import draft from "../../[locale]/(main)/dialogue/_data/dialogues/restaurant/getting-a-table.json" with { type: "json" };
import { findContextualLookup, findLessonLookup } from "./findLessonLookup.js";
import { findPreferredLookup, SUBTITLE_WORD_PATTERN } from "./findPreferredLookup.js";
import { lookupWord } from "./lookupWord.js";
import { resolveMeaning } from "./resolveMeaning.js";
import { validateLessonGlossary } from "./validateLessonGlossary.js";

const tokens = text => [...text.matchAll(SUBTITLE_WORD_PATTERN)];
const pilot = (id, clickedWordIndex) => findLessonLookup({ lessonId: "restaurant", dialogueId: "getting-a-table",
	line: draft.dialogue.find(line => line.id === id), clickedWordIndex });

function production(line, clickedWordIndex) {
	const lookup = findPreferredLookup(line?.text || "", clickedWordIndex);
	return lookup ? { ...lookup, result: resolveMeaning({ result: lookup.result, transcript: line.text,
		clickedWord: lookup.result.text, clickedWordIndex, matchedPhrase: lookup.result.source === "phrase" ? lookup.result.text : "" }) } : null;
}

test("glossary maps all 12 source sentences, translations, speakers and 65 occurrences", () => {
	assert.deepEqual(validateLessonGlossary(glossary, draft), []);
	assert.equal(glossary.schemaVersion, 1);
	assert.equal(glossary.lessonId, draft.metadata.courseId);
	assert.equal(glossary.dialogueId, draft.metadata.dialogueId);
	assert.equal(Object.keys(glossary.lines).length, draft.dialogue.length);
	let occurrences = 0;
	for (const line of draft.dialogue) {
		const context = glossary.lines[line.id];
		assert.equal(context.text, line.text);
		assert.equal(context.translation, line.translation);
		assert.equal(context.speaker, line.speaker);
		const words = tokens(line.text);
		assert.equal(context.words.length, words.length, `Line ${line.id}: occurrence count`);
		for (const entryId of context.words) assert(glossary.entries[entryId]?.meaning.trim(), entryId);
		for (const phrase of context.phrases) {
			assert(phrase.start >= 0 && phrase.start < phrase.end && phrase.end < words.length);
			assert(glossary.entries[phrase.entry]?.meaning.trim(), phrase.entry);
		}
		occurrences += words.length;
	}
	assert.equal(occurrences, 65);
});

// Check the actual popup meaning and highlight range for every real click,
// including individual words whose UI click selects a whole expression.
const expected = {
	1: [[0, 1, "chào buổi tối"], [2, 3, "bao nhiêu"], [4, 4, "người"]],
	2: [[0, 0, "mạo từ không xác định"], [1, 3, "bàn cho hai người"], [4, 4, "vui lòng"]],
	3: [[0, 0, "trợ động từ"], [1, 1, "hai bạn"], [2, 4, "có đặt bàn trước"]],
	4: [[0, 0, "không"], [1, 1, "chúng tôi"], [2, 3, "chưa đặt bàn"]],
	5: [[0, 2, "không sao"], [3, 3, "chúng tôi"], [4, 4, "có sẵn"], [5, 5, "mạo từ không xác định"], [6, 6, "bàn ăn"], [7, 9, "gần cửa sổ"]],
	6: [[0, 0, "động từ be"], [1, 1, "chỗ đó"], [2, 2, "yên tĩnh"], [3, 5, "gần cửa sổ"]],
	7: [[0, 0, "có"], [1, 1, "chỗ đó"], [2, 2, "trợ động từ"], [3, 3, "đó"], [4, 4, "là"], [5, 5, "mạo từ không xác định"], [6, 6, "yên tĩnh"], [7, 7, "khu vực"]],
	8: [[0, 2, "nghe ổn đấy"]],
	9: [[0, 0, "chúng tôi"], [1, 2, "muốn"], [3, 3, "đó"], [4, 4, "bàn ăn"], [5, 5, "vui lòng"]],
	10: [[0, 0, "tuyệt"], [1, 1, "mạo từ xác định"], [2, 2, "bàn ăn"], [3, 3, "động từ nối"], [4, 4, "sẵn sàng"]],
	11: [[0, 1, "cảm ơn bạn"]],
	12: [[0, 2, "không có gì"], [3, 5, "chúc ngon miệng"]],
};

for (const line of draft.dialogue) {
	test(`pilot line ${line.id}: every clickable word returns its contextual meaning`, () => {
		for (const [index] of tokens(line.text).entries()) {
			const [start, end, meaning] = expected[line.id].find(([start, end]) => start <= index && index <= end);
			const actual = pilot(line.id, index);
			assert.equal(actual.result.contextual, true);
			assert.equal(actual.result.displayMeaning, meaning, `Word ${index} in ${line.text}`);
			assert.deepEqual([actual.startWordIndex, actual.endWordIndex], [start, end]);
			assert.equal(actual.result.source, start === end ? "word" : "phrase");
			assert.deepEqual(actual.result.alternativeMeanings, []);
			const word = actual.wordLookup || actual;
			assert.deepEqual([word.startWordIndex, word.endWordIndex], [index, index]);
			assert.equal(word.result.text, tokens(line.text)[index][0]);
			assert.equal(word.result.displayMeaning, glossary.entries[glossary.lines[line.id].words[index]].meaning);
			assert.equal(word.result.source, "word");
			assert.equal(word.result.note, undefined, "Notes are not popup meanings");
		}
	});
}

test("repeated words distinguish occurrences within a line and across speakers", () => {
	assert.notEqual(pilot(7, 2).result.displayMeaning, pilot(7, 4).result.displayMeaning, "Two occurrences of is in the same line");
	assert.notEqual(pilot(7, 1).result.displayMeaning, pilot(7, 3).result.displayMeaning, "Two occurrences of it in the same line");
	assert.equal(pilot(4, 1).result.displayMeaning, pilot(5, 3).result.displayMeaning, "We naturally means chúng tôi for either speaker");
	assert.notEqual(glossary.lines[4].words[1], glossary.lines[5].words[3], "Distinct referents remain in shared entry notes");
	assert.notEqual(pilot(5, 0).result.displayMeaning, pilot(9, 3).result.displayMeaning, "That: situation vs selected table");
	assert.notEqual(pilot(3, 0).result.displayMeaning, pilot(4, 2).result.displayMeaning, "Do: question vs short reply");
});

test("grammar words get short explanations instead of unrelated dictionary senses", () => {
	assert.equal(pilot(3, 0).result.displayMeaning, "trợ động từ");
	assert.equal(pilot(10, 1).result.displayMeaning, "mạo từ xác định");
	assert.equal(pilot(10, 3).result.displayMeaning, "động từ nối");
	assert(!pilot(4, 2).result.displayMeaning.includes("làm"));
});

test("punctuation is outside phrase highlights and cannot bridge expressions", () => {
	assert.equal(pilot(1, 0).result.text, "Good evening");
	assert.equal(pilot(1, 2).result.text, "How many");
	assert.equal(pilot(2, 3).result.text, "table for two");
	assert.equal(pilot(12, 0).result.text, "You are welcome");
	assert.equal(pilot(12, 3).result.text, "Enjoy your meal");
	const invalid = structuredClone(glossary);
	invalid.lines[1].phrases.unshift({ start: 0, end: 3, entry: "sounds-good" });
	assert.equal(findContextualLookup(invalid, draft.dialogue[0], 0).result.text, "Good evening");
	assert.equal(findContextualLookup(invalid, draft.dialogue[0], 2).result.text, "How many");
});

test("longest explicit phrase wins while missing phrase entries use word meanings", () => {
	const modified = structuredClone(glossary);
	modified.lines[8].phrases.push({ start: 1, end: 2, text: "sounds good", entry: "sounds-good" });
	assert.equal(findContextualLookup(modified, draft.dialogue[7], 1).result.text, "That sounds good");
	delete modified.entries["sounds-good"];
	assert.equal(findContextualLookup(modified, draft.dialogue[7], 0).result.displayMeaning, glossary.entries["that-suggestion"].meaning);
});

test("missing entries and stale line IDs, wording or speakers safely fall back", () => {
	const modified = structuredClone(glossary);
	delete modified.entries["is-area"];
	assert.equal(findContextualLookup(modified, draft.dialogue[6], 4), null);
	for (const line of [{ ...draft.dialogue[6], id: 999 }, { ...draft.dialogue[6], text: "This is a different sentence." },
		{ ...draft.dialogue[6], speaker: "Ben" }, { ...draft.dialogue[6], text: "Yes, it is! It is a quiet area." }]) {
		assert.equal(findContextualLookup(glossary, line, 0), null);
		assert.deepEqual(findLessonLookup({ lessonId: "restaurant", dialogueId: "getting-a-table", line, clickedWordIndex: 0 }), production(line, 0));
	}
	for (const clickedWordIndex of [-1, 100, 1.5, undefined]) assert.equal(findLessonLookup({ lessonId: "restaurant", dialogueId: "getting-a-table", line: draft.dialogue[0], clickedWordIndex }), null);
	assert.equal(findLessonLookup({ lessonId: "restaurant", dialogueId: "getting-a-table", line: undefined, clickedWordIndex: 0 }), null);
});

test("pronunciation uses existing word IPA and phrase IPA from the lesson", () => {
	assert.deepEqual(pilot(3, 4).wordLookup.result.pron,
		[draft.usefulWords.find(word => word.word === "reservation").pronunciation]);
	for (const [id, index] of [[5, 6], [6, 2], [10, 2], [10, 4], [7, 7]]) {
		const token = tokens(draft.dialogue[id - 1].text)[index][0];
		assert.deepEqual(pilot(id, index).result.pron, lookupWord(token)?.pron || []);
	}
	for (const [id, index] of [[2, 2], [5, 8], [8, 1], [9, 2], [12, 5]]) {
		const actual = pilot(id, index).result;
		const source = draft.usefulWords.find(word => word.word.toLowerCase() === actual.text.toLowerCase());
		assert(source);
		assert.deepEqual(actual.pron, [source.pronunciation]);
	}
	assert.deepEqual(pilot(3, 2).result.pron, [], "Do not invent a phrase IPA or reuse a single word's IPA");
});

test("characters are correctly identified and no spoken names are fabricated", () => {
	assert.deepEqual(Object.keys(glossary.characters).sort(), [...new Set(draft.dialogue.map(line => line.speaker))].sort());
	for (const [name, character] of Object.entries(glossary.characters)) {
		assert.match(character.note, /tên riêng/u);
		assert.equal(character.meaning, name);
		assert(!draft.dialogue.some(line => tokens(line.text).some(word => word[0] === name)));
	}
	assert.match(glossary.characters.Alex.role, /phục vụ/u);
});

test("word meanings remain distinct from expression meanings and explanations stay in notes", () => {
	assert.equal(pilot(2, 3).wordLookup.result.displayMeaning, "hai");
	assert.equal(pilot(2, 3).result.displayMeaning, "bàn cho hai người");
	assert.equal(pilot(9, 2).wordLookup.result.displayMeaning, "muốn");
	assert.equal(pilot(12, 3).wordLookup.result.displayMeaning, "thưởng thức");
	assert.equal(pilot(12, 3).result.displayMeaning, "chúc ngon miệng");
	for (const entry of Object.values(glossary.entries)) {
		assert(!/[();]/u.test(entry.meaning), entry.meaning);
		assert(entry.meaning.split(/\s+/u).length <= 6, entry.meaning); // Article label has six Vietnamese syllables.
		assert(entry.pos.length > 0);
	}
});

const validationCases = [
	["missing word", g => g.lines[7].words.pop(), /missing word mappings/u],
	["missing word reference", g => { g.lines[7].words[4] = "missing"; }, /missing entry/u],
	["missing phrase reference", g => { delete g.entries["would-like"]; }, /missing phrase entry/u],
	["swapped entry positions", g => { [g.lines[7].words[6], g.lines[7].words[7]] = [g.lines[7].words[7], g.lines[7].words[6]]; }, /incorrect entry position/u],
	["swapped token positions", g => { [g.lines[7].tokens[6], g.lines[7].tokens[7]] = [g.lines[7].tokens[7], g.lines[7].tokens[6]]; }, /incorrect token positions/u],
	["shifted phrase", g => { g.lines[9].phrases[0].start = 0; }, /broken phrase boundaries/u],
	["out of bounds phrase", g => { g.lines[9].phrases[0].end = 99; }, /broken phrase boundaries/u],
	["reversed phrase", g => { g.lines[9].phrases[0].end = 0; }, /broken phrase boundaries/u],
	["punctuation bridge", g => { g.lines[1].phrases[0] = { start: 0, end: 3, text: "Good evening. How many", entry: "good-evening" }; }, /broken phrase boundaries/u],
	["missing source line", g => { delete g.lines[7]; }, /missing mapping/u],
	["same-count English edit", (_g, s) => { s.dialogue[6].text = "Yes, it is. It is a noisy area."; }, /outdated text/u],
	["punctuation-only edit", (_g, s) => { s.dialogue[6].text = "Yes, it is! It is a quiet area."; }, /outdated text/u],
	["Vietnamese edit", (_g, s) => { s.dialogue[6].translation += "!"; }, /outdated translation/u],
];
for (const [name, mutate, expectedError] of validationCases) {
	test(`source validation rejects ${name}`, () => {
		const candidate = structuredClone(glossary), source = structuredClone(draft);
		mutate(candidate, source);
		assert(validateLessonGlossary(candidate, source).some(error => expectedError.test(error)));
	});
}

test("other dialogue and Story clicks preserve exact production results", () => {
	const root = new URL("../../[locale]/(main)/dialogue/_data/", import.meta.url);
	let clicks = 0;
	for (const file of fs.readdirSync(root, { recursive: true }).filter(file => file.endsWith(".json"))) {
		const data = JSON.parse(fs.readFileSync(new URL(file.replaceAll("\\", "/"), root), "utf8"));
		if ((data.metadata.courseId === "restaurant" && data.metadata.dialogueId === "getting-a-table")
			|| (data.metadata.courseId === "ten-minutes-a-day" && data.metadata.dialogueId === "the-old-book")) continue;
		for (const line of data.dialogue) for (const [clickedWordIndex] of tokens(line.text).entries()) {
			assert.deepEqual(findLessonLookup({ lessonId: data.metadata.courseId, dialogueId: data.metadata.dialogueId, line, clickedWordIndex }), production(line, clickedWordIndex), `${file}: ${clickedWordIndex}`);
			clicks++;
		}
	}
	assert.equal(clicks, 1957);
	assert.deepEqual(findLessonLookup({ lessonId: "another-course", dialogueId: "getting-a-table", line: draft.dialogue[0], clickedWordIndex: 0 }), production(draft.dialogue[0], 0));
});
