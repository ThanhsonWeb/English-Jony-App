import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { validateDialogue } from "./validate-dialogue.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const builderSource = readFileSync(
	path.join(scriptDirectory, "../app/[locale]/(main)/dialogue/_data/helpers/buildDialogue.js"),
	"utf8",
);
const { buildGeneratedDialogue } = await import(
	`data:text/javascript;base64,${Buffer.from(builderSource).toString("base64")}`
);

for (const dialogueId of ["getting-a-table", "reading-the-menu"]) {
	test(`${dialogueId} reports MC categories and preserves them in the UI builder`, () => {
		const draftPath = path.join(
		scriptDirectory,
		"../generated/dialogues/restaurant",
		dialogueId,
		"draft.json",
		);
		const draft = JSON.parse(readFileSync(draftPath, "utf8"));
		const result = validateDialogue(draft);
		assert.equal(result.valid, true, result.errors.join("\n"));
		assert.deepEqual(result.report.categoryDistribution, {
			comprehension: 3,
			grammar: 1,
			usage: 1,
		});
		assert.equal(result.report.translationOnly, 0);

		const output = execFileSync(
			process.execPath,
			[path.join(scriptDirectory, "validate-dialogue.mjs"), draftPath],
			{ encoding: "utf8" },
		);
		for (const line of [
			"- Total MC count: 5",
			"- Comprehension: 3",
			"- Grammar: 1",
			"- Usage: 1",
			"- Translation-only MC count: 0",
		]) {
			assert.ok(output.includes(line), `Missing report line: ${line}`);
		}

		const characterImages = Object.fromEntries(
			draft.dialogue.map((line) => [line.speaker, `/characters/${line.speaker}.png`]),
		);
		const built = buildGeneratedDialogue(draft, characterImages);
		for (const task of draft.tasks.filter((item) => item.type === "multipleChoice")) {
			const builtTask = built.tasks.find(
				(item) => item.type === "multipleChoice" && item.question === task.question,
			);
			assert.ok(builtTask, `Missing built MC task: ${task.question}`);
			assert.equal(builtTask.mcCategory, task.mcCategory);
			assert.equal(builtTask.mcTarget, task.mcTarget);
		}
	});
}
