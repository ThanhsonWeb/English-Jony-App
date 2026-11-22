import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { validateDialogue } from "../../validate-dialogue.mjs";

const source = new URL("../../../app/[locale]/(main)/dialogue/_data/dialogues/everyday-plans/making-plans-after-work.json", import.meta.url);
const fixture = () => JSON.parse(fs.readFileSync(source, "utf8"));

function revisedFixture() {
	const data = fixture();
	const original = data.tasks;
	// Contextual questions retain their source line and audio metadata.
	const response = structuredClone(original[2]);
	response.question = "Your friend has to work late. What can you say?";
	response.options = ["Let's meet another day.", "I worked yesterday.", "The office is blue.", "Coffee is hot."];
	response.answer = response.options[0];
	const grammar = structuredClone(original[8]);
	grammar.question = "Mia ___ going to work late.";
	grammar.options = ["am", "is", "are", "be"];
	grammar.answer = "is";
	for (const task of [response, grammar]) {
		task.localized.question = { vi: task.question, en: task.question };
		task.localized.options = task.options.map((option) => ({ vi: option, en: option }));
	}
	const review = structuredClone(original.at(-1));
	review.lines = [review.lines[1], review.lines[5], review.lines[7]];
	review.lines.forEach((line, index) => { line.parts.find((part) => typeof part === "object").id = String(index + 1); });
	data.tasks = [original[0], original[7], response, grammar, review];
	data.tasks.forEach((task, index) => { task.id = index + 1; });
	return data;
}

test("A2 accepts contextual questions, more choices, and a shorter ordered review", () => {
	const result = validateDialogue(revisedFixture());
	assert.deepEqual(result.errors, []);
});

test("A2 listening gaps must reconstruct the associated audio transcript", () => {
	const data = revisedFixture();
	data.tasks[0].answers[0] = "tomorrow";
	assert.ok(validateDialogue(data).errors.some((error) => error.includes("reconstruct dialogue line")));
	data.tasks[0].answers[0] = "after work";
	data.tasks[0].audioUrl = data.dialogue[1].audioUrl;
	assert.ok(validateDialogue(data).errors.some((error) => error.includes("audioUrl must match")));
});

test("A2 review rejects reordered or altered source lines", () => {
	const data = revisedFixture();
	data.tasks.at(-1).lines.reverse();
	assert.ok(validateDialogue(data).errors.some((error) => error.includes("unique and in forward order")));
	const altered = revisedFixture();
	altered.tasks.at(-1).lines[0].parts[0] = "Different words ";
	assert.ok(validateDialogue(altered).errors.some((error) => error.includes("completed cloze must reconstruct")));
});

test("A1 retains its full review and fill-blank requirements", () => {
	const data = revisedFixture();
	data.metadata.level = "a1";
	const errors = validateDialogue(data).errors;
	assert.ok(errors.some((error) => error.includes("Fill Blank should be the main practice type")));
	assert.ok(errors.some((error) => error.includes("must include all")));
	assert.ok(errors.some((error) => error.includes("standalone Fill Blank tasks")));
	assert.ok(errors.some((error) => error.includes("forward order")));
});
