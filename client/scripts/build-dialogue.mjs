import { execFileSync } from "node:child_process";
import { access, copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { courseConfigs } from "./config/index.mjs";
import { planGlossary, publishGlossary } from "./lib/contextual-glossary.mjs";
import {
	getContentStorageDirectory,
	getDialogueDataCourseDirectory,
	getDialogueDataJsonPath,
	getGeneratedDialogueDraftPath,
	getPublicAssetPath,
} from "./lib/dialogue-content-paths.mjs";

const ROOT = process.cwd();
const DIALOGUE_DATA_ROOT = path.join(
	ROOT,
	"app",
	"[locale]",
	"(main)",
	"dialogue",
	"_data",
);
const COURSE_DIRECTORY = path.join(DIALOGUE_DATA_ROOT, "courses");
const LESSON_DATA_PATH = path.join(DIALOGUE_DATA_ROOT, "lessonData.js");
const COURSE_CONFIG_INDEX_PATH = path.join(
	ROOT,
	"scripts",
	"config",
	"index.mjs",
);
const VALIDATOR_PATH = path.join(ROOT, "scripts", "validate-dialogue.mjs");
const AUDIO_GENERATOR_PATH = path.join(
	ROOT,
	"scripts",
	"generate-dialogue-audio.mjs",
);

function fail(message) {
	throw new Error(message);
}

function assertSlug(value, label) {
	if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value || "")) {
		fail(`${label} must use lowercase letters, numbers, and hyphens.`);
	}
}

function toIdentifier(value) {
	return value.replace(/-([a-z0-9])/g, (_, character) =>
		character.toUpperCase(),
	);
}

function toTitle(value) {
	return value
		.split("-")
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(" ");
}

function runNode(scriptPath, args = [], verbose = false) {
	try {
		const output = execFileSync(process.execPath, [scriptPath, ...args], {
			cwd: ROOT,
			env: process.env,
			encoding: "utf8",
			stdio: ["inherit", "pipe", "inherit"],
		});
		if (verbose) process.stdout.write(output);
		return output;
	} catch (error) {
		if (error.stdout) process.stdout.write(error.stdout);
		throw error;
	}
}

function runAudioGenerator(draftPath, verbose = false) {
	let output;
	try {
		output = execFileSync(process.execPath, [AUDIO_GENERATOR_PATH, draftPath], {
			cwd: ROOT,
			env: process.env,
			encoding: "utf8",
			stdio: ["inherit", "pipe", "inherit"],
		});
	} catch (error) {
		if (error.stdout) process.stdout.write(error.stdout);
		throw error;
	}

	const result = output.match(/Complete: (\d+) generated, (\d+) skipped, (\d+) failed\./);
	if (!result) fail(`Audio generator did not report a result:\n${output}`);
	if (verbose) process.stdout.write(output);
	return { generated: Number(result[1]), existing: Number(result[2]) };
}

function logStep(verbose, label) {
	if (verbose) console.log(`\n${label}`);
}

function getReportNumber(output, label) {
	const match = output.match(new RegExp(`- ${label}: (\\d+)`));
	if (!match) fail(`Validator output is missing "${label}".`);
	return Number(match[1]);
}

function formatMcSummary(output) {
	const total = getReportNumber(output, "Total MC count");
	const comprehension = getReportNumber(output, "Comprehension");
	const grammar = getReportNumber(output, "Grammar");
	const usage = getReportNumber(output, "Usage");
	return `MC ${total} (${comprehension} comprehension, ${grammar} grammar, ${usage} usage)`;
}

