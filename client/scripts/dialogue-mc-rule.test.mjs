import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { validateDialogue } from "./validate-dialogue.mjs";
import { buildDialoguePrompt } from "./prompts/dialogue-generator.mjs";
import coffeeShop from "./config/courses/coffee-shop.mjs";

const sourcePath = new URL(
	"../app/[locale]/(main)/dialogue/_data/dialogues/coffee-shop/ordering-a-coffee.json",
	import.meta.url,
);

function fixture() {
	return JSON.parse(fs.readFileSync(sourcePath, "utf8"));
}

function multipleChoiceTasks(dialogue) {
	return dialogue.tasks.filter((task) => task.type === "multipleChoice");
}

function renumber(tasks) {
	tasks.forEach((task, index) => {
		task.id = index + 1;
	});
}

test("generator prompt keeps MC separate from Fill Blank and translation", () => {
	const prompt = buildDialoguePrompt({
		...coffeeShop,
		...coffeeShop.dialogues[0],
	});

	for (const expectedRule of [
		"Multiple Choice is a separate understanding check",
		"situation comprehension",
		"speaker intent",
		"sequence, decisions, and reactions",
		"Usually use 0-2 grammar-in-context questions",
		"must test something different from every Fill Blank task",
		"Include exactly four options",
		"distribute correct-answer positions roughly across A, B, C, and D",
		"Avoid an obvious fixed pattern",
	]) {
		assert.ok(prompt.includes(expectedRule), `Missing prompt rule: ${expectedRule}`);
	}
});

test("reports Coffee Shop MC totals and answer positions", () => {
	const result = validateDialogue(fixture());

	assert.equal(result.valid, true);
	assert.equal(result.report.total, 5);
	assert.equal(result.report.translationOnly, 0);
	assert.deepEqual(result.report.answerPositionDistribution, {
		A: 2,
		B: 1,
		C: 1,
		D: 1,
	});
	assert.equal(result.report.validationResult, "passed");
});

test("requires exactly four unique MC options and one matching answer", () => {
	const missingOption = fixture();
	multipleChoiceTasks(missingOption)[0].options.pop();
	let result = validateDialogue(missingOption);
	assert.ok(result.errors.some((error) => error.includes("exactly 4 options")));

	const duplicateOption = fixture();
	const duplicateTask = multipleChoiceTasks(duplicateOption)[0];
	duplicateTask.options[1] = duplicateTask.options[0];
	result = validateDialogue(duplicateOption);
	assert.ok(result.errors.some((error) => error.includes("non-empty and unique")));

	const missingAnswer = fixture();
	multipleChoiceTasks(missingAnswer)[0].answer = "Không có trong lựa chọn.";
	result = validateDialogue(missingAnswer);
	assert.ok(
		result.errors.some((error) =>
			error.includes("answer must appear exactly once"),
		),
	);
});

test("rejects translation-only MC questions and reports them", () => {
	const dialogue = fixture();
	const task = multipleChoiceTasks(dialogue)[0];
	const sourceLine = dialogue.dialogue.find(
		(line) => line.id === task.dialogueLineId,
	);

	task.question = "Câu tiếng Anh này có nghĩa là gì?";
	task.options[0] = sourceLine.translation;
	task.answer = sourceLine.translation;

	const result = validateDialogue(dialogue);
	assert.equal(result.valid, false);
	assert.equal(result.report.translationOnly, 1);
	assert.ok(result.errors.some((error) => error.includes("must not simply ask")));
});

test("rejects a clearly overused correct-answer position", () => {
	const dialogue = fixture();

	for (const task of multipleChoiceTasks(dialogue)) {
		const answerIndex = task.options.indexOf(task.answer);
		const [answer] = task.options.splice(answerIndex, 1);
		task.options.unshift(answer);
	}

	const result = validateDialogue(dialogue);
	assert.equal(result.valid, false);
	assert.ok(
		result.errors.some((error) =>
			error.includes("correct-answer positions are too concentrated"),
		),
	);
});

test("warns when an MC answer duplicates a same-line Fill Blank target", () => {
	const dialogue = fixture();
	const task = multipleChoiceTasks(dialogue)[0];
	task.options[0] = "coffee";
	task.answer = "coffee";

	const result = validateDialogue(dialogue);
	assert.equal(result.valid, true);
	assert.ok(
		result.warnings.some((warning) =>
			warning.includes("duplicates a Fill Blank target"),
		),
	);
});

test("warns about similar MC questions on the same dialogue line", () => {
	const dialogue = fixture();
	const originalIndex = dialogue.tasks.findIndex(
		(task) => task.type === "multipleChoice",
	);
	const repeatedTask = structuredClone(dialogue.tasks[originalIndex]);
	repeatedTask.question = "Emma hỏi câu này để biết điều gì?";
	dialogue.tasks.splice(originalIndex + 1, 0, repeatedTask);
	renumber(dialogue.tasks);

	const result = validateDialogue(dialogue);
	assert.equal(result.valid, true);
	assert.ok(
		result.warnings.some((warning) => warning.includes("may test the same thing")),
	);
});

test("counts detectable grammar-in-context MC questions", () => {
	const dialogue = fixture();
	multipleChoiceTasks(dialogue)[0].question =
		"Vì sao dùng cách nói lịch sự trong tình huống này?";

	const result = validateDialogue(dialogue);
	assert.equal(result.report.grammarInContext, 1);
});
