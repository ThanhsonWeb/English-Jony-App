import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../../../app/_components/FillBlankTask.jsx", import.meta.url), "utf8");
const messages = ["en", "vi"].map((locale) => JSON.parse(readFileSync(new URL(`../../../messages/${locale}.json`, import.meta.url), "utf8")).DialogueFeature);

test("FillBlank opts into manual continuation while preserving grading and submission", () => {
	assert.match(source, /useDialogueAutoAdvance\(\{[\s\S]*?manual: true/);
	assert.match(source, /fillBlankAnswersMatch\(answerValues\[index\] \|\| "", expectedAnswer\)/);
	assert.match(source, /if \(isCorrect\) autoAdvance\.complete\(\{ answers: answerValues \}\)/);
	assert.match(source, /if \(autoAdvance\.isSubmitted\(\) \|\| review\) return/);
});

test("correct feedback and Continue are visible, localized, and guarded", () => {
	assert.match(source, /<div role="status" aria-live="polite">[\s\S]*?result === "correct"[\s\S]*?t\("correct"\)/);
	assert.match(source, /result === "correct" \? \([\s\S]*?onClick=\{\(\) => autoAdvance\.continue\(\)\}[\s\S]*?disabled=\{!autoAdvance\.canContinue\}[\s\S]*?t\("continue"\)/);
	assert.match(source, /\{\(result \|\| review\) && <GrammarNote grammar=\{task\.grammar\} \/>\}/);
	assert.match(source, /result === "wrong"[\s\S]*?t\("wrongTryAgain"\)/);
	for (const locale of messages) {
		assert.ok(locale.correct);
		assert.ok(locale.continue);
	}
});