function getPassedTestCount(output) {
	const match = output.match(/^# pass (\d+)$/m);
	if (!match) fail("Test runner output is missing the pass count.");
	return Number(match[1]);
}

async function exists(filePath) {
	try {
		await access(filePath);
		return true;
	} catch {
		return false;
	}
}

async function loadJson(filePath) {
	try {
		return JSON.parse(await readFile(filePath, "utf8"));
	} catch (error) {
		fail(`Could not read JSON at ${path.relative(ROOT, filePath)}: ${error.message}`);
	}
}

function loadCourseConfig(courseId) {
	const config = courseConfigs.find((item) => item.courseId === courseId);

	if (
		!config ||
		!config.contentType ||
		!Array.isArray(config.dialogues) ||
		!Array.isArray(config.characters)
	) {
		fail(`Course config not found or invalid in scripts/config/index.mjs: ${courseId}`);
	}

	return config;
}

function findConfigDialogue(config, dialogueId) {
	const dialogue = config.dialogues.find(
		(item) => item.dialogueId === dialogueId,
	);
	if (!dialogue) {
		fail(`Dialogue "${dialogueId}" is not registered in the course config.`);
	}
	return dialogue;
}

function validateDraftIdentity(draft, courseId, dialogueId) {
	if (draft?.metadata?.courseId !== courseId) {
		fail(
			`Draft courseId is "${draft?.metadata?.courseId}", expected "${courseId}".`,
		);
	}
	if (draft?.metadata?.dialogueId !== dialogueId) {
		fail(
			`Draft dialogueId is "${draft?.metadata?.dialogueId}", expected "${dialogueId}".`,
		);
	}
}

function getSpeakerNames(draft, config) {
	const speakers = [...new Set(draft.dialogue.map((line) => line.speaker))];
	for (const speaker of speakers) {
		if (!config.characters.includes(speaker)) {
			fail(`Speaker "${speaker}" is not listed in the course config.`);
		}
	}
	return speakers;
}

function extractCharacterMappings(mediaSource) {
	const mappings = new Map();
	const pattern = /^\s*"?([^":]+)"?:\s*"([^"]+)",?\s*$/gm;
	for (const match of mediaSource.matchAll(pattern)) {
		const speaker = match[1].trim();
		if (!mappings.has(speaker)) mappings.set(speaker, match[2]);
	}
	return mappings;
}

async function updateMediaFile({ contentType, courseId, dialogueId, draft, speakers }) {
	const mediaPath = path.join(
		getDialogueDataCourseDirectory(ROOT, contentType, courseId),
		"media.js",
	);
	const exportName = `${toIdentifier(courseId)}Media`;
	let source = (await exists(mediaPath))
		? await readFile(mediaPath, "utf8")
		: `export const ${exportName} = {\n};\n`;

	if (new RegExp(`^[\\t ]*"${dialogueId}":`, "m").test(source)) {
		return mediaPath;
	}

	const knownCharacters = extractCharacterMappings(source);
	const characterLines = speakers.map((speaker) => {
		const fallback = getPublicAssetPath(
			contentType,
			courseId,
			dialogueId,
			"shared",
			`${speaker.toLowerCase()}.png`,
		);
		return `\t\t\t${JSON.stringify(speaker)}: "${knownCharacters.get(speaker) || fallback}",`;
	});
	const entry = [
		`\t"${dialogueId}": {`,
		`\t\tscene: "${draft.metadata.scene}",`,
		"\t\tcharacters: {",
		...characterLines,
		"\t\t},",
		"\t},",
	].join("\n");

	const closingIndex = source.lastIndexOf("};");
	if (closingIndex === -1) fail(`Invalid media module: ${mediaPath}`);
	const before = source.slice(0, closingIndex).replace(/\s*$/, "\n");
	source = `${before}${entry}\n${source.slice(closingIndex)}`;

	await mkdir(path.dirname(mediaPath), { recursive: true });
	await writeFile(mediaPath, source, "utf8");
	return mediaPath;
}

function updateExistingCourseSource(source, contentType, courseId, dialogueId, config) {
	const identifier = toIdentifier(dialogueId);
	const storageDirectory = getContentStorageDirectory(contentType);
	if (contentType === "story" && !/contentType:\s*["']story["']/.test(source)) {
		source = source.replace(/(id:\s*["'][^"']+["'],)/, '$1\n\tcontentType: "story",');
	}
	const importLine = `import ${identifier} from "../${storageDirectory}/${courseId}/${dialogueId}.json";`;

	if (!source.includes(`../${storageDirectory}/${courseId}/${dialogueId}.json`)) {
		const mediaImport = source.match(
			/^import \{ [^\n]+Media \} from "\.\.\/(?:dialogues|stories)\/[^\n]+\/media";$/m,
		);
		if (!mediaImport) fail("Course file is missing its media import.");
		const mediaLine = `import { ${toIdentifier(courseId)}Media } from "../${storageDirectory}/${courseId}/media";`;
		source = source.replace(mediaImport[0], `${importLine}\n${mediaLine}`);
	}

	if (!source.includes("function buildCourseDialogue(draft)")) {
		fail("Existing course does not use the buildCourseDialogue architecture.");
	}

	const arrayMatch = source.match(/dialogues:\s*\[([\s\S]*?)\],/);
	if (!arrayMatch) fail("Could not find the course dialogues array.");
	if (arrayMatch[1].includes(`buildCourseDialogue(${identifier})`)) return source;

	const importsByDialogue = new Map();
	const importPattern = /^import\s+(\w+)\s+from\s+"\.\.\/(?:dialogues|stories)\/[^/]+\/([^"/]+)\.json";$/gm;
	for (const match of source.matchAll(importPattern)) {
		importsByDialogue.set(match[2], match[1]);
	}
	importsByDialogue.set(dialogueId, identifier);

	const calls = config.dialogues
		.map((item) => importsByDialogue.get(item.dialogueId))
		.filter(Boolean)
		.map((name) => `\t\tbuildCourseDialogue(${name}),`)
		.join("\n");

	return source.replace(arrayMatch[0], `dialogues: [\n${calls}\n\t],`);
}

