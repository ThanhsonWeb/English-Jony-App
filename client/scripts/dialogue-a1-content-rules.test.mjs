import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { buildDialoguePrompt } from "./prompts/dialogue-generator.mjs";
import coffeeShop from "./config/dialogues/coffee-shop.mjs";
import { validateDialogue } from "./validate-dialogue.mjs";

const sourcePath = new URL(
	"../app/[locale]/(main)/dialogue/_data/dialogues/coffee-shop/ordering-a-coffee.json",
	import.meta.url,
);

function fixture() {
	const dialogue = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
	dialogue.metadata.a1ContentRulesVersion = 2;
	dialogue.metadata.teachesContractions = ["I'll"];

	// Keep the source dialogue unchanged while converting legacy long targets
	// into short targets plus visible text in the following part.
	for (const task of dialogue.tasks.filter((item) => item.type === "fillBlank")) {
		task.answers.forEach((answer, index) => {
			const words = [...answer.matchAll(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu)];
			if (words.length <= 2) return;
			const cut = words[1].index + words[1][0].length;
			const visibleRemainder = answer.slice(cut);
			task.answers[index] = answer.slice(0, cut);
			task.parts[index + 1] = visibleRemainder + task.parts[index + 1];
		});
	}

	const multipleChoiceTasks = dialogue.tasks.filter(
		(item) => item.type === "multipleChoice",
	);
	const categories = [
		"comprehension",
		"comprehension",
		"comprehension",
		"grammar",
		"usage",
	];
	multipleChoiceTasks.forEach((task, index) => {
		task.mcCategory = categories[index] || "comprehension";
		if (task.mcCategory === "grammar" || task.mcCategory === "usage") {
			const sourceLine = dialogue.dialogue.find(
				(line) => line.id === task.dialogueLineId,
			);
			task.mcTarget = sourceLine.text.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/u)?.[0];
		}
	});

	return dialogue;
}

test("A1 generation prompt defines short blanks, MC variety, and contractions", () => {
	const prompt = buildDialoguePrompt({
		...coffeeShop,
		...coffeeShop.dialogues[0],
	});

	for (const rule of [
		"at most 2 words total",
		"Never hide 3 or more consecutive words",
		"Prefer a one-word answer most of the time",
		"50–60% comprehension and 40–50% grammar plus usage",
		'"mcCategory"',
		'"mcTarget"',
		"I'm, you're, he's, she's, it's, don't, can't, isn't, aren't",
		"I'll, we'll, I'd, you'd, I've, we've",
		'"a1ContentRulesVersion": 2',
	]) {
		assert.ok(prompt.includes(rule), `Missing A1 prompt rule: ${rule}`);
	}
});

test("strict A1 fixture validates with short blanks and a balanced MC mix", () => {
	const result = validateDialogue(fixture());
	assert.equal(result.valid, true, result.errors.join("\n"));
	assert.deepEqual(result.report.categoryDistribution, {
		comprehension: 3,
		grammar: 1,
		usage: 1,
	});
});

test("strict A1 validator rejects an answer longer than two words", () => {
	const dialogue = fixture();
	const task = dialogue.tasks.find(
		(item) => item.type === "fillBlank" && item.dialogueLineId === 2 && item.answers[0] === "What kind",
	);
	task.answers[0] = "What kind of";
	task.parts[1] = " coffee do you like?";

	const result = validateDialogue(dialogue);
	assert.ok(
		result.errors.some((error) => error.includes("at most 2 words") && error.includes("What kind of")),
	);
});

test("strict A1 validator rejects three consecutive words hidden across blanks", () => {
	const dialogue = fixture();
	const task = dialogue.tasks.find(
		(item) => item.type === "fillBlank" && item.dialogueLineId === 2 && item.answers[0] === "What kind",
	);
	task.answers = ["What", "kind of"];
	task.parts = ["", " ", " of coffee do you like?"];

	const result = validateDialogue(dialogue);
	assert.ok(
		result.errors.some((error) => error.includes("3 or more consecutive words")),
	);
});

test("strict A1 validator enforces MC proportions and source-linked targets", () => {
	const imbalanced = fixture();
	const mcTasks = imbalanced.tasks.filter((item) => item.type === "multipleChoice");
	mcTasks.forEach((task, index) => {
		task.mcCategory = index < 4 ? "comprehension" : "grammar";
	});
	let result = validateDialogue(imbalanced);
	assert.ok(result.errors.some((error) => error.includes("50-60% comprehension")));

	const unrelatedTarget = fixture();
	const grammarTask = unrelatedTarget.tasks.find(
		(item) => item.type === "multipleChoice" && item.mcCategory === "grammar",
	);
	grammarTask.mcTarget = "unrelated textbook phrase";
	result = validateDialogue(unrelatedTarget);
	assert.ok(result.errors.some((error) => error.includes("must appear in dialogue line")));
});

test("strict A1 validator requires harder contractions to be taught", () => {
	const dialogue = fixture();
	dialogue.metadata.teachesContractions = [];
	const result = validateDialogue(dialogue);
	assert.ok(
		result.errors.some((error) => error.includes('harder A1 contraction "I\'ll"')),
	);
});
