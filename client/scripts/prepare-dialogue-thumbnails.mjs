import { execFileSync } from "node:child_process";
import { access, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { courseConfigs } from "./config/index.mjs";
import {
	getDialogueDataJsonPath,
	getGeneratedCourseDirectory,
	getGeneratedDialogueDraftPath,
} from "./lib/dialogue-content-paths.mjs";

const root = process.cwd();
const publicRoot = path.join(root, "public", "dialogue");
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

async function exists(filePath) {
	try {
		await access(filePath);
		return true;
	} catch {
		return false;
	}
}

function characterReference(files, courseId, dialogueId, speaker) {
	const name = `${speaker.toLowerCase()}.png`;
	const matches = files.filter((file) =>
		file.toLowerCase().endsWith(`/shared/${name}`),
	);
	const preferred = [
		`${courseId}/shared/${name}`,
		`${courseId}/${dialogueId}/shared/${name}`,
	];
	return preferred.map((item) => matches.find((file) => file.toLowerCase() === item))
		.find(Boolean) || matches.find((file) => file.startsWith(`${courseId}/`)) || matches[0] || null;
}

function recommendedTime(draft) {
	const context = [draft.metadata.situation, ...draft.dialogue.map((line) => line.text)]
		.join(" ")
		.toLowerCase();
	if (/\b(morning|breakfast|sunrise)\b/.test(context)) return "Morning";
	if (/\b(afternoon|lunch|noon)\b/.test(context)) return "Afternoon";
	if (/\b(evening|dinner|sunset|night)\b/.test(context)) return "Evening";
	return "Not stated in the dialogue; follow the lighting of the background reference.";
}

function importantLines(draft) {
	const visualWords = /\b(table|menu|food|drink|coffee|tea|phone|bag|map|ticket|bus|train|hotel|room|key|door|park|tree|bench|shop|store|apple|cart|tent|fire|bill|book|desk|chair|window|street|cash|card|plate|water)\b/i;
	const matches = draft.dialogue.filter((line) => visualWords.test(line.text));
	return (matches.length ? matches : draft.dialogue).slice(0, 5);
}

function relativePublicFile(file) {
	return file ? `public/dialogue/${file}` : "No separate character image found; use the topic's existing artwork if available.";
}

async function loadFinalDialogue(contentType, courseId, dialogueId) {
	const candidates = [
		getGeneratedDialogueDraftPath(root, contentType, courseId, dialogueId),
		getDialogueDataJsonPath(root, contentType, courseId, dialogueId),
	];
	for (const candidate of candidates) {
		if (!(await exists(candidate))) continue;
		const draft = JSON.parse(await readFile(candidate, "utf8"));
		if (draft.metadata?.courseId !== courseId || draft.metadata?.dialogueId !== dialogueId) {
			throw new Error(`Dialogue identity does not match ${courseId}/${dialogueId}: ${candidate}`);
		}
		execFileSync(process.execPath, [path.join(root, "scripts", "validate-dialogue.mjs"), candidate, "--require-localization"], {
			cwd: root,
			stdio: "pipe",
		});
		return draft;
	}
	throw new Error(`Final JSON is missing for ${courseId}/${dialogueId}.`);
}

async function main() {
	const [courseId, ...extra] = process.argv.slice(2);
	if (!slugPattern.test(courseId || "") || extra.length) {
		throw new Error("Usage: npm run dialogue:thumbnails:prepare -- <courseId>");
	}
	const course = courseConfigs.find((config) => config.courseId === courseId);
	if (!course) throw new Error(`Course config not found: ${courseId}`);
	if (!course.dialogues?.length) throw new Error(`No dialogues configured for ${courseId}`);
	const generatedCourseDirectory = getGeneratedCourseDirectory(root, course.contentType, courseId);

	const allFiles = (await readdir(publicRoot, { recursive: true }))
		.filter((file) => file.toLowerCase().endsWith(".png"))
		.map((file) => file.replaceAll("\\", "/"));
	const styleReference = allFiles.find((file) => file.startsWith(`${courseId}/thumbnails/`))
		|| "restaurant/thumbnails/getting-a-table.png";
	if (!(await exists(path.join(publicRoot, styleReference)))) {
		throw new Error("No StudyJony thumbnail style reference was found.");
	}
	const styleInstructions = "Create one separate 16:9 landscape PNG for each dialogue. Match StudyJony's polished, warm, storybook/anime-inspired illustration style: expressive consistent character faces, detailed setting, natural poses, clear story moment, and cinematic but friendly lighting. Keep the characters, rendering, color treatment, and framing consistent across this topic as one series. No title text, captions, badge, UI, watermark, or multi-panel collage.";
	const manifestSections = [];

	for (const config of course.dialogues) {
		const dialogueId = config.dialogueId;
		if (!slugPattern.test(dialogueId || "")) throw new Error(`Invalid dialogue slug: ${dialogueId}`);
		const targetUrl = `/dialogue/${courseId}/thumbnails/${dialogueId}.png`;
		if (config.thumbnail !== targetUrl) {
			throw new Error(`Config thumbnail for ${dialogueId} must be ${targetUrl}`);
		}
		const draft = await loadFinalDialogue(course.contentType, courseId, dialogueId);
		const speakers = [...new Set(draft.dialogue.map((line) => line.speaker))];
		const references = speakers.map((speaker) => ({
			speaker,
			file: characterReference(allFiles, courseId, dialogueId, speaker),
		}));
		const title = draft.metadata.localized?.title?.en || draft.metadata.title;
		const context = draft.metadata.localized?.description?.en || draft.metadata.situation;
		const background = draft.metadata.scene || draft.dialogue.find((line) => line.scene)?.scene;
		const section = [
			`## ${title}`,
			`- Dialogue slug: \`${dialogueId}\``,
			`- Output PNG: \`${targetUrl}\``,
			`- Characters: ${speakers.join(", ")}`,
			`- Scene/context: ${context}`,
			"- Important visual details from the real dialogue:",
			...importantLines(draft).map((line) => `  - ${line.speaker}: “${line.text}”`),
			`- Recommended background: Show the setting in “${context}”${background ? `, matching the existing scene reference \`${background}\`` : ""}.`,
			`- Recommended time of day: ${recommendedTime(draft)}`,
			`- Character references: ${references.map(({ speaker, file }) => `${speaker} — ${relativePublicFile(file)}`).join("; ")}`,
			`- Style: ${styleInstructions}`,
			"- Full dialogue context:",
			...draft.dialogue.map((line) => `  - ${line.speaker}: ${line.text}`),
		].join("\n");
		manifestSections.push(section);
		const promptPath = path.join(generatedCourseDirectory, dialogueId, "thumbnail-prompt.txt");
		await mkdir(path.dirname(promptPath), { recursive: true });
		await writeFile(promptPath, `${section}\n`, "utf8");
		console.log(`Prepared: ${dialogueId} → ${path.relative(root, promptPath)}`);
	}
	const manifestPath = path.join(generatedCourseDirectory, "thumbnail-manifest.md");
	const manifest = [
		`# StudyJony thumbnail manifest: ${courseId}`,
		"",
		"Give this file to ChatGPT to generate the images. Generate each dialogue as its own PNG; do not combine them into one image. Save each file at the listed output path. Attach the referenced artwork if available.",
		"",
		`Series style reference: \`public/dialogue/${styleReference}\``,
		"",
		styleInstructions,
		"",
		...manifestSections.flatMap((section) => [section, ""]),
	].join("\n");
	await writeFile(manifestPath, manifest, "utf8");
	console.log(`\nChatGPT thumbnail manifest ready: ${path.relative(root, manifestPath)}`);
}

main().catch((error) => {
	console.error(`Thumbnail preparation failed: ${error.message}`);
	if (error.stdout) process.stderr.write(error.stdout);
	process.exitCode = 1;
});
