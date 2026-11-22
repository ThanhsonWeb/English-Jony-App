import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { buildDialoguePrompt } from "../../prompts/dialogue-generator.mjs";
import coffeeShop from "../../config/dialogues/coffee-shop.mjs";
import everydayPlans from "../../config/dialogues/everyday-plans.mjs";

test("A1 prompt remains byte-for-byte unchanged", () => {
	const prompt = buildDialoguePrompt({ ...coffeeShop, ...coffeeShop.dialogues[0] });
	assert.equal(createHash("sha256").update(prompt).digest("hex"), "a5e39f465c8a6bce6476896bee5822e98848fac23939d57565592605b1fd788a");
});

test("A2 prompt requests purposeful varied practice without per-line quotas", () => {
	const prompt = buildDialoguePrompt({ ...everydayPlans, ...everydayPlans.dialogues[0] });
	for (const text of ["purposeful learning sequence", "distinct learning purpose", "without requiring a Fill Blank for every dialogue line", "tasks may return to earlier dialogue lines", "only fillBlank, multipleChoice, and the final dialogueCloze", "reconstruct the original transcript exactly"]) assert.ok(prompt.includes(text), text);
	for (const text of ["A simple line must receive exactly 1 Fill Blank task", "Once practice moves to a later dialogueLineId", "Fill Blank is the main task type", "usually include around 4–6 meaningful Multiple Choice", "Usually use 0-2 grammar-in-context"]) assert.ok(!prompt.includes(text), text);
});

test("A2 multiple choice requires contextual choices and bilingual explanations", () => {
	const prompt = buildDialoguePrompt({ ...everydayPlans, ...everydayPlans.dialogues[0] });
	for (const text of ["meaningful context and a clear goal", "exactly one clearly correct answer and three plausible, natural distractors", "clearly unsuitable for the stated context and goal", "helpful explanation of why the answer fits in both Vietnamese and English", '"localized.explanation.vi"', '"localized.explanation.en"', "It must review the entire dialogue.", "Include every dialogue line in the original order."]) assert.ok(prompt.includes(text), text);
});
