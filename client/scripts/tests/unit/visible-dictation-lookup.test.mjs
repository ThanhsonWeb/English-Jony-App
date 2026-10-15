import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { findVisibleDictationLookup } from "../../../app/_lib/dictionary/findVisibleDictationLookup.js";
import { findLessonLookup } from "../../../app/_lib/dictionary/findLessonLookup.js";

const story = JSON.parse(fs.readFileSync(new URL("../../../app/[locale]/(main)/dialogue/_data/stories/naruto-season-1/the-lonely-boy.json", import.meta.url)));
const task = story.tasks.find((item) => item.type === "fillBlank" && item.answers?.includes("alone"));
const line = story.dialogue.find((item) => item.id === task.dialogueLineId);

test("visible Dictation word uses the same contextual glossary as Listening", () => {
	const args = { lessonId: "naruto-season-1", dialogueId: "the-lonely-boy", line };
	const listening = findLessonLookup({ ...args, clickedWordIndex: 2 });
	const dictation = findVisibleDictationLookup({ ...args, parts: task.parts, answers: task.answers, partIndex: 0, clickedWordIndex: 2 });
	assert.equal(dictation.result.displayMeaning, listening.result.displayMeaning);
	assert.equal(dictation.result.contextual, true);
	assert.equal(task.parts.join("").includes("alone"), false);
});

test("phrases work inside visible text but cannot cross a hidden answer", () => {
	const args = { lessonId: "missing", dialogueId: "missing", line: { text: "excuse me" } };
	const phrase = findVisibleDictationLookup({ ...args, parts: ["excuse me", ""], answers: [""], partIndex: 0, clickedWordIndex: 0 });
	assert.equal(phrase.result.text.toLowerCase(), "excuse me");
	const split = findVisibleDictationLookup({ ...args, parts: ["excuse ", ""], answers: ["me"], partIndex: 0, clickedWordIndex: 0 });
	assert.equal(split.result.text.toLowerCase(), "excuse");
	assert.equal(split.endWordIndex, 0);
});

test("a word after the blank maps to its own visible segment", () => {
	const result = findVisibleDictationLookup({
		lessonId: "naruto-season-1", dialogueId: "the-lonely-boy", line,
		parts: ["Naruto, why are you here ", "?"], answers: ["alone"], partIndex: 1, clickedWordIndex: 0,
	});
	assert.equal(result, null);
	const fallback = findVisibleDictationLookup({
		lessonId: "missing", dialogueId: "missing", line: { text: "I like school" },
		parts: ["I ", " school"], answers: ["like"], partIndex: 1, clickedWordIndex: 0,
	});
	assert.equal(fallback.result.text.toLowerCase(), "school");
	assert.equal(fallback.startWordIndex, 0);
});
