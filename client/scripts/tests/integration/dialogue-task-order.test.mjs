import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const builderSource = readFileSync(new URL("../../../app/[locale]/(main)/dialogue/_data/helpers/buildDialogue.js", import.meta.url), "utf8");
const { buildGeneratedDialogueTasks } = await import(`data:text/javascript;base64,${Buffer.from(builderSource).toString("base64")}`);
const lesson = JSON.parse(readFileSync(new URL("../../../app/[locale]/(main)/dialogue/_data/dialogues/everyday-plans/making-plans-after-work.json", import.meta.url), "utf8"));

test("current A2 lesson retains its existing order and IDs", () => {
	const result = buildGeneratedDialogueTasks(lesson, {});
	assert.deepEqual(result.map((task) => task.id), lesson.tasks.map((task) => String(task.id)));
	assert.deepEqual(result.map((task) => task.audioUrl), lesson.tasks.map((task) => task.audioUrl));
});

test("A2 follows the defined sequence and preserves explicit IDs", () => {
	const draft = structuredClone(lesson);
	draft.metadata.level = "A2";
	[draft.tasks[0], draft.tasks[7]] = [draft.tasks[7], draft.tasks[0]];
	const result = buildGeneratedDialogueTasks(draft, {});
	assert.deepEqual(result.map((task) => task.id), draft.tasks.map((task) => String(task.id)));
	assert.equal(result[0].audioUrl, draft.tasks[0].audioUrl);
	assert.equal(result[7].audioUrl, draft.tasks[7].audioUrl);
});

test("A1 continues sorting by audio, placing review last, and renumbering", () => {
	const draft = structuredClone(lesson);
	draft.metadata.level = "a1";
	[draft.tasks[0], draft.tasks[7]] = [draft.tasks[7], draft.tasks[0]];
	draft.tasks.unshift(draft.tasks.pop());
	const result = buildGeneratedDialogueTasks(draft, {});
	assert.equal(result[0].audioUrl, draft.dialogue[0].audioUrl);
	assert.equal(result.at(-1).type, "dialogueCloze");
	assert.deepEqual(result.map((task) => task.id), result.map((_, index) => String(index + 1)));
});
