import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../../../app/_components/MultipleChoiceTask.jsx", import.meta.url), "utf8");

test("multiple choice keeps grading and submits the selected option once", () => {
	assert.match(source, /manual: true/);
	assert.match(source, /if \(autoAdvance\.isSubmitted\(\) \|\| review\) return/);
	assert.match(source, /selected === task\.answer/);
	assert.match(source, /autoAdvance\.complete\(\{ optionIndex: task\.options\.indexOf\(selected\) \}\)/);
});

test("wrong answer shows the selected option feedback without the explanation", () => {
	const wrongStart = source.indexOf('{result === "wrong" && (');
	const correctStart = source.indexOf('<div role="status"', wrongStart);
	assert.ok(wrongStart >= 0 && correctStart > wrongStart);
	const wrongFeedback = source.slice(wrongStart, correctStart);
	assert.match(source, /const selectedIndex = task\.options\.indexOf\(selected\)/);
	assert.match(source, /task\.localized\?\.optionFeedback\?\.\[selectedIndex\]\?\.\[locale\]/);
	assert.match(wrongFeedback, /t\("wrongTryAgain"\)/);
	assert.match(wrongFeedback, /optionFeedback &&/);
	assert.doesNotMatch(wrongFeedback, /task\.explanation|task\.answer/);
});

test("correct or reviewed answer does not render the explanation", () => {
	const correctStart = source.indexOf('<div role="status"');
	const correctEnd = source.indexOf('<DialogueShortcutHint', correctStart);
	assert.ok(correctStart >= 0 && correctEnd > correctStart);
	const correctFeedback = source.slice(correctStart, correctEnd);
	assert.match(correctFeedback, /result === "correct" \|\| review/);
	assert.doesNotMatch(correctFeedback, /task\.explanation/);
});

test("success feedback and continuation remain guarded and keyboard accessible", () => {
	assert.match(source, /onEnter: \(\) => actionRef\.current\?\.click\(\)/);
	assert.match(source, /role="status" aria-live="polite"[\s\S]*?result === "correct" \|\| review[\s\S]*?t\(review \? "completedCorrectOption" : "correct"\)/);
	assert.match(source, /result === "correct" \? \([\s\S]*?ref=\{actionRef\}[\s\S]*?onClick=\{\(\) => autoAdvance\.continue\(\)\}[\s\S]*?disabled=\{!autoAdvance\.canContinue\}[\s\S]*?t\("continue"\)/);
	for (const locale of ["en", "vi"]) {
		const messages = JSON.parse(readFileSync(new URL(`../../../messages/${locale}.json`, import.meta.url), "utf8")).DialogueFeature;
		assert.ok(messages.correct && messages.continue);
	}
});
