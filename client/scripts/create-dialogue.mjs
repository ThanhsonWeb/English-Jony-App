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

	const { courseId, characters, level } = course;
	const { dialogueId, title, situation, thumbnail } = selectedDialogue;

	const lessonConfig = {
		courseId,
		dialogueId,
		title,
		characters,
		level,
		situation,
		thumbnail,
		dialogueLines: 12,
		taskCount: 17,
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
	console.log(`📁 ${promptPath}`);
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