function createCourseSource(contentType, courseId, dialogueId, draft, config) {
	const courseIdentifier = toIdentifier(courseId);
	const dialogueIdentifier = toIdentifier(dialogueId);
	const displayName = toTitle(courseId);
	const storageDirectory = getContentStorageDirectory(contentType);
	return `import ${courseIdentifier}Config from "@/scripts/config/${storageDirectory}/${courseId}.mjs";\n\nimport ${dialogueIdentifier} from "../${storageDirectory}/${courseId}/${dialogueId}.json";\nimport { ${courseIdentifier}Media } from "../${storageDirectory}/${courseId}/media";\nimport { buildGeneratedDialogue } from "../helpers/buildDialogue";\n\nfunction buildCourseDialogue(draft) {\n\tif (\n\t\t${courseIdentifier}Config?.courseId !== "${courseId}" ||\n\t\t!Array.isArray(${courseIdentifier}Config.dialogues) ||\n\t\t!Array.isArray(${courseIdentifier}Config.characters)\n\t) {\n\t\tthrow new Error("${displayName} course config is missing or invalid.");\n\t}\n\n\tconst dialogueId = draft?.metadata?.dialogueId;\n\tif (!dialogueId) {\n\t\tthrow new Error("${displayName} dialogue is missing metadata.dialogueId.");\n\t}\n\n\tconst config = ${courseIdentifier}Config.dialogues.find(\n\t\t(item) => item.dialogueId === dialogueId,\n\t);\n\tif (!config) {\n\t\tthrow new Error(\`Missing ${displayName} config for dialogue "\${dialogueId}".\`);\n\t}\n\n\tconst media = ${courseIdentifier}Media[dialogueId];\n\tif (!media) {\n\t\tthrow new Error(\`Missing ${displayName} media for dialogue "\${dialogueId}".\`);\n\t}\n\n\tconst speakers = new Set(draft.dialogue.map((line) => line.speaker));\n\tfor (const speaker of speakers) {\n\t\tif (!${courseIdentifier}Config.characters.includes(speaker)) {\n\t\t\tthrow new Error(\n\t\t\t\t\`Unknown ${displayName} character "\${speaker}" in dialogue "\${dialogueId}".\`,\n\t\t\t);\n\t\t}\n\n\t\tif (!media.characters[speaker]) {\n\t\t\tthrow new Error(\n\t\t\t\t\`Missing ${displayName} image for character "\${speaker}" in dialogue "\${dialogueId}".\`,\n\t\t\t);\n\t\t}\n\t}\n\n\tconst dialogue = buildGeneratedDialogue(draft, media.characters, media);\n\n\treturn {\n\t\t...dialogue,\n\t\ttitle: config.title?.trim() ?? dialogue.title,\n\t\tdescription: config.situation ?? dialogue.description,\n\t\tthumbnail: config.thumbnail ?? dialogue.thumbnail,\n\t};\n}\n\nconst ${courseIdentifier}Course = {\n\tid: "${courseId}",\n\tcontentType: "${contentType || "dialogue"}",\n\theroImage: ${dialogueIdentifier}.metadata.scene,\n\timage: ${dialogueIdentifier}.metadata.scene,\n\ttitle: "${displayName}",\n\tdescription: ${JSON.stringify(draft.metadata.situation || config.dialogues[0].situation || "")},\n\tlevel: ${courseIdentifier}Config.level,\n\tdialogues: [buildCourseDialogue(${dialogueIdentifier})],\n};\n\nexport default ${courseIdentifier}Course;\n`;
}

