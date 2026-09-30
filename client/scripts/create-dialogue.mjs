import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import fs from "node:fs/promises";
import path from "node:path";

import { courseConfigs } from "./config/courses/index.mjs";
import { buildDialoguePrompt } from "./prompts/dialogue-generator.mjs";

const rl = readline.createInterface({
	input,
	output,
});

const ALLOWED_LEVELS = new Set(["a1", "a2", "b1", "b2"]);

function normalizeLevel(level) {
	const value = String(level || "").toLowerCase();

	if (value === "beginner") {
		return "a1";
	}

	return value;
}

async function chooseFromList(items, getLabel, question) {
	items.forEach((item, index) => {
		console.log(`${index + 1}. ${getLabel(item)}`);
	});

	const answer = await rl.question(`\n${question}`);
	const selectedIndex = Number(answer) - 1;

	if (!Number.isInteger(selectedIndex) || !items[selectedIndex]) {
		throw new Error("Invalid selection.");
	}

	return items[selectedIndex];
}

async function loadPreviousDialogue(courseId, dialogues, dialogueId) {
	const currentIndex = dialogues.findIndex(
		(dialogue) => dialogue.dialogueId === dialogueId,
	);
	if (currentIndex <= 0) return null;

	const previousDialogueId = dialogues[currentIndex - 1].dialogueId;
	const candidates = [
		path.resolve(
			"app",
			"[locale]",
			"(main)",
			"dialogue",
			"_data",
			"dialogues",
			courseId,
			`${previousDialogueId}.json`,
		),
		path.resolve(
			"generated",
			"dialogues",
			courseId,
			previousDialogueId,
			"draft.json",
		),
	];

	for (const candidate of candidates) {
		let contents;
		try {
			contents = await fs.readFile(candidate, "utf8");
		} catch (error) {
			if (error.code === "ENOENT") continue;
			throw error;
		}

		let previous;
		try {
			previous = JSON.parse(contents);
		} catch (error) {
			throw new Error(
				`Could not parse previous dialogue JSON at ${candidate}: ${error.message}`,
			);
		}

		if (
			previous?.metadata?.courseId !== courseId ||
			previous?.metadata?.dialogueId !== previousDialogueId ||
			!Array.isArray(previous.dialogue) ||
			previous.dialogue.length === 0
		) {
			throw new Error(
				`Previous dialogue JSON is missing valid dialogue data: ${candidate}`,
			);
		}

		return { dialogue: previous.dialogue, source: candidate };
	}

	throw new Error(
		`Could not find the previous dialogue JSON for ${courseId}/${previousDialogueId}.`,
	);
}

try {
	console.log("\n🔥 StudyJony Dialogue Builder\n");

	const course =
		courseConfigs.length === 1
			? courseConfigs[0]
			: await chooseFromList(
					courseConfigs,
					(item) => item.courseId,
					"Chọn khóa học: ",
				);

	console.log(`Khóa học: ${course.courseId}\n`);

	console.log("Các hội thoại có sẵn:");

	const selectedDialogue = await chooseFromList(
		course.dialogues,
		(item) => `${item.title} (${item.dialogueId})`,
		"Chọn hội thoại: ",
	);

	const { courseId, characters, level: courseLevel } = course;

	const { dialogueId, title, situation, thumbnail, scene, scenes } =
		selectedDialogue;
	const previousDialogueContext = await loadPreviousDialogue(
		courseId,
		course.dialogues,
		dialogueId,
	);

	// Optional CLI level:
	// npm run create:dialogue a1
	const cliLevel = process.argv[2];

	const level = normalizeLevel(cliLevel || courseLevel);

	if (!ALLOWED_LEVELS.has(level)) {
		throw new Error(`Invalid level "${level}". Use one of: a1, a2, b1, b2.`);
	}

	const lessonConfig = {
		courseId,
		dialogueId,
		title,
		courseTitle: course.title,
		courseDescription: course.description,
		characters,
		level,
		situation,
		thumbnail,

		// Normal dialogue: one shared scene
		scene,

		// Special dialogue: different scene per speaker
		scenes,
		previousDialogue: previousDialogueContext?.dialogue,
	};

	const prompt = buildDialoguePrompt(lessonConfig);

	const outputDirectory = path.join(
		process.cwd(),
		"generated",
		"dialogues",
		courseId,
		dialogueId,
	);

	await fs.mkdir(outputDirectory, {
		recursive: true,
	});

	const promptPath = path.join(outputDirectory, "generation-prompt.txt");

	await fs.writeFile(promptPath, prompt, "utf8");

	console.log("\n✅ Dialogue request created.");
	console.log(`🎯 Level: ${level}`);
	console.log(`📁 ${promptPath}`);

	if (scenes) {
		console.log("🎬 Speaker-specific scenes enabled.");
	}

	console.log("\nNext:");
	console.log("1. Send this prompt to the AI.");
	console.log("2. Save its JSON response.");
	console.log("3. Run validation.");
	console.log("4. Review before publishing.");
} catch (error) {
	console.error("\n❌ Dialogue creation failed:");
	console.error(error.message);
	process.exitCode = 1;
} finally {
	rl.close();
}
