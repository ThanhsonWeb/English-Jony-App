import { readFile } from "node:fs/promises";
import { courseConfigs } from "./config/index.mjs";
import { getGeneratedDialogueDraftPath } from "./lib/dialogue-content-paths.mjs";
import { planGlossary, prepareGlossary } from "./lib/contextual-glossary.mjs";

try {
	const [action, courseId, dialogueId, ...extra] = process.argv.slice(2);
	const config = courseConfigs.find(course => course.courseId === courseId);
	if (!["prepare", "check"].includes(action) || !config || extra.length
		|| !config.dialogues.some(lesson => lesson.dialogueId === dialogueId)) {
		throw new Error("Usage: node scripts/contextual-glossary.mjs <prepare|check> <courseId> <dialogueId>");
	}
	const root = process.cwd();
	const source = JSON.parse(await readFile(getGeneratedDialogueDraftPath(root, config.contentType, courseId, dialogueId), "utf8"));
	if (source.metadata.courseId !== courseId || source.metadata.dialogueId !== dialogueId) throw new Error("Draft identity mismatch");
	if (action === "prepare") {
		const { status, paths } = await prepareGlossary(root, config, source);
		console.log(`${status}\n${paths.prompt}`);
	} else {
		const { glossary } = await planGlossary(root, config, source, true);
		console.log(`Valid contextual glossary: ${Object.keys(glossary.lines).length} lines, ${Object.values(glossary.lines).reduce((total, line) => total + line.words.length, 0)} word occurrences.`);
	}
} catch (error) {
	console.error(error.message);
	process.exitCode = 1;
}