async function updateCourseFile({ contentType, courseId, dialogueId, draft, config }) {
	const coursePath = path.join(COURSE_DIRECTORY, `${courseId}.js`);
	const existingCourse = await exists(coursePath);
	let source = existingCourse
		? updateExistingCourseSource(
				await readFile(coursePath, "utf8"),
				contentType,
				courseId,
				dialogueId,
				config,
			)
		: createCourseSource(contentType, courseId, dialogueId, draft, config);
	if (!existingCourse) {
		const levelLine = `\tlevel: ${toIdentifier(courseId)}Config.level,`;
		const localized = {
			title: draft.metadata.localized.courseTitle,
			description: draft.metadata.localized.courseDescription,
		};
		source = source.replace(levelLine, `\tlocalized: ${JSON.stringify(localized)},\n${levelLine}`);
	}
	await writeFile(coursePath, source, "utf8");
	return coursePath;
}

async function registerCourse(courseId) {
	const courseIdentifier = `${toIdentifier(courseId)}Course`;
	let source = await readFile(LESSON_DATA_PATH, "utf8");
	const importLine = `import ${courseIdentifier} from "./courses/${courseId}";`;

	if (!source.includes(importLine)) {
		const imports = [...source.matchAll(/^import .+;$/gm)];
		if (imports.length === 0) fail("lessonData.js has no course imports.");
		const lastImport = imports.at(-1);
		const index = lastImport.index + lastImport[0].length;
		source = `${source.slice(0, index)}\n${importLine}${source.slice(index)}`;
	}
	const localizationImport = 'import { withDialogueLocalization } from "@/app/_lib/dialogue/localization";';
	if (!source.includes(localizationImport)) {
		const imports = [...source.matchAll(/^import .+;$/gm)];
		const lastImport = imports.at(-1);
		const index = lastImport.index + lastImport[0].length;
		source = `${source.slice(0, index)}\n${localizationImport}${source.slice(index)}`;
	}

	if (!source.includes(`[${courseIdentifier}.id]: withDialogueLocalization(${courseIdentifier}),`)) {
		const bareEntry = `[${courseIdentifier}.id]: ${courseIdentifier},`;
		source = source.includes(bareEntry)
			? source.replace(bareEntry, `[${courseIdentifier}.id]: withDialogueLocalization(${courseIdentifier}),`)
			: source.replace(/\n};\s*$/, `\n   [${courseIdentifier}.id]: withDialogueLocalization(${courseIdentifier}),\n};\n`);
	}

	await writeFile(LESSON_DATA_PATH, source, "utf8");
}

function publicFilePath(publicUrl) {
	return path.join(ROOT, "public", ...publicUrl.replace(/^\/+/, "").split("/"));
}

