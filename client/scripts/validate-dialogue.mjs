import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { structureRules } from "./prompts/dialogue-rules.mjs";

const supportedTaskTypes = new Set([
	"fillBlank",
	"multipleChoice",
	"dialogueCloze",
]);

const practicePriorityRanges = Object.freeze({
	simple: { min: 1, max: 1 },
	important: { min: 2, max: 2 },
	veryImportant: { min: 2, max: 3 },
});

function isPresent(value) {
	return typeof value === "string" ? value.trim().length > 0 : value != null;
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

function isTranslationOnlyMultipleChoice(task, sourceLine) {
	return (
		isObviousTranslationQuestion(task.question) ||
		(isPresent(task.answer) &&
			normalizeVietnameseText(task.answer) ===
				normalizeVietnameseText(sourceLine?.translation))
	);
}

function isGrammarInContextQuestion(question) {
	return /(?:kiểu câu|cấu trúc|ngữ pháp|lịch sự|polite|grammar|vì sao (?:lại )?dùng|tại sao (?:lại )?dùng)/iu.test(
		String(question || ""),
	);
}

function getQuestionSimilarity(firstQuestion, secondQuestion) {
	const firstWords = new Set(normalizeVietnameseText(firstQuestion).split(" "));
	const secondWords = new Set(normalizeVietnameseText(secondQuestion).split(" "));

	firstWords.delete("");
	secondWords.delete("");

	if (firstWords.size === 0 || secondWords.size === 0) return 0;

	const sharedWords = [...firstWords].filter((word) => secondWords.has(word));
	const allWords = new Set([...firstWords, ...secondWords]);
	return sharedWords.length / allWords.size;
}

function getAnswerPosition(task) {
	if (!Array.isArray(task.options)) return -1;
	return task.options.findIndex((option) => option === task.answer);
}

function countFillBlankAnswers(task) {
	return Array.isArray(task.answers) ? task.answers.length : 0;
}

function getFillBlankTargets(task) {
	if (
		!Array.isArray(task.parts) ||
		!Array.isArray(task.answers) ||
		task.parts.length !== task.answers.length + 1
	) {
		return [];
	}

	let cursor = 0;
	return task.answers.map((answer, index) => {
		cursor += task.parts[index].length;
		const start = cursor;
		cursor += answer.length;
		return {
			normalized: normalizeText(answer),
			answer,
			start,
			end: cursor,
		};
	});
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

			if (part && typeof part === "object" && !Array.isArray(part)) {
				return part.blank || "";
			}

			return "";
		})
		.join("");
}

function validateDialogueClozeTask(task, dialogueLines, taskLabel, errors) {
	if (!Array.isArray(task.lines) || task.lines.length === 0) {
		errors.push(`${taskLabel}: dialogueCloze lines must be a non-empty array.`);
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
		const lineLabel = `${taskLabel}, dialogueCloze line ${lineIndex + 1}`;

		const sourceLine = dialogueLines[lineIndex];

		if (!line || typeof line !== "object" || Array.isArray(line)) {
			errors.push(`${lineLabel}: line must be an object.`);
			return;
		}

		if (!sourceLine) {
			errors.push(`${lineLabel}: no matching source dialogue line.`);
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

			if (!part || typeof part !== "object" || Array.isArray(part)) {
				errors.push(
					`${lineLabel}: part ${partIndex + 1} cannot be reconstructed.`,
				);
				return;
			}

			blankCount += 1;

			if (!isPresent(part.blank)) {
				errors.push(`${lineLabel}: blank ${blankCount} is missing blank text.`);
			}

			if (!isPresent(part.id)) {
				errors.push(`${lineLabel}: blank ${blankCount} is missing id.`);
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
			errors.push(`${lineLabel}: must contain at least one blank.`);
		}

		const reconstructed = reconstructDialogueClozeLine(line);

		if (reconstructed !== sourceLine.text) {
			errors.push(
				`${lineLabel}: completed cloze must reconstruct dialogue line ${sourceLine.id} exactly.`,
			);
		}
	});
}

