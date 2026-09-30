import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { englishMcOptions, englishMcQuestions } from "../app/_lib/dialogue/mcQuestions.js";
import { getLocalizedDialogueValue, withDialogueLocalization } from "../app/_lib/dialogue/localization.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const readJson = (path) => JSON.parse(readFileSync(join(root, path), "utf8"));
const keysDeep = (value, prefix = "") => Object.entries(value).flatMap(([key, item]) => {
	const path = prefix ? `${prefix}.${key}` : key;
	return item && typeof item === "object" ? keysDeep(item, path) : [path];
});

test("dialogue UI keys match in Vietnamese and English", () => {
	const english = readJson("messages/en.json").DialogueFeature;
	const vietnamese = readJson("messages/vi.json").DialogueFeature;
	assert.deepEqual(keysDeep(english).sort(), keysDeep(vietnamese).sort());
});

test("localized course and dialogue fields respond to a locale switch", () => {
	const lines = [{ speaker: "Ben", text: "I would like a coffee.", translation: "Tôi muốn một ly cà phê." }];
	const tasks = [{ id: "1", type: "fillBlank", answer: "coffee" }];
	const course = withDialogueLocalization({
		id: "coffee-shop",
		title: "Quán cà phê",
		description: "Mô tả tiếng Việt",
		dialogues: [{ id: "ordering-a-coffee", title: "Gọi cà phê", description: "Mô tả bài học", dialogue: lines, tasks }],
	});
	assert.equal(getLocalizedDialogueValue(course, "title", "vi"), "Quán cà phê");
	assert.equal(getLocalizedDialogueValue(course, "title", "en"), "Coffee shop");
	assert.equal(getLocalizedDialogueValue(course.dialogues[0], "title", "en"), "Ordering a coffee");
	assert.equal(getLocalizedDialogueValue(course.dialogues[0], "title", "vi"), "Gọi cà phê");
	assert.equal(course.dialogues[0].dialogue, lines);
	assert.equal(course.dialogues[0].tasks, tasks);
	assert.equal(getLocalizedDialogueValue({ title: { vi: "Nhà hàng", en: "Restaurant" } }, "title", "en"), "Restaurant");
});

test("every generated Multiple Choice question has an English version", () => {
	const base = join(root, "app/[locale]/(main)/dialogue/_data/dialogues");
	for (const course of readdirSync(base)) {
		const questions = englishMcQuestions[course];
		if (!questions) continue;
		for (const file of readdirSync(join(base, course)).filter((name) => name.endsWith(".json"))) {
			const dialogue = readJson(`app/[locale]/(main)/dialogue/_data/dialogues/${course}/${file}`);
			const mcTasks = (dialogue.tasks || []).filter((task) => task.type === "multipleChoice");
			assert.equal(questions[file.slice(0, -5)]?.length, mcTasks.length, `${course}/${file}`);
			assert.ok(questions[file.slice(0, -5)].every((question) => !/[À-ỹ]/u.test(question)));
			for (const task of mcTasks) {
				const options = englishMcOptions[course]?.[file.slice(0, -5)]?.[task.id];
				if (options) assert.equal(options.length, task.options.length, `${course}/${file} task ${task.id}`);
			}
		}
	}
});

test("legacy office and camping Multiple Choice questions have English coverage", () => {
	const office = readFileSync(join(root, "app/[locale]/(main)/dialogue/_data/courses/office-introduction.js"), "utf8");
	const officeIds = ["meeting-tom", "meet-coworkers", "talk-about-work", "lunch-break"];
	for (const [index, id] of officeIds.entries()) {
		const start = office.indexOf(`id: "${id}"`);
		const end = index + 1 < officeIds.length ? office.indexOf(`id: "${officeIds[index + 1]}"`) : office.length;
		const count = [...office.slice(start, end).matchAll(/type:\s*"multipleChoice"/g)].length;
		assert.equal(englishMcQuestions["office-introduction"][id].length, count, id);
	}
	for (const id of ["arriving-at-the-campsite", "setting-up-the-tent", "cooking-dinner", "talking-by-the-campfire"]) {
		const source = readFileSync(join(root, `app/[locale]/(main)/dialogue/_data/dialogues/weekend-camping/${id}.js`), "utf8");
		const count = [...source.matchAll(/(?:"type"|type):\s*"multipleChoice"/g)].length;
		assert.equal(englishMcQuestions["weekend-camping"][id].length, count, id);
	}
});
