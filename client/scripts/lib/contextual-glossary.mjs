import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { SUBTITLE_WORD_PATTERN } from "../../app/_lib/dictionary/findPreferredLookup.js";
import { validateLessonGlossary } from "../../app/_lib/dictionary/validateLessonGlossary.js";
import { getContentStorageDirectory, getGeneratedDialogueDraftPath } from "./dialogue-content-paths.mjs";
import { buildGlossaryPrompt } from "../prompts/contextual-glossary.mjs";

async function exists(file) {
	try { await access(file); return true; } catch (error) { if (error.code === "ENOENT") return false; throw error; }
}

export function glossaryPaths(root, contentType, courseId, dialogueId) {
	getContentStorageDirectory(contentType);
	for (const slug of [courseId, dialogueId]) {
		if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug || "")) throw new Error("Invalid glossary lesson slug");
	}
	const directory = path.dirname(getGeneratedDialogueDraftPath(root, contentType, courseId, dialogueId));
	const approvedRoot = path.join(root, "app", "_lib", "dictionary", "glossaries");
	return {
		directory,
		draft: path.join(directory, "glossary.json"),
		template: path.join(directory, "glossary-template.json"),
		prompt: path.join(directory, "glossary-prompt.txt"),
		approvedRoot,
		approved: path.join(approvedRoot, ...(contentType === "story" ? ["stories"] : []), courseId, `${dialogueId}.json`),
		registry: path.join(root, "app", "_lib", "dictionary", "lessonGlossaries.js"),
	};
}

export function createGlossaryTemplate(source) {
	const entries = {}, lines = {};
	for (const line of source.dialogue) {
		const tokens = [...line.text.matchAll(SUBTITLE_WORD_PATTERN)].map(match => match[0]);
		const words = tokens.map(token => {
			const word = token.toLowerCase(), id = `word-${word}`;
			entries[id] ||= { word, meaning: "", pos: [] };
			return id;
		});
		lines[line.id] = { speaker: line.speaker, text: line.text, translation: line.translation, tokens, words, phrases: [] };
	}
	return { schemaVersion: 1, lessonId: source.metadata.courseId, dialogueId: source.metadata.dialogueId,
		characters: Object.fromEntries([...new Set(source.dialogue.map(line => line.speaker))].map(name => [name, { meaning: name, role: "" }])), entries, lines };
}

function assertValid(glossary, source, file) {
	const errors = validateLessonGlossary(glossary, source);
	if (errors.length) throw new Error(`Invalid contextual glossary ${file}:\n${errors.join("\n")}`);
}

export async function prepareGlossary(root, config, source) {
	const paths = glossaryPaths(root, config.contentType, config.courseId, source.metadata.dialogueId);
	if (await exists(paths.approved)) {
		assertValid(JSON.parse(await readFile(paths.approved, "utf8")), source, paths.approved);
		return { paths, status: "approved glossary preserved" };
	}
	await mkdir(paths.directory, { recursive: true });
	await writeFile(paths.prompt, buildGlossaryPrompt({ ...config, dialogueId: source.metadata.dialogueId }, source), "utf8");
	// Never replace authored meanings, even when the source changes.
	try { await writeFile(paths.template, JSON.stringify(createGlossaryTemplate(source), null, 2) + "\n", { flag: "wx" }); }
	catch (error) { if (error.code !== "EEXIST") throw error; }
	return { paths, status: "Codex authoring request prepared (meanings still required)" };
}

export async function planGlossary(root, config, source, required = false) {
	const paths = glossaryPaths(root, config.contentType, config.courseId, source.metadata.dialogueId);
	const approved = await exists(paths.approved) ? JSON.parse(await readFile(paths.approved, "utf8")) : null;
	const draft = await exists(paths.draft) ? JSON.parse(await readFile(paths.draft, "utf8")) : null;
	if (approved) assertValid(approved, source, paths.approved);
	if (draft) assertValid(draft, source, paths.draft);
	if (approved && draft && JSON.stringify(approved) !== JSON.stringify(draft)) {
		throw new Error("Approved glossary differs from the authored draft. Review and update it explicitly; the builder will not overwrite it.");
	}
	if (!approved && !draft && required) {
		await prepareGlossary(root, config, source);
		throw new Error(`Contextual glossary required before publishing. Run glossary:prepare, let Codex author ${paths.draft}, then run glossary:check.`);
	}
	return { paths, glossary: approved || draft, publish: !approved && !!draft };
}

export async function updateGlossaryRegistry(root) {
	const { approvedRoot, registry } = glossaryPaths(root, "dialogue", "registry", "registry");
	const files = (await readdir(approvedRoot, { recursive: true })).filter(file => file.endsWith(".json")).sort();
	const seen = new Set();
	const imports = [], names = [];
	for (const [index, file] of files.entries()) {
		const glossary = JSON.parse(await readFile(path.join(approvedRoot, file), "utf8"));
		const key = `${glossary.lessonId}/${glossary.dialogueId}`;
		if (seen.has(key)) throw new Error(`Duplicate contextual glossary: ${key}`);
		seen.add(key);
		const name = `glossary${index}`;
		imports.push(`import ${name} from ${JSON.stringify(`./glossaries/${file.replaceAll("\\", "/")}`)} with { type: "json" };`);
		names.push(name);
	}
	const contents = `// Generated by the content builder; contains only published offline glossaries.\n${imports.join("\n")}\n\nexport const lessonGlossaries = [${names.join(", ")}];\n`;
	if (!(await exists(registry)) || await readFile(registry, "utf8") !== contents) await writeFile(registry, contents, "utf8");
}

export async function publishGlossary(root, plan) {
	if (!plan.glossary) return;
	if (plan.publish) {
		await mkdir(path.dirname(plan.paths.approved), { recursive: true });
		// Exclusive creation protects approved data even if another author publishes concurrently.
		await writeFile(plan.paths.approved, JSON.stringify(plan.glossary, null, 2) + "\n", { flag: "wx" });
	}
	await updateGlossaryRegistry(root);
}