export function validateDialogue(data, options = {}) {
	const usefulWordsRange = options.usefulWords || structureRules.usefulWords;

	const normalizedLevel = String(data?.metadata?.level || "").toLowerCase();
	const fillBlankRange =
		normalizedLevel === "a1" || normalizedLevel === "beginner"
			? structureRules.a1FillBlankRange
			: structureRules.fillBlankRange;

	const errors = [];
	const warnings = [];
	const mcReport = {
		total: 0,
		translationOnly: 0,
		answerPositionDistribution: { A: 0, B: 0, C: 0, D: 0 },
		grammarInContext: 0,
	};

	// ------------------------------------------------------------
	// Metadata
	// ------------------------------------------------------------

	if (!data?.metadata) {
		errors.push("Missing metadata.");
	}

	// ------------------------------------------------------------
	// Dialogue
	// ------------------------------------------------------------

	const dialogueLines = Array.isArray(data?.dialogue) ? data.dialogue : null;

	const dialogueById = new Map();

	if (!dialogueLines) {
		errors.push("dialogue must be an array.");
	} else {
		if (dialogueLines.length === 0) {
			errors.push("dialogue must contain at least one line.");
		}

		const speakerAudioCounts = new Map();
		const seenAudioUrls = new Set();

		dialogueLines.forEach((line, index) => {
			const label = `Dialogue line ${index + 1}`;

			if (!isPresent(line.id)) {
				errors.push(`${label}: missing id.`);
			} else if (!Number.isInteger(line.id) || line.id < 1) {
				errors.push(`${label}: id must be a positive integer.`);
			}

			if (line.id !== index + 1) {
				errors.push(`${label}: expected id ${index + 1}, found ${line.id}.`);
			}

			if (dialogueById.has(String(line.id))) {
				errors.push(`${label}: duplicate id "${line.id}".`);
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

			if (!isPresent(line.practicePriority)) {
				errors.push(`${label}: missing practicePriority.`);
			} else if (
				!Object.hasOwn(practicePriorityRanges, line.practicePriority)
			) {
				errors.push(
					`${label}: practicePriority must be simple, important, or veryImportant.`,
				);
			}

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

	// ------------------------------------------------------------
	// Useful Words
	// ------------------------------------------------------------

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
				if (!isPresent(item[field])) {
					errors.push(`${label}: missing ${field}.`);
				}
			}

			if (
				isPresent(item.word) &&
				!dialogueText.includes(normalizeText(item.word))
			) {
				errors.push(
					`${label}: "${item.word}" does not appear in the dialogue.`,
				);
			}
		});
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
			errors.push("The final task must be dialogueCloze.");
		}

		const practiceTasks =
			finalTask?.type === "dialogueCloze" ? tasks.slice(0, -1) : tasks;

		const dialogueClozeCount = tasks.filter(
			(task) => task.type === "dialogueCloze",
		).length;

		if (dialogueClozeCount !== 1) {
			errors.push(
				`Expected exactly 1 dialogueCloze task, found ${dialogueClozeCount}.`,
			);
		}

		const fillBlankCount = practiceTasks.filter(
			(task) => task.type === "fillBlank",
		).length;

		const multipleChoiceTasks = practiceTasks.filter(
			(task) => task.type === "multipleChoice",
		);
		const multipleChoiceCount = multipleChoiceTasks.length;

		if (practiceTasks.length > 0 && fillBlankCount <= multipleChoiceCount) {
			errors.push(
				`Fill Blank should be the main practice type; found ${fillBlankCount} Fill Blank and ${multipleChoiceCount} Multiple Choice tasks.`,
			);
		}

		const fillBlankTasksPerLine = new Map();
		const fillBlankTargetsPerLine = new Map();
		const seenTaskIds = new Set();
		const seenTasks = new Set();

		let previousLineIndex = -1;

		tasks.forEach((task, index) => {
			const taskLabel = `Task ${task.id ?? index + 1}`;

			// ----------------------------------------------------------
			// Task ID
			// ----------------------------------------------------------

			if (!isPresent(task.id)) {
				errors.push(`${taskLabel}: missing id.`);
			} else {
				const taskId = String(task.id);

				if (!Number.isInteger(task.id) || task.id < 1) {
					errors.push(`${taskLabel}: id must be a positive integer.`);
				}

				if (seenTaskIds.has(taskId)) {
					errors.push(`${taskLabel}: duplicate task id "${taskId}".`);
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
				errors.push(`${taskLabel}: unsupported type "${task.type}".`);
				return;
			}

			// ----------------------------------------------------------
			// Dialogue Cloze
			// ----------------------------------------------------------

			if (task.type === "dialogueCloze") {
				if (index !== tasks.length - 1) {
					errors.push(`${taskLabel}: dialogueCloze must be the final task.`);
				}

				validateDialogueClozeTask(task, dialogueLines || [], taskLabel, errors);

				return;
			}

			// ----------------------------------------------------------
			// dialogueLineId
			// ----------------------------------------------------------

			if (!isPresent(task.dialogueLineId)) {
				errors.push(`${taskLabel}: missing dialogueLineId.`);
				return;
			}

			const sourceLine = dialogueById.get(String(task.dialogueLineId));

			if (!sourceLine) {
				errors.push(
					`${taskLabel}: dialogueLineId "${task.dialogueLineId}" does not exist.`,
				);
				return;
			}

			// ----------------------------------------------------------
			// Forward dialogue flow
			// ----------------------------------------------------------

			if (sourceLine.index < previousLineIndex) {
				errors.push(
					`${taskLabel}: tasks must practice dialogue lines in forward order without returning to an earlier line.`,
				);
			}

			previousLineIndex = sourceLine.index;

			// ----------------------------------------------------------
			// Source consistency
			// ----------------------------------------------------------

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
					errors.push(
						`${taskLabel}: ${field} must match dialogue line ${task.dialogueLineId}.`,
					);
				}
			});

			// ----------------------------------------------------------
			// Fill Blank
			// ----------------------------------------------------------

			if (task.type === "fillBlank") {
				const lineKey = String(task.dialogueLineId);
				fillBlankTasksPerLine.set(
					lineKey,
					(fillBlankTasksPerLine.get(lineKey) || 0) + 1,
				);
				const blankCount = countFillBlankAnswers(task);

				if (
					blankCount < fillBlankRange.min ||
					blankCount > fillBlankRange.max
				) {
					errors.push(
						`${taskLabel}: Fill Blank must contain ${fillBlankRange.min}-${fillBlankRange.max} blanks for level ${normalizedLevel || "unknown"}.`,
					);
				}

				const hasParts = Array.isArray(task.parts);
				const hasAnswers = Array.isArray(task.answers);

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
					const hasValidParts = task.parts.every(
						(part) => typeof part === "string",
					);
					const hasValidAnswers = task.answers.every(
						(answer) => typeof answer === "string" && answer.length > 0,
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

					if (task.parts.length !== task.answers.length + 1) {
						errors.push(
							`${taskLabel}: parts must contain one more item than answers.`,
						);
					} else if (hasValidParts && hasValidAnswers) {
						const completedSentence = task.parts.reduce(
							(sentence, part, partIndex) =>
								sentence + part + (task.answers[partIndex] || ""),
							"",
						);

						if (completedSentence !== sourceLine.text) {
							errors.push(
								`${taskLabel}: Fill Blank fields must reconstruct dialogue line ${task.dialogueLineId} exactly.`,
							);
						}

						const targets = getFillBlankTargets(task);
						const previousTargets = fillBlankTargetsPerLine.get(lineKey) || [];

						for (const target of targets) {
							const duplicate = previousTargets.find(
								(previous) =>
									previous.normalized === target.normalized ||
									(previous.start < target.end && target.start < previous.end),
							);

							if (duplicate) {
								errors.push(
									`${taskLabel}: Fill Blank target "${target.answer}" overlaps a target already used for dialogue line ${task.dialogueLineId}.`,
								);
							}
						}

						fillBlankTargetsPerLine.set(lineKey, [
							...previousTargets,
							...targets,
						]);
					}
				}
			}

			// ----------------------------------------------------------
			// Multiple Choice
			// ----------------------------------------------------------

			if (task.type === "multipleChoice") {
				mcReport.total += 1;

				if (!isPresent(task.question)) {
					errors.push(`${taskLabel}: missing question.`);
				}

				if (!isPresent(task.answer)) {
					errors.push(`${taskLabel}: missing answer.`);
				}

				if (isTranslationOnlyMultipleChoice(task, sourceLine)) {
					mcReport.translationOnly += 1;
					errors.push(
						`${taskLabel}: Multiple Choice must not simply ask for the Vietnamese translation of dialogue line ${task.dialogueLineId}.`,
					);
				}

				if (isGrammarInContextQuestion(task.question)) {
					mcReport.grammarInContext += 1;
				}

				if (!Array.isArray(task.options) || task.options.length !== 4) {
					errors.push(`${taskLabel}: Multiple Choice must have exactly 4 options.`);
				} else {
					const normalizedOptions = task.options.map((option) =>
						normalizeVietnameseText(option),
					);
					const uniqueOptions = new Set(normalizedOptions);

					if (
						task.options.some((option) => !isPresent(option)) ||
						uniqueOptions.size !== task.options.length
					) {
						errors.push(
							`${taskLabel}: Multiple Choice options must be non-empty and unique.`,
						);
					}

					const answerOccurrences = task.options.filter(
						(option) => option === task.answer,
					).length;

					if (answerOccurrences !== 1) {
						errors.push(
							`${taskLabel}: answer must appear exactly once in options.`,
						);
					}

					const answerPosition = getAnswerPosition(task);
					if (answerPosition >= 0 && answerPosition <= 3) {
						const answerLetter = String.fromCharCode(65 + answerPosition);
						mcReport.answerPositionDistribution[answerLetter] += 1;
					}
				}
			}

			// ----------------------------------------------------------
			// Duplicate task detection
			// ----------------------------------------------------------

			const taskFingerprint = JSON.stringify({
				dialogueLineId: task.dialogueLineId,
				type: task.type,
				question: task.question,
				answer: task.answer,
				answers: task.answers,
				options: task.options,
				parts: task.parts,
			});

			if (seenTasks.has(taskFingerprint)) {
				errors.push(`${taskLabel}: exact duplicate task.`);
			}

			seenTasks.add(taskFingerprint);
		});

		// ------------------------------------------------------------
		// Multiple Choice quality and distribution
		// ------------------------------------------------------------

		const answerPositions = multipleChoiceTasks
			.map(getAnswerPosition)
			.filter((position) => position >= 0 && position <= 3);

		if (mcReport.grammarInContext > 2) {
			warnings.push(
				`Found ${mcReport.grammarInContext} detectable grammar-in-context Multiple Choice tasks; usually use no more than 2 per dialogue.`,
			);
		}

		if (
			multipleChoiceCount >= 4 &&
			answerPositions.length === multipleChoiceCount
		) {
			const mostUsedPosition = Math.max(
				...Object.values(mcReport.answerPositionDistribution),
			);

			if (mostUsedPosition / multipleChoiceCount > 0.6) {
				errors.push(
					`Multiple Choice correct-answer positions are too concentrated: A=${mcReport.answerPositionDistribution.A}, B=${mcReport.answerPositionDistribution.B}, C=${mcReport.answerPositionDistribution.C}, D=${mcReport.answerPositionDistribution.D}.`,
				);
			}

			if (
				answerPositions.length >= 8 &&
				new Set(answerPositions.slice(0, 4)).size === 4 &&
				answerPositions.every(
					(position, index) => position === answerPositions[index % 4],
				)
			) {
				warnings.push(
					"Multiple Choice correct-answer positions follow an obvious repeating four-position pattern.",
				);
			}
		}

		const multipleChoiceTasksPerLine = new Map();
		for (const task of multipleChoiceTasks) {
			const lineKey = String(task.dialogueLineId);
			const fillBlankTargets = fillBlankTargetsPerLine.get(lineKey) || [];
			const normalizedAnswer = normalizeText(task.answer);

			if (
				normalizedAnswer &&
				fillBlankTargets.some(
					(target) => target.normalized === normalizedAnswer,
				)
			) {
				warnings.push(
					`Task ${task.id}: Multiple Choice answer duplicates a Fill Blank target on dialogue line ${task.dialogueLineId}. Check that it tests a different skill.`,
				);
			}

			const sameLineTasks = multipleChoiceTasksPerLine.get(lineKey) || [];
			for (const previousTask of sameLineTasks) {
				const similarity = getQuestionSimilarity(
					previousTask.question,
					task.question,
				);
				const sameAnswer =
					normalizeVietnameseText(previousTask.answer) ===
					normalizeVietnameseText(task.answer);

				if (similarity >= 0.8 || (sameAnswer && similarity >= 0.5)) {
					warnings.push(
						`Tasks ${previousTask.id} and ${task.id}: Multiple Choice questions on dialogue line ${task.dialogueLineId} may test the same thing.`,
					);
				}
			}

			multipleChoiceTasksPerLine.set(lineKey, [...sameLineTasks, task]);
		}

		// ------------------------------------------------------------
		// Every dialogue line: 1–3 practice tasks
		// ------------------------------------------------------------

		dialogueLines?.forEach((line, index) => {
			const count = fillBlankTasksPerLine.get(String(line.id)) || 0;
			const priority = line.practicePriority || "simple";
			const range =
				practicePriorityRanges[priority] || practicePriorityRanges.simple;

			if (count < range.min || count > range.max) {
				errors.push(
					`Dialogue line ${index + 1} (${priority}): expected ${range.min}-${range.max} standalone Fill Blank tasks, found ${count}. Multiple Choice and Dialogue Cloze do not count.`,
				);
			}
		});
	}

	return {
		valid: errors.length === 0,
		errors,
		warnings,
		report: {
			...mcReport,
			validationResult: errors.length === 0 ? "passed" : "failed",
		},
	};
}

function printFailure(errors) {
	console.error("❌ Dialogue validation failed:\n");

	errors.forEach((error) => console.error(`- ${error}`));
}

function printWarnings(warnings) {
	if (warnings.length === 0) return;

	console.warn("\nWarnings:");
	warnings.forEach((warning) => console.warn(`- ${warning}`));
}

function printMcReport(report) {
	const positions = report.answerPositionDistribution;

	console.log("\nMultiple Choice report:");
	console.log(`- Total MC count: ${report.total}`);
	console.log(`- Translation-only MC count: ${report.translationOnly}`);
	console.log(
		`- Correct-answer positions: A=${positions.A}, B=${positions.B}, C=${positions.C}, D=${positions.D}`,
	);
	console.log(`- Grammar-in-context MC count: ${report.grammarInContext}`);
	console.log(`- Validation result: ${report.validationResult}`);
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
		printWarnings(result.warnings);
		printMcReport(result.report);
		return;
	}

	printFailure(result.errors);
	printWarnings(result.warnings);
	printMcReport(result.report);
	process.exitCode = 1;
}

const isRunDirectly =
	process.argv[1] &&
	import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isRunDirectly) {
	await runCli();
}