async function inspectMedia({ courseId, dialogueId, draft, config, mediaPath, skipAudio }) {
	const mediaSource = await readFile(mediaPath, "utf8");
	const moduleUrl = `data:text/javascript;base64,${Buffer.from(mediaSource).toString("base64")}`;
	const media = (await import(moduleUrl))[`${toIdentifier(courseId)}Media`]?.[
		dialogueId
	];
	if (!media) fail(`Missing media mapping for ${courseId}/${dialogueId}.`);

	const configDialogue = findConfigDialogue(config, dialogueId);
	const visualUrls = new Set(
		[
			draft.metadata.scene,
			configDialogue.thumbnail,
			draft.metadata.thumbnail,
			...draft.dialogue.map((line) => line.scene),
			media.scene,
			...Object.values(media.scenes || {}),
			...Object.values(media.characters || {}),
		].filter(Boolean),
	);
	const missing = [];
	const existing = [];
	for (const url of visualUrls) {
		const group = (await exists(publicFilePath(url))) ? existing : missing;
		group.push(url);
	}

	const audioUrls = new Set(draft.dialogue.map((line) => line.audioUrl));
	const missingAudio = [];
	for (const url of audioUrls) {
		if (!url || !(await exists(publicFilePath(url)))) missingAudio.push(url);
	}
	if (missingAudio.length > 0 && !skipAudio) {
		fail(`Required audio is missing: ${missingAudio.join(", ")}`);
	}

	return { existing, missing, audioCount: audioUrls.size, missingAudio };
}

