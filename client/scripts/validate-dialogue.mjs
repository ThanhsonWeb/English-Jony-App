import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { structureRules } from "./prompts/dialogue-rules.mjs";

const supportedTaskTypes = new Set(["fillBlank", "multipleChoice"]);

function isPresent(value) {
  return typeof value === "string" ? value.trim().length > 0 : value != null;
}

function countFillBlankAnswers(task) {
  if (Array.isArray(task.answers)) return task.answers.length;
  if (
    typeof task.sentenceBefore === "string" &&
    typeof task.sentenceAfter === "string" &&
    isPresent(task.answer)
  ) {
    return 1;
  }
  if (Array.isArray(task.parts)) {
    return task.parts.filter((part) => typeof part === "object").length || 1;
  }

  const blankMarkers = String(task.question || "").match(/_{2,}|\{\{blank\}\}/gi);
  return blankMarkers?.length || 0;
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9' ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function validateDialogue(data, options = {}) {
  const dialogueRange = options.dialogueLines || structureRules.dialogueLines;
  const usefulWordsRange = options.usefulWords || structureRules.usefulWords;
  const taskRange = options.tasks || structureRules.tasks;
  const errors = [];

  if (!data?.metadata) errors.push("Missing metadata.");

  const dialogueLines = Array.isArray(data?.dialogue) ? data.dialogue : null;
  const dialogueById = new Map();

  if (!dialogueLines) {
    errors.push("dialogue must be an array.");
  } else {
    if (
      dialogueLines.length < dialogueRange.min ||
      dialogueLines.length > dialogueRange.max
    ) {
      errors.push(
        `Dialogue must contain ${dialogueRange.min}-${dialogueRange.max} lines, found ${dialogueLines.length}.`,
      );
    }

    const speakerAudioCounts = new Map();
    const seenAudioUrls = new Set();

    dialogueLines.forEach((line, index) => {
      const label = `Dialogue line ${index + 1}`;
      if (!isPresent(line.id)) errors.push(`${label}: missing id.`);
      if (dialogueById.has(String(line.id))) {
        errors.push(`${label}: duplicate id "${line.id}".`);
      } else if (isPresent(line.id)) {
        dialogueById.set(String(line.id), { ...line, index });
      }
      if (!isPresent(line.speaker)) errors.push(`${label}: missing speaker.`);
      if (!isPresent(line.text)) errors.push(`${label}: missing English text.`);
      if (!isPresent(line.translation)) errors.push(`${label}: missing translation.`);
      if (!isPresent(line.audioUrl)) {
        errors.push(`${label}: missing audioUrl.`);
      } else if (seenAudioUrls.has(line.audioUrl)) {
        errors.push(`${label}: audioUrl must be unique per dialogue line.`);
      } else {
        seenAudioUrls.add(line.audioUrl);
      }

      if (isPresent(line.speaker) && isPresent(line.audioUrl)) {
        const speakerKey = normalizeText(line.speaker).replace(/\s+/g, "-");
        const appearance = (speakerAudioCounts.get(speakerKey) || 0) + 1;
        speakerAudioCounts.set(speakerKey, appearance);
        const expectedFile = `${speakerKey}-${String(appearance).padStart(2, "0")}.mp3`;
        if (!line.audioUrl.endsWith(`/${expectedFile}`)) {
          errors.push(
            `${label}: expected speaker audio numbering to end with "${expectedFile}".`,
          );
        }
      }
    });
  }

  if (!Array.isArray(data?.usefulWords)) {
    errors.push("usefulWords must be an array.");
  } else {
    if (
      data.usefulWords.length < usefulWordsRange.min ||
      data.usefulWords.length > usefulWordsRange.max
    ) {
      errors.push(
        `usefulWords must contain ${usefulWordsRange.min}-${usefulWordsRange.max} items, found ${data.usefulWords.length}.`,
      );
    }

    const dialogueText = normalizeText(
      dialogueLines?.map((line) => line.text).join(" "),
    );
    data.usefulWords.forEach((item, index) => {
      const label = `Useful word ${index + 1}`;
      for (const field of ["word", "pronunciation", "meaning", "example"]) {
        if (!isPresent(item[field])) errors.push(`${label}: missing ${field}.`);
      }
      if (isPresent(item.word) && !dialogueText.includes(normalizeText(item.word))) {
        errors.push(`${label}: "${item.word}" does not appear in the dialogue.`);
      }
    });
  }

  if (!Array.isArray(data?.tasks)) {
    errors.push("tasks must be an array.");
  } else {
    const tasks = data.tasks;
    if (tasks.length < taskRange.min || tasks.length > taskRange.max) {
      errors.push(
        `Tasks must contain ${taskRange.min}-${taskRange.max} items, found ${tasks.length}.`,
      );
    }

    const fillBlankCount = tasks.filter((task) => task.type === "fillBlank").length;
    const multipleChoiceCount = tasks.filter(
      (task) => task.type === "multipleChoice",
    ).length;
    const minimumQuizCount = Math.ceil(
      tasks.length * structureRules.multipleChoiceRatio,
    );

    if (fillBlankCount <= tasks.length / 2) {
      errors.push(
        `Fill Blank must be the majority; found ${fillBlankCount} of ${tasks.length} tasks.`,
      );
    }
    if (multipleChoiceCount < minimumQuizCount) {
      errors.push(
        `Multiple Choice must be at least 30%; expected at least ${minimumQuizCount}, found ${multipleChoiceCount}.`,
      );
    }

    const tasksPerLine = new Map();
    const seenTasks = new Set();
    let previousLineIndex = -1;

    tasks.forEach((task, index) => {
      const taskLabel = `Task ${task.id ?? index + 1}`;
      if (task.id !== index + 1) {
        errors.push(`${taskLabel}: expected ID ${index + 1}, found ${task.id}.`);
      }
      if (!supportedTaskTypes.has(task.type)) {
        errors.push(`${taskLabel}: unsupported type "${task.type}".`);
      }
      if (task.type !== "fillBlank" && !isPresent(task.answer)) {
        errors.push(`${taskLabel}: missing answer.`);
      }
      if (!isPresent(task.dialogueLineId)) {
        errors.push(`${taskLabel}: missing dialogueLineId.`);
      }

      const sourceLine = dialogueById.get(String(task.dialogueLineId));
      if (isPresent(task.dialogueLineId) && !sourceLine) {
        errors.push(
          `${taskLabel}: dialogueLineId "${task.dialogueLineId}" does not exist.`,
        );
      }

      if (sourceLine) {
        if (sourceLine.index < previousLineIndex) {
          errors.push(
            `${taskLabel}: tasks must practice each dialogue line before moving to the next.`,
          );
        }
        previousLineIndex = sourceLine.index;
        tasksPerLine.set(
          String(task.dialogueLineId),
          (tasksPerLine.get(String(task.dialogueLineId)) || 0) + 1,
        );

        const expectedScene = sourceLine.scene || data.metadata?.scene;
        const sourceFields = {
          speaker: sourceLine.speaker,
          transcript: sourceLine.text,
          scene: expectedScene,
          audioUrl: sourceLine.audioUrl,
        };
        Object.entries(sourceFields).forEach(([field, expected]) => {
          if (!isPresent(task[field])) {
            errors.push(`${taskLabel}: missing ${field}.`);
          } else if (task[field] !== expected) {
            errors.push(`${taskLabel}: ${field} must match dialogue line ${task.dialogueLineId}.`);
          }
        });
      }

      if (task.type === "fillBlank") {
        const blankCount = countFillBlankAnswers(task);
        if (
          blankCount < structureRules.fillBlankRange.min ||
          blankCount > structureRules.fillBlankRange.max
        ) {
          errors.push(`${taskLabel}: Fill Blank must contain 1-3 blanks.`);
        }

        const isMultiBlank =
          Array.isArray(task.parts) && Array.isArray(task.answers);
        const isSingleBlank =
          typeof task.sentenceBefore === "string" &&
          typeof task.sentenceAfter === "string" &&
          isPresent(task.answer);
        const isLegacyBlank = isPresent(task.question) && isPresent(task.answer);

        if (!isMultiBlank && !isSingleBlank && !isLegacyBlank) {
          errors.push(`${taskLabel}: Fill Blank schema is invalid.`);
        }

        let completedSentence = "";
        if (isMultiBlank) {
          if (task.parts.length !== task.answers.length + 1) {
            errors.push(
              `${taskLabel}: parts must contain one more item than answers.`,
            );
          } else {
            completedSentence = task.parts.reduce(
              (sentence, part, partIndex) =>
                sentence + part + (task.answers[partIndex] || ""),
              "",
            );
          }
        } else if (isSingleBlank) {
          completedSentence =
            task.sentenceBefore + task.answer + task.sentenceAfter;
        } else if (isLegacyBlank) {
          completedSentence = String(task.question).replace(
            /_{2,}|\{\{blank\}\}/i,
            task.answer,
          );
        }

        if (sourceLine && completedSentence) {
          if (completedSentence !== sourceLine.text) {
            errors.push(
              `${taskLabel}: Fill Blank fields must reconstruct dialogue line ${task.dialogueLineId} exactly.`,
            );
          }
        }
      }

      if (task.type === "multipleChoice") {
        if (!Array.isArray(task.options)) {
          errors.push(`${taskLabel}: options are missing.`);
        } else {
          const answerOccurrences = task.options.filter(
            (option) => option === task.answer,
          ).length;
          if (answerOccurrences !== 1) {
            errors.push(
              `${taskLabel}: answer must appear exactly once in options.`,
            );
          }
        }
      }

      const taskFingerprint = JSON.stringify({
        dialogueLineId: task.dialogueLineId,
        type: task.type,
        question: task.question,
        answer: task.answer,
        answers: task.answers,
        options: task.options,
      });
      if (seenTasks.has(taskFingerprint)) {
        errors.push(`${taskLabel}: exact duplicate task.`);
      }
      seenTasks.add(taskFingerprint);
    });

    dialogueLines?.forEach((line, index) => {
      const count = tasksPerLine.get(String(line.id)) || 0;
      if (count < 1 || count > 3) {
        errors.push(
          `Dialogue line ${index + 1}: expected 1-3 practice tasks, found ${count}.`,
        );
      }
    });
  }

  return { valid: errors.length === 0, errors };
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
    printFailure([
      error.code === "ENOENT"
        ? `File not found: ${filePath}`
        : `Could not read file: ${error.message}`,
    ]);
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

if (isRunDirectly) await runCli();
