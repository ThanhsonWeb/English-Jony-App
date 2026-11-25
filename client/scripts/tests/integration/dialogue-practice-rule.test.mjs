import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { validateDialogue } from "../../validate-dialogue.mjs";

const sourcePath = new URL(
	"../../../app/[locale]/(main)/dialogue/_data/dialogues/coffee-shop/ordering-a-coffee.json",
	import.meta.url,
);

function fixture() {
	return JSON.parse(fs.readFileSync(sourcePath, "utf8"));
}

function renumber(tasks) {
	tasks.forEach((task, index) => {
		task.id = index + 1;
	});
}

test("counts standalone Fill Blanks and ignores MC and Dialogue Cloze", () => {
	const dialogue = fixture();
	dialogue.tasks = dialogue.tasks.filter(
		(task) =>
			!(
				task.dialogueLineId === 2 &&
				task.type === "fillBlank" &&
				task.answers.includes("What kind of")
			),
	);
	renumber(dialogue.tasks);
	const result = validateDialogue(dialogue);
	assert.equal(result.valid, false);
	assert.ok(
		result.errors.some(
			(error) => error.includes("line 2") && error.includes("found 1"),
		),
	);
});

test("rejects overlapping targets across same-line Fill Blanks", () => {
	const dialogue = fixture();
	const lineTwoFillBlanks = dialogue.tasks.filter(
		(task) => task.dialogueLineId === 2 && task.type === "fillBlank",
	);
	lineTwoFillBlanks[1].parts = [...lineTwoFillBlanks[0].parts];
	lineTwoFillBlanks[1].answers = [...lineTwoFillBlanks[0].answers];
	const result = validateDialogue(dialogue);
	assert.equal(result.valid, false);
	assert.ok(result.errors.some((error) => error.includes("overlaps a target")));
});

test("allows a third distinct Fill Blank only for very important lines", () => {
	const dialogue = fixture();
	const firstLineTwoTask = dialogue.tasks.findIndex(
		(task) => task.dialogueLineId === 2,
	);
	const insertAt = dialogue.tasks.findIndex(
		(task, index) => index > firstLineTwoTask && task.dialogueLineId !== 2,
	);
	const line = dialogue.dialogue[1];
	dialogue.tasks.splice(insertAt, 0, {
		id: 0,
		dialogueLineId: 2,
		type: "fillBlank",
		parts: ["What kind of coffee ", "?"],
		answers: ["do you like"],
		speaker: line.speaker,
		transcript: line.text,
		scene: line.scene,
		audioUrl: line.audioUrl,
	});
	renumber(dialogue.tasks);
	assert.equal(validateDialogue(dialogue).valid, true);
	dialogue.dialogue[1].practicePriority = "important";
	const result = validateDialogue(dialogue);
	assert.ok(
		result.errors.some(
			(error) => error.includes("expected 2-2") && error.includes("found 3"),
		),
	);
});

test("cloze covers missing standalone fill blanks only when explicitly enabled and valid", () => {
	const file = new URL("../../../generated/dialogues/asking-for-directions-v2/finding-the-bus-stop/draft.json", import.meta.url);
	const dialogue = JSON.parse(fs.readFileSync(file, "utf8"));
	const coverageErrors = result => result.errors.filter(error => error.includes("standalone Fill Blank"));
	assert.equal(coverageErrors(validateDialogue(dialogue)).length, 4);
	assert.equal(coverageErrors(validateDialogue(dialogue, { clozeCoversMissingFillBlank: true })).length, 0);
	const otherCourse = structuredClone(dialogue);
	otherCourse.metadata.courseId = "another-course";
	assert.equal(coverageErrors(validateDialogue(otherCourse)).length, 4);
	assert.equal(coverageErrors(validateDialogue(otherCourse, { clozeCoversMissingFillBlank: true })).length, 0);
	const invalidCloze = structuredClone(dialogue);
	invalidCloze.tasks.at(-1).lines[0].speaker = "Invalid";
	assert.equal(coverageErrors(validateDialogue(invalidCloze, { clozeCoversMissingFillBlank: true })).length, 4);
});
