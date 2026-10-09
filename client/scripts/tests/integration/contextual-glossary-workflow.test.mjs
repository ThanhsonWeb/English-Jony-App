import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import pilot from "../../../app/_lib/dictionary/glossaries/restaurant/getting-a-table.json" with { type: "json" };
import pilotSource from "../../../app/[locale]/(main)/dialogue/_data/dialogues/restaurant/getting-a-table.json" with { type: "json" };
import story from "../../../app/[locale]/(main)/dialogue/_data/stories/ten-minutes-a-day/the-old-book.json" with { type: "json" };
import storyGlossary from "../../../generated/stories/ten-minutes-a-day/the-old-book/glossary.json" with { type: "json" };
import { createGlossaryTemplate, glossaryPaths, planGlossary, prepareGlossary, publishGlossary } from "../../lib/contextual-glossary.mjs";
import { getDialogueDataJsonPath, getGeneratedDialogueDraftPath } from "../../lib/dialogue-content-paths.mjs";
import { validateLessonGlossary } from "../../../app/_lib/dictionary/validateLessonGlossary.js";
import { findContextualLookup, findLessonLookup } from "../../../app/_lib/dictionary/findLessonLookup.js";
import { buildDialoguePrompt } from "../../prompts/dialogue-generator.mjs";
import restaurant from "../../config/dialogues/restaurant.mjs";

const clientRoot = fileURLToPath(new URL("../../../", import.meta.url));
const writeJson = async (file, data) => { await fs.mkdir(path.dirname(file), { recursive: true }); await fs.writeFile(file, JSON.stringify(data)); };

async function workspace(t) {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), "studyjony-glossary-workflow-"));
	t.after(async () => {
		assert(path.resolve(root).startsWith(path.resolve(os.tmpdir()) + path.sep));
		await fs.rm(root, { recursive: true, force: true });
	});
	return root;
}

for (const contentType of ["dialogue", "story"]) {
	test(`${contentType}: preparation leaves meanings empty and preserves authored/approved files`, async t => {
		const root = await workspace(t), config = { contentType, courseId: "restaurant" };
		const { paths } = await prepareGlossary(root, config, pilotSource);
		const template = JSON.parse(await fs.readFile(paths.template, "utf8"));
		assert.deepEqual(template.lines[9].tokens, pilot.lines[9].tokens);
		assert(Object.values(template.entries).every(entry => entry.meaning === ""));
		await assert.rejects(planGlossary(root, config, pilotSource, true), /required before publishing/);
		await writeJson(paths.draft, pilot);
		const before = await fs.readFile(paths.draft, "utf8");
		await prepareGlossary(root, config, pilotSource);
		assert.equal(await fs.readFile(paths.draft, "utf8"), before);
		const plan = await planGlossary(root, config, pilotSource, true);
		await publishGlossary(root, plan);
		const approved = await fs.readFile(paths.approved, "utf8"), registry = await fs.readFile(paths.registry, "utf8");
		assert(registry.includes(contentType === "story" ? "./glossaries/stories/restaurant/" : "./glossaries/restaurant/"));
		assert.equal((await prepareGlossary(root, config, pilotSource)).status, "approved glossary preserved");
		await publishGlossary(root, await planGlossary(root, config, pilotSource, true));
		assert.equal(await fs.readFile(paths.approved, "utf8"), approved);
		assert.equal(await fs.readFile(paths.registry, "utf8"), registry);
		const changed = structuredClone(pilot); changed.entries.table.meaning = "bàn";
		await writeJson(paths.draft, changed);
		await assert.rejects(planGlossary(root, config, pilotSource, true), /will not overwrite/);
		assert.equal(await fs.readFile(paths.approved, "utf8"), approved);
	});
}

test("legacy lessons may use dictionary fallback; new lessons must supply meanings", async t => {
	const root = await workspace(t), config = { contentType: "dialogue", courseId: "restaurant" };
	assert.equal((await planGlossary(root, config, pilotSource)).glossary, null);
	const paths = glossaryPaths(root, "dialogue", "restaurant", "getting-a-table");
	await writeJson(paths.draft, createGlossaryTemplate(pilotSource));
	await assert.rejects(planGlossary(root, config, pilotSource, true), /missing meaning/);
});

test("an approved glossary blocks source changes rather than rewriting meanings", async t => {
	const root = await workspace(t), config = { contentType: "dialogue", courseId: "restaurant" };
	const paths = glossaryPaths(root, "dialogue", "restaurant", "getting-a-table");
	await writeJson(paths.approved, pilot);
	const source = structuredClone(pilotSource); source.dialogue[6].text = "Yes, it is. It is a noisy area.";
	await assert.rejects(planGlossary(root, config, source, true), /outdated text/);
	await assert.rejects(prepareGlossary(root, config, source), /outdated text/);
	assert.deepEqual(JSON.parse(await fs.readFile(paths.approved)), pilot);
});

