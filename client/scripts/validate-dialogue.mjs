import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export function validateDialogue(data, options = {}) {
   // This is your quality-control robot. 🤖
  const {
    expectedDialogueLines = 12,
    expectedUsefulWords = 10,
  } = options;

  const errors = [];

  if (!data.metadata) {
    errors.push("Missing metadata.");
  }

  if (!Array.isArray(data.dialogue)) {
    errors.push("dialogue must be an array.");
  } else {
    if (data.dialogue.length !== expectedDialogueLines) {
      errors.push(
        `Expected ${expectedDialogueLines} dialogue lines, found ${data.dialogue.length}.`
      );
    }

    data.dialogue.forEach((line, index) => {
      if (!line.speaker) {
        errors.push(`Dialogue line ${index + 1}: missing speaker.`);
      }

      if (!line.text) {
        errors.push(`Dialogue line ${index + 1}: missing English text.`);
      }

      if (!line.translation) {
        errors.push(`Dialogue line ${index + 1}: missing translation.`);
      }

      if (!line.audioUrl) {
        errors.push(`Dialogue line ${index + 1}: missing audioUrl.`);
      }
    });
  }

  if (!Array.isArray(data.usefulWords)) {
    errors.push("usefulWords must be an array.");
  } else if (data.usefulWords.length !== expectedUsefulWords) {
    errors.push(
      `Expected ${expectedUsefulWords} useful words, found ${data.usefulWords.length}.`
    );
  }

  if (!Array.isArray(data.tasks)) {
    errors.push("tasks must be an array.");
  } else {
    data.tasks.forEach((task, index) => {
      if (task.id !== index + 1) {
        errors.push(
          `Task ${index + 1}: expected ID ${index + 1}, found ${task.id}.`
        );
      }

      if (!["fillBlank", "multipleChoice"].includes(task.type)) {
        errors.push(
          `Task ${task.id}: unsupported type "${task.type}".`
        );
      }

      if (!task.answer) {
        errors.push(`Task ${task.id}: missing answer.`);
      }

      if (task.type === "multipleChoice") {
        if (!Array.isArray(task.options)) {
          errors.push(`Task ${task.id}: options are missing.`);
        } else if (!task.options.includes(task.answer)) {
          errors.push(
            `Task ${task.id}: answer "${task.answer}" is not inside options.`
          );
        }
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function printFailure(errors) {
  console.error("❌ Dialogue validation failed:\n");
  errors.forEach((error) => console.error(`- ${error}`));
}

async function runCli() {
  const filePath = process.argv[2];

  if (!filePath) {
    printFailure(["No file path provided."]);
    process.exitCode = 1;
    return;
  }

  let fileContents;

  try {
    fileContents = await fs.readFile(filePath, "utf8");
  } catch (error) {
    const message =
      error.code === "ENOENT"
        ? `File not found: ${filePath}`
        : `Could not read file: ${error.message}`;

    printFailure([message]);
    process.exitCode = 1;
    return;
  }

  let data;

  try {
    data = JSON.parse(fileContents);
  } catch (error) {
    printFailure([`Invalid JSON: ${error.message}`]);
    process.exitCode = 1;
    return;
  }

  const result = validateDialogue(data);

  if (result.valid) {
    console.log("✅ Dialogue validation passed!");
    return;
  }

  printFailure(result.errors);
  process.exitCode = 1;
}

const isRunDirectly =
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isRunDirectly) {
  await runCli();
}
