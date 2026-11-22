import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../../../app/_components/DialogueClozeReviewTask.jsx", import.meta.url), "utf8");

test("cloze retains all-answer grading and its completion destination", () => {
	assert.match(source, /manual: true/);
	assert.match(source, /if \(autoAdvance\.isSubmitted\(\)\) return/);
	assert.match(source, /normalizeAnswer\(answers\[index\]\) === normalizeAnswer\(expected\)/);
	assert.match(source, /if \(allCorrect\) \{\s*autoAdvance\.complete\(\{ answers \}\)/);
	assert.match(source, /href: nextTask \?[^\n]+completionHref \|\|/);
	assert.match(source, /blankResults\.includes\("wrong"\)[\s\S]*?t\("clozeWrong"\)/);
});

test("success is visible and Continue uses the guarded action and Enter shortcut", () => {
	assert.match(source, /onEnter: \(\) => actionRef\.current\?\.click\(\)/);
	assert.match(source, /isComplete \|\| blankResults\.includes\("wrong"\)[\s\S]*?role="status" aria-live="polite"[\s\S]*?isComplete && <p[^>]*>\{t\("clozeCorrect"\)\}/);
	assert.match(source, /isComplete \? \([\s\S]*?ref=\{actionRef\}[\s\S]*?onClick=\{\(\) => autoAdvance\.continue\(\)\}[\s\S]*?disabled=\{!autoAdvance\.canContinue\}[\s\S]*?t\("continue"\)/);
	for (const locale of ["en", "vi"]) {
		const messages = JSON.parse(readFileSync(new URL(`../../../messages/${locale}.json`, import.meta.url), "utf8")).DialogueFeature;
		assert.ok(messages.clozeCorrect && messages.continue);
	}
});