async function main() {
	const [courseId, dialogueId, ...extra] = process.argv.slice(2);
	if (
		!courseId ||
		!dialogueId ||
		extra.some((option) => !["--verbose", "--skip-audio"].includes(option)) ||
		extra.length > 2
	) {
		fail("Usage: npm run dialogue:build -- <courseId> <dialogueId> [--verbose] [--skip-audio]");
	}
	const verbose =
		extra.includes("--verbose") ||
		process.env.npm_config_loglevel === "verbose";
	const skipAudio = extra.includes("--skip-audio") ||
		process.env.npm_config_skip_audio === "true";
	assertSlug(courseId, "courseId");
	assertSlug(dialogueId, "dialogueId");
	if (!verbose) console.log(`Building ${courseId}/${dialogueId}...`);

	const config = loadCourseConfig(courseId);
	const contentType = config.contentType;
	const draftPath = getGeneratedDialogueDraftPath(
		ROOT,
		contentType,
		courseId,
		dialogueId,
	);
	const productionPath = getDialogueDataJsonPath(
		ROOT,
		contentType,
		courseId,
		dialogueId,
	);

	if (!(await exists(draftPath))) fail(`Draft not found: ${draftPath}`);

	logStep(verbose, "[1/7] Validating draft");
	const draftValidation = runNode(VALIDATOR_PATH, [draftPath, "--require-localization"], verbose);
	const draft = await loadJson(draftPath);
	validateDraftIdentity(draft, courseId, dialogueId);
	findConfigDialogue(config, dialogueId);
	const speakers = getSpeakerNames(draft, config);
	if (!verbose) console.log(`✅ Draft valid — ${formatMcSummary(draftValidation)}`);
	if (draft.metadata.contextualGlossaryVersion !== undefined && draft.metadata.contextualGlossaryVersion !== 1) {
		fail("Unsupported metadata.contextualGlossaryVersion");
	}
	// All glossary checks precede production, registration and audio writes.
	const glossaryPlan = await planGlossary(ROOT, config, draft,
		draft.metadata.contextualGlossaryVersion === 1 || !(await exists(productionPath)));
	console.log(glossaryPlan.glossary ? "✅ Contextual glossary validated" : "Existing lesson: production dictionary fallback retained");

	logStep(verbose, "[2/7] Promoting dialogue JSON");
	await mkdir(path.dirname(productionPath), { recursive: true });
	await copyFile(draftPath, productionPath);
	await publishGlossary(ROOT, glossaryPlan);

	logStep(verbose, "[3/7] Updating course and media registration");
	const mediaPath = await updateMediaFile({
		contentType,
		courseId,
		dialogueId,
		draft,
		speakers,
	});
	const coursePath = await updateCourseFile({
		contentType,
		courseId,
		dialogueId,
		draft,
		config,
	});
	await registerCourse(courseId);
	if (!verbose) console.log("✅ Promoted to course data");

	logStep(verbose, "[4/7] Generating referenced dialogue audio");
	const audioResult = skipAudio
		? { generated: 0, existing: 0 }
		: runAudioGenerator(draftPath, verbose);
	if (!verbose) {
		console.log(skipAudio
			? "⚠ Audio generation skipped"
			: `✅ Audio — ${audioResult.generated} generated, ${audioResult.existing} skipped`);
	}

	logStep(verbose, "[5/7] Validating promoted dialogue");
	runNode(VALIDATOR_PATH, [productionPath, "--require-localization"], verbose);

	logStep(verbose, "[6/7] Running focused lint and tests");
	const eslintPath = path.join(
		ROOT,
		"node_modules",
		"eslint",
		"bin",
		"eslint.js",
	);
	runNode(eslintPath, [
		path.relative(ROOT, coursePath),
		path.relative(ROOT, mediaPath),
		path.relative(ROOT, LESSON_DATA_PATH),
		path.relative(ROOT, COURSE_CONFIG_INDEX_PATH),
		path.join("scripts", "lib", "dialogue-content-paths.mjs"),
		path.join("scripts", "tests", "unit", "dialogue-content-paths.test.mjs"),
		path.join("scripts", "lib", "contextual-glossary.mjs"),
		path.join("app", "_lib", "dictionary", "validateLessonGlossary.js"),
	], verbose);
	const testOutput = runNode("--test", [
		path.join(ROOT, "scripts", "tests", "integration", "dialogue-a1-content-rules.test.mjs"),
		path.join(ROOT, "scripts", "tests", "integration", "dialogue-mc-report.test.mjs"),
		path.join(ROOT, "scripts", "tests", "integration", "dialogue-practice-rule.test.mjs"),
		path.join(ROOT, "scripts", "tests", "unit", "dialogue-content-paths.test.mjs"),
		path.join(ROOT, "scripts", "tests", "integration", "contextual-glossary-workflow.test.mjs"),
	], verbose);
	if (!verbose) console.log(`✅ Tests — ${getPassedTestCount(testOutput)} passed`);

	logStep(verbose, "[7/7] Checking media assets");
	const assets = await inspectMedia({
		courseId,
		dialogueId,
		draft,
		config,
		mediaPath,
		skipAudio,
	});

	if (verbose) {
		console.log(`\nDialogue build complete ✅ ${courseId}/${dialogueId}`);
		console.log(`\nAudio: ${audioResult.generated} generated, ${audioResult.existing} already present (${assets.missingAudio.length} missing of ${assets.audioCount} total)`);
		console.log("\nMissing assets (optional visuals):");
		for (const asset of assets.missing) console.log(`- ${asset}`);
		if (assets.missing.length === 0) console.log("- None");
		console.log("\nExisting assets:");
		for (const asset of assets.existing) console.log(`- ${asset}`);
		if (assets.existing.length === 0) console.log("- None");
		console.log("\nNext step:");
		console.log("Generate the missing visual assets, save them to the listed paths, then test the dialogue in the UI.");
	} else {
		if (assets.missingAudio.length > 0) console.log(`⚠ Audio pending: ${assets.missingAudio.length} files`);
		if (assets.missing.length > 0) {
			console.log("\n⚠ Missing assets:");
			for (const asset of assets.missing) console.log(`- ${asset}`);
		} else {
			console.log("✅ Visual assets complete");
		}
		console.log("\nDone 🎉");
	}
}

main().catch((error) => {
	console.error(`\nDialogue build failed: ${error.message}`);
	process.exitCode = 1;
});
