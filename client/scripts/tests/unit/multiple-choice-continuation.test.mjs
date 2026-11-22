import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../../../app/_components/MultipleChoiceTask.jsx", import.meta.url), "utf8");

test("multiple choice keeps grading and submits the selected option once", () => {
	assert.match(source, /manual: true/);
	assert.match(source, /if \(autoAdvance\.isSubmitted\(\) \|\| review\) return/);
	assert.match(source, /selected === task\.answer/);
	assert.match(source, /autoAdvance\.complete\(\{ optionIndex: task\.options\.indexOf\(selected\) \}\)/);
	assert.match(source, /result === "wrong"[\s\S]*?t\("listenAndTryAgain"\)[\s\S]*?task\.explanation/);
});

test("success feedback includes explanation and guarded keyboard-accessible continuation", () => {
	assert.match(source, /onEnter: \(\) => actionRef\.current\?\.click\(\)/);
	assert.match(source, /role="status" aria-live="polite"[\s\S]*?result === "correct" \|\| review[\s\S]*?t\(review \? "completedCorrectOption" : "correct"\)[\s\S]*?task\.explanation/);
	assert.match(source, /result === "correct" \? \([\s\S]*?ref=\{actionRef\}[\s\S]*?onClick=\{\(\) => autoAdvance\.continue\(\)\}[\s\S]*?disabled=\{!autoAdvance\.canContinue\}[\s\S]*?t\("continue"\)/);
	for (const locale of ["en", "vi"]) {
		const messages = JSON.parse(readFileSync(new URL(`../../../messages/${locale}.json`, import.meta.url), "utf8")).DialogueFeature;
		assert.ok(messages.correct && messages.continue);
	}
});