for (const defect of ["missing", "new lesson", "shifted phrase", "same-count edit"]) {
	test(`real builder refuses ${defect} before any publication`, async t => {
		const root = await workspace(t), source = structuredClone(story);
		if (defect !== "new lesson") source.metadata.contextualGlossaryVersion = 1;
		const draftPath = getGeneratedDialogueDraftPath(root, "story", "ten-minutes-a-day", "the-old-book");
		await writeJson(draftPath, source);
		const productionPath = getDialogueDataJsonPath(root, "story", "ten-minutes-a-day", "the-old-book");
		await fs.mkdir(path.dirname(productionPath), { recursive: true });
		if (defect !== "new lesson") await fs.writeFile(productionPath, "unchanged production sentinel");
		await fs.mkdir(path.join(root, "scripts", "prompts"), { recursive: true });
		for (const script of ["validate-dialogue.mjs", "prompts/dialogue-rules.mjs"]) {
			await fs.copyFile(path.join(clientRoot, "scripts", script), path.join(root, "scripts", script));
		}
		const paths = glossaryPaths(root, "story", "ten-minutes-a-day", "the-old-book");
		if (!["missing", "new lesson"].includes(defect)) {
			const glossary = structuredClone(storyGlossary);
			if (defect === "shifted phrase") glossary.lines[1].phrases[0].start = 4;
			else glossary.lines[2].text = "An English book? It looks new.";
			await writeJson(paths.draft, glossary);
		}
		const result = spawnSync(process.execPath, [path.join(clientRoot, "scripts", "build-dialogue.mjs"), "ten-minutes-a-day", "the-old-book", "--skip-audio"], { cwd: root, encoding: "utf8" });
		assert.equal(result.status, 1, result.stdout + result.stderr);
		assert.match(result.stderr, /glossary required|Invalid contextual glossary/i);
		if (defect === "new lesson") await assert.rejects(fs.access(productionPath));
		else assert.equal(await fs.readFile(productionPath, "utf8"), "unchanged production sentinel");
		await assert.rejects(fs.access(paths.approved));
		if (["missing", "new lesson"].includes(defect)) {
			const template = JSON.parse(await fs.readFile(paths.template, "utf8"));
			assert(Object.values(template.entries).every(entry => entry.meaning === ""));
			assert.match(await fs.readFile(paths.prompt, "utf8"), /I have a book for each of you/);
		}
	});
}

test("new content prompt opts into mandatory glossary validation", () => {
	const prompt = buildDialoguePrompt({ ...restaurant, ...restaurant.dialogues[0] });
	assert.match(prompt, /"contextualGlossaryVersion": 1/);
});

test("additional Story: all 79 word meanings, phrases and repeated senses are valid", () => {
	assert.deepEqual(validateLessonGlossary(storyGlossary, story), []);
	let occurrences = 0;
	for (const line of story.dialogue) {
		for (const [index, id] of storyGlossary.lines[line.id].words.entries()) {
			const lookup = findContextualLookup(storyGlossary, line, index);
			const word = lookup.wordLookup || lookup;
			assert.equal(word.result.displayMeaning, storyGlossary.entries[id].meaning);
			assert.deepEqual([word.startWordIndex, word.endWordIndex], [index, index]);
			assert.equal(word.result.note, undefined);
			occurrences++;
		}
	}
	assert.equal(occurrences, 79);
	assert.equal(findContextualLookup(storyGlossary, story.dialogue[0], 4).result.displayMeaning, "cho");
	assert.equal(findContextualLookup(storyGlossary, story.dialogue[3], 2).result.displayMeaning, "trong");
	assert.equal(findContextualLookup(storyGlossary, story.dialogue[2], 3).result.displayMeaning, "làm");
	assert.equal(findContextualLookup(storyGlossary, story.dialogue[8], 0).wordLookup.result.displayMeaning, "trợ động từ");
});

test("published Story uses contextual lookup and falls back on a changed sentence", () => {
	const line = story.dialogue[7];
	const lookup = findLessonLookup({ lessonId: "ten-minutes-a-day", dialogueId: "the-old-book", line, clickedWordIndex: 1 });
	assert.equal(lookup.result.displayMeaning, "cảm thấy chán");
	assert.equal(lookup.wordLookup.result.displayMeaning, "cảm thấy");
	assert.equal(findLessonLookup({ lessonId: "ten-minutes-a-day", dialogueId: "the-old-book", line: { ...line, text: "I get tired when I read." }, clickedWordIndex: 1 })?.result.contextual, undefined);
});
