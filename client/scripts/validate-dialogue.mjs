import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { structureRules } from "./prompts/dialogue-rules.mjs";

const supportedTaskTypes = new Set([
  "fillBlank",
  "multipleChoice",
  "dialogueCloze",
]);

function isPresent(value) {
  return typeof value === "string"
    ? value.trim().length > 0
    : value != null;
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9' ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeVietnameseText(value) {
  return String(value || "")
    .toLocaleLowerCase("vi")
    .replace(/[^\p{L}\p{N}' ]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isObviousTranslationQuestion(question) {
  return /(?:dịch|nghĩa|có nghĩa|muốn nói gì|tiếng việt|translation|mean in vietnamese)/iu.test(
    String(question || ""),
  );
}

function countFillBlankAnswers(task) {
  return Array.isArray(task.answers)
    ? task.answers.length
    : 0;
}

function reconstructDialogueClozeLine(line) {
  if (!Array.isArray(line.parts)) {
    return "";
  }

  return line.parts
    .map((part) => {
      if (typeof part === "string") {
        return part;
      }

      if (
        part &&
        typeof part === "object" &&
        !Array.isArray(part)
      ) {
        return part.blank || "";
      }

      return "";
    })
    .join("");
}

function validateDialogueClozeTask(
  task,
  dialogueLines,
  taskLabel,
  errors,
) {
  if (!Array.isArray(task.lines) || task.lines.length === 0) {
    errors.push(
      `${taskLabel}: dialogueCloze lines must be a non-empty array.`,
    );
    return;
  }

  if (task.lines.length !== dialogueLines.length) {
    errors.push(
      `${taskLabel}: dialogueCloze must include all ${dialogueLines.length} dialogue lines.`,
    );
  }

  const blankIds = new Set();
  let expectedBlankId = 1;

  task.lines.forEach((line, lineIndex) => {
    const lineLabel =
      `${taskLabel}, dialogueCloze line ${lineIndex + 1}`;

    const sourceLine = dialogueLines[lineIndex];

    if (!line || typeof line !== "object" || Array.isArray(line)) {
      errors.push(`${lineLabel}: line must be an object.`);
      return;
    }

    if (!sourceLine) {
      errors.push(
        `${lineLabel}: no matching source dialogue line.`,
      );
      return;
    }

    if (String(line.dialogueLineId) !== String(sourceLine.id)) {
      errors.push(
        `${lineLabel}: dialogueLineId must match dialogue line ${sourceLine.id}.`,
      );
    }

    if (line.speaker !== sourceLine.speaker) {
      errors.push(
        `${lineLabel}: speaker must match dialogue line ${sourceLine.id}.`,
      );
    }

    if (!Array.isArray(line.parts)) {
      errors.push(`${lineLabel}: parts must be an array.`);
      return;
    }

    let blankCount = 0;

    line.parts.forEach((part, partIndex) => {
      if (typeof part === "string") {
        return;
      }

      if (
        !part ||
        typeof part !== "object" ||
        Array.isArray(part)
      ) {
        errors.push(
          `${lineLabel}: part ${partIndex + 1} cannot be reconstructed.`,
        );
        return;
      }

      blankCount += 1;

      if (!isPresent(part.blank)) {
        errors.push(
          `${lineLabel}: blank ${blankCount} is missing blank text.`,
        );
      }

      if (!isPresent(part.id)) {
        errors.push(
          `${lineLabel}: blank ${blankCount} is missing id.`,
        );
        return;
      }

      const blankId = String(part.id);

      if (blankIds.has(blankId)) {
        errors.push(
          `${taskLabel}: duplicate dialogueCloze blank id "${blankId}".`,
        );
      }

      blankIds.add(blankId);

      if (blankId !== String(expectedBlankId)) {
        errors.push(
          `${lineLabel}: expected blank id "${expectedBlankId}", found "${blankId}".`,
        );
      }

      expectedBlankId += 1;
    });

    if (blankCount === 0) {
      errors.push(
        `${lineLabel}: must contain at least one blank.`,
      );
    }

    const reconstructed =
      reconstructDialogueClozeLine(line);

    if (reconstructed !== sourceLine.text) {
      errors.push(
        `${lineLabel}: completed cloze must reconstruct dialogue line ${sourceLine.id} exactly.`,
      );
    }
  });
}

export function validateDialogue(data, options = {}) {
  const usefulWordsRange =
    options.usefulWords || structureRules.usefulWords;

  const normalizedLevel = String(
    data?.metadata?.level || "",
  ).toLowerCase();
  const fillBlankRange =
    normalizedLevel === "a1" ||
    normalizedLevel === "beginner"
      ? structureRules.a1FillBlankRange
      : structureRules.fillBlankRange;

  const errors = [];

  // ------------------------------------------------------------
  // Metadata
  // ------------------------------------------------------------

  if (!data?.metadata) {
    errors.push("Missing metadata.");
  }

  // ------------------------------------------------------------
  // Dialogue
  // ------------------------------------------------------------

  const dialogueLines = Array.isArray(data?.dialogue)
    ? data.dialogue
    : null;

  const dialogueById = new Map();

  if (!dialogueLines) {
    errors.push("dialogue must be an array.");
  } else {
    if (dialogueLines.length === 0) {
      errors.push(
        "dialogue must contain at least one line.",
      );
    }

    const speakerAudioCounts = new Map();
    const seenAudioUrls = new Set();

    dialogueLines.forEach((line, index) => {
      const label = `Dialogue line ${index + 1}`;

      if (!isPresent(line.id)) {
        errors.push(`${label}: missing id.`);
      } else if (
        !Number.isInteger(line.id) ||
        line.id < 1
      ) {
        errors.push(
          `${label}: id must be a positive integer.`,
        );
      }

      if (line.id !== index + 1) {
        errors.push(
          `${label}: expected id ${index + 1}, found ${line.id}.`,
        );
      }

      if (dialogueById.has(String(line.id))) {
        errors.push(
          `${label}: duplicate id "${line.id}".`,
        );
      } else if (isPresent(line.id)) {
        dialogueById.set(String(line.id), {
          ...line,
          index,
        });
      }

      if (!isPresent(line.speaker)) {
        errors.push(`${label}: missing speaker.`);
      }

      if (!isPresent(line.text)) {
        errors.push(`${label}: missing English text.`);
      }

      if (!isPresent(line.translation)) {
        errors.push(`${label}: missing translation.`);
      }

      if (!isPresent(line.audioUrl)) {
        errors.push(`${label}: missing audioUrl.`);
      } else if (seenAudioUrls.has(line.audioUrl)) {
        errors.push(
          `${label}: audioUrl must be unique per dialogue line.`,
        );
      } else {
        seenAudioUrls.add(line.audioUrl);
      }

      if (
        isPresent(line.speaker) &&
        isPresent(line.audioUrl)
      ) {
        const speakerKey = normalizeText(
          line.speaker,
        ).replace(/\s+/g, "-");

        const appearance =
          (speakerAudioCounts.get(speakerKey) || 0) + 1;

        speakerAudioCounts.set(
          speakerKey,
          appearance,
        );

        const expectedFile =
          `${speakerKey}-${String(appearance).padStart(2, "0")}.mp3`;

        if (
          !line.audioUrl.endsWith(
            `/${expectedFile}`,
          )
        ) {
          errors.push(
            `${label}: expected speaker audio numbering to end with "${expectedFile}".`,
          );
        }
      }
    });
  }

  // ------------------------------------------------------------
  // Useful Words
  // ------------------------------------------------------------

  if (!Array.isArray(data?.usefulWords)) {
    errors.push("usefulWords must be an array.");
  } else {
    if (
      data.usefulWords.length <
        usefulWordsRange.min ||
      data.usefulWords.length >
        usefulWordsRange.max
    ) {
      errors.push(
        `usefulWords must contain ${usefulWordsRange.min}-${usefulWordsRange.max} items, found ${data.usefulWords.length}.`,
      );
    }

    const dialogueText = normalizeText(
      dialogueLines
        ?.map((line) => line.text)
        .join(" "),
    );

    data.usefulWords.forEach(
      (item, index) => {
        const label =
          `Useful word ${index + 1}`;

        for (const field of [
          "word",
          "pronunciation",
          "meaning",
          "example",
        ]) {
          if (!isPresent(item[field])) {
            errors.push(
              `${label}: missing ${field}.`,
            );
          }
        }

        if (
          isPresent(item.word) &&
          !dialogueText.includes(
            normalizeText(item.word),
          )
        ) {
          errors.push(
            `${label}: "${item.word}" does not appear in the dialogue.`,
          );
        }
      },
    );
  }

  // ------------------------------------------------------------
  // Tasks
  // ------------------------------------------------------------

  if (!Array.isArray(data?.tasks)) {
    errors.push("tasks must be an array.");
  } else if (data.tasks.length === 0) {
    errors.push("tasks must not be empty.");
  } else {
    const tasks = data.tasks;

    const finalTask = tasks.at(-1);

    if (finalTask?.type !== "dialogueCloze") {
      errors.push(
        "The final task must be dialogueCloze.",
      );
    }

    const practiceTasks =
      finalTask?.type === "dialogueCloze"
        ? tasks.slice(0, -1)
        : tasks;

    const dialogueClozeCount =
      tasks.filter(
        (task) =>
          task.type === "dialogueCloze",
      ).length;

    if (dialogueClozeCount !== 1) {
      errors.push(
        `Expected exactly 1 dialogueCloze task, found ${dialogueClozeCount}.`,
      );
    }

    const fillBlankCount =
      practiceTasks.filter(
        (task) =>
          task.type === "fillBlank",
      ).length;

    const multipleChoiceCount =
      practiceTasks.filter(
        (task) =>
          task.type === "multipleChoice",
      ).length;

    if (
      practiceTasks.length > 0 &&
      fillBlankCount <=
        multipleChoiceCount
    ) {
      errors.push(
        `Fill Blank should be the main practice type; found ${fillBlankCount} Fill Blank and ${multipleChoiceCount} Multiple Choice tasks.`,
      );
    }

    const tasksPerLine = new Map();
    const seenTaskIds = new Set();
    const seenTasks = new Set();

    let previousLineIndex = -1;

    tasks.forEach((task, index) => {
      const taskLabel =
        `Task ${task.id ?? index + 1}`;

      // ----------------------------------------------------------
      // Task ID
      // ----------------------------------------------------------

      if (!isPresent(task.id)) {
        errors.push(
          `${taskLabel}: missing id.`,
        );
      } else {
        const taskId = String(task.id);

        if (
          !Number.isInteger(task.id) ||
          task.id < 1
        ) {
          errors.push(
            `${taskLabel}: id must be a positive integer.`,
          );
        }

        if (seenTaskIds.has(taskId)) {
          errors.push(
            `${taskLabel}: duplicate task id "${taskId}".`,
          );
        }

        seenTaskIds.add(taskId);

        if (task.id !== index + 1) {
          errors.push(
            `${taskLabel}: expected ID ${index + 1}, found ${task.id}.`,
          );
        }
      }

      // ----------------------------------------------------------
      // Type
      // ----------------------------------------------------------

      if (!supportedTaskTypes.has(task.type)) {
        errors.push(
          `${taskLabel}: unsupported type "${task.type}".`,
        );
        return;
      }

      // ----------------------------------------------------------
      // Dialogue Cloze
      // ----------------------------------------------------------

      if (task.type === "dialogueCloze") {
        if (index !== tasks.length - 1) {
          errors.push(
            `${taskLabel}: dialogueCloze must be the final task.`,
          );
        }

        validateDialogueClozeTask(
          task,
          dialogueLines || [],
          taskLabel,
          errors,
        );

        return;
      }

      // ----------------------------------------------------------
      // dialogueLineId
      // ----------------------------------------------------------

      if (
        !isPresent(task.dialogueLineId)
      ) {
        errors.push(
          `${taskLabel}: missing dialogueLineId.`,
        );
        return;
      }

      const sourceLine =
        dialogueById.get(
          String(task.dialogueLineId),
        );

      if (!sourceLine) {
        errors.push(
          `${taskLabel}: dialogueLineId "${task.dialogueLineId}" does not exist.`,
        );
        return;
      }

      // ----------------------------------------------------------
      // Forward dialogue flow
      // ----------------------------------------------------------

      if (
        sourceLine.index <
        previousLineIndex
      ) {
        errors.push(
          `${taskLabel}: tasks must practice dialogue lines in forward order without returning to an earlier line.`,
        );
      }

      previousLineIndex =
        sourceLine.index;

      tasksPerLine.set(
        String(task.dialogueLineId),
        (tasksPerLine.get(
          String(task.dialogueLineId),
        ) || 0) + 1,
      );

      // ----------------------------------------------------------
      // Source consistency
      // ----------------------------------------------------------

      const expectedScene =
        sourceLine.scene ||
        data.metadata?.scene;

      const sourceFields = {
        speaker: sourceLine.speaker,
        transcript: sourceLine.text,
        scene: expectedScene,
        audioUrl: sourceLine.audioUrl,
      };

      Object.entries(
        sourceFields,
      ).forEach(
        ([field, expected]) => {
          if (!isPresent(task[field])) {
            errors.push(
              `${taskLabel}: missing ${field}.`,
            );
          } else if (
            task[field] !== expected
          ) {
            errors.push(
              `${taskLabel}: ${field} must match dialogue line ${task.dialogueLineId}.`,
            );
          }
        },
      );

      // ----------------------------------------------------------
      // Fill Blank
      // ----------------------------------------------------------

      if (task.type === "fillBlank") {
        const blankCount =
          countFillBlankAnswers(task);

        if (
          blankCount <
            fillBlankRange.min ||
          blankCount >
            fillBlankRange.max
        ) {
          errors.push(
            `${taskLabel}: Fill Blank must contain ${fillBlankRange.min}-${fillBlankRange.max} blanks for level ${normalizedLevel || "unknown"}.`,
          );
        }

        const hasParts =
          Array.isArray(task.parts);
        const hasAnswers =
          Array.isArray(task.answers);

        if (!hasParts || !hasAnswers) {
          errors.push(
            `${taskLabel}: Fill Blank requires parts and answers arrays.`,
          );
        }

        if (Object.hasOwn(task, "question")) {
          errors.push(
            `${taskLabel}: Fill Blank must use parts instead of question.`,
          );
        }

        if (hasParts && hasAnswers) {
          const hasValidParts =
            task.parts.every(
              (part) =>
                typeof part === "string",
            );
          const hasValidAnswers =
            task.answers.every(
              (answer) =>
                typeof answer === "string" &&
                answer.length > 0,
            );

          if (!hasValidParts) {
            errors.push(
              `${taskLabel}: every Fill Blank part must be a string.`,
            );
          }

          if (!hasValidAnswers) {
            errors.push(
              `${taskLabel}: every Fill Blank answer must be a non-empty string.`,
            );
          }

          if (
            task.parts.length !==
            task.answers.length + 1
          ) {
            errors.push(
              `${taskLabel}: parts must contain one more item than answers.`,
            );
          } else if (
            hasValidParts &&
            hasValidAnswers
          ) {
            const completedSentence =
              task.parts.reduce(
                (
                  sentence,
                  part,
                  partIndex,
                ) =>
                  sentence +
                  part +
                  (task.answers[
                    partIndex
                  ] || ""),
                "",
              );

            if (
              completedSentence !==
                sourceLine.text
            ) {
              errors.push(
                `${taskLabel}: Fill Blank fields must reconstruct dialogue line ${task.dialogueLineId} exactly.`,
              );
            }
          }
        }
      }

      // ----------------------------------------------------------
      // Multiple Choice
      // ----------------------------------------------------------

      if (
        task.type ===
        "multipleChoice"
      ) {
        if (!isPresent(task.question)) {
          errors.push(
            `${taskLabel}: missing question.`,
          );
        }

        if (!isPresent(task.answer)) {
          errors.push(
            `${taskLabel}: missing answer.`,
          );
        }

        if (
          isObviousTranslationQuestion(
            task.question,
          ) &&
          normalizeVietnameseText(
            task.answer,
          ) ===
            normalizeVietnameseText(
              sourceLine.translation,
            )
        ) {
          errors.push(
            `${taskLabel}: Multiple Choice must not simply ask for the Vietnamese translation of dialogue line ${task.dialogueLineId}.`,
          );
        }

        if (
          !Array.isArray(
            task.options,
          ) ||
          task.options.length < 2
        ) {
          errors.push(
            `${taskLabel}: options are missing or invalid.`,
          );
        } else {
          const answerOccurrences =
            task.options.filter(
              (option) =>
                option === task.answer,
            ).length;

          if (
            answerOccurrences !== 1
          ) {
            errors.push(
              `${taskLabel}: answer must appear exactly once in options.`,
            );
          }
        }
      }

      // ----------------------------------------------------------
      // Duplicate task detection
      // ----------------------------------------------------------

      const taskFingerprint =
        JSON.stringify({
          dialogueLineId:
            task.dialogueLineId,
          type: task.type,
          question: task.question,
          answer: task.answer,
          answers: task.answers,
          options: task.options,
          parts: task.parts,
        });

      if (
        seenTasks.has(
          taskFingerprint,
        )
      ) {
        errors.push(
          `${taskLabel}: exact duplicate task.`,
        );
      }

      seenTasks.add(taskFingerprint);
    });

    // ------------------------------------------------------------
    // Every dialogue line: 1–3 practice tasks
    // ------------------------------------------------------------

    dialogueLines?.forEach(
      (line, index) => {
        const count =
          tasksPerLine.get(
            String(line.id),
          ) || 0;

        if (
          count < 1 ||
          count > 3
        ) {
          errors.push(
            `Dialogue line ${index + 1}: expected 1-3 practice tasks, found ${count}.`,
          );
        }
      },
    );

    if (
      dialogueLines &&
      practiceTasks.length >
        dialogueLines.length &&
      !Array.from(
        tasksPerLine.values(),
      ).some((count) => count > 1)
    ) {
      errors.push(
        "When practice task count exceeds dialogue-line count, at least one important line must receive multiple distinct tasks.",
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function printFailure(errors) {
  console.error(
    "❌ Dialogue validation failed:\n",
  );

  errors.forEach((error) =>
    console.error(`- ${error}`),
  );
}

async function runCli() {
  const filePath = process.argv[2];

  if (!filePath) {
    printFailure([
      "No file path provided.",
    ]);

    process.exitCode = 1;
    return;
  }

  let fileContents;

  try {
    fileContents =
      await fs.readFile(
        filePath,
        "utf8",
      );
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
    data =
      JSON.parse(fileContents);
  } catch (error) {
    printFailure([
      `Invalid JSON: ${error.message}`,
    ]);

    process.exitCode = 1;
    return;
  }

  const result =
    validateDialogue(data);

  if (result.valid) {
    console.log(
      "✅ Dialogue validation passed!",
    );
    return;
  }

  printFailure(result.errors);
  process.exitCode = 1;
}

const isRunDirectly =
  process.argv[1] &&
  import.meta.url ===
    pathToFileURL(
      path.resolve(process.argv[1]),
    ).href;

if (isRunDirectly) {
  await runCli();
}
