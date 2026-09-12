export function normalizeGrammarSentence(value = "") {
	return value
		.trim()
		.toLocaleLowerCase("en")
		.replace(/[’‘]/g, "'")
		.replace(/\s+/g, " ");
}

function reconstructFillBlankSentence(task) {
	if (Array.isArray(task.parts) && Array.isArray(task.answers)) {
		return task.parts.reduce(
			(sentence, part, index) =>
				sentence + part + (task.answers[index] || ""),
			"",
		);
	}

	if (
		typeof task.sentenceBefore === "string" &&
		typeof task.sentenceAfter === "string" &&
		task.answer
	) {
		return task.sentenceBefore + task.answer + task.sentenceAfter;
	}

	if (!task.question) return "";

	let answerIndex = 0;
	const answers = Array.isArray(task.answers) ? task.answers : [task.answer];
	return task.question.replace(
		/_{3,}/g,
		() => answers[answerIndex++] || "",
	);
}

export function findGrammarNoteForTask(draft, task) {
	if (task.type !== "fillBlank") return undefined;

	const completedQuestion = reconstructFillBlankSentence(task);
	if (!completedQuestion) return undefined;
	const normalizedQuestion = normalizeGrammarSentence(completedQuestion);

	return draft.grammarNotes?.find((note) => {
		const englishExample = note.example?.split("=")[0] || "";
		return normalizeGrammarSentence(englishExample) === normalizedQuestion;
	});
}

export function buildGeneratedDialogueTasks(draft, characterImages) {
	const dialogueOrder = new Map(
		draft.dialogue.map((line, index) => [line.audioUrl, index]),
	);

	return draft.tasks
		.map((task) => {
			if (task.type === "dialogueCloze") {
				return {
					...task,
					id: String(task.id),
				};
			}

			const dialogueLine = draft.dialogue.find(
				(line) => line.audioUrl === task.audioUrl,
			);
			const sharedFields = {
				...task,
				id: String(task.id),
				title:
					task.type === "multipleChoice"
						? "Hiểu tình huống"
						: "Điền từ còn thiếu",
				instruction:
					task.type === "multipleChoice"
						? "Nghe và chọn đáp án đúng."
						: "Nghe và điền từ còn thiếu.",
				scene: draft.metadata.scene,
				character: dialogueLine
					? {
							name: dialogueLine.speaker,
							image: characterImages[dialogueLine.speaker],
						}
					: undefined,
				transcript: dialogueLine?.text,
				grammar: findGrammarNoteForTask(draft, task),
			};

			if (task.type !== "fillBlank") return sharedFields;
			if (
				(Array.isArray(task.parts) && Array.isArray(task.answers)) ||
				(typeof task.sentenceBefore === "string" &&
					typeof task.sentenceAfter === "string")
			) {
				return sharedFields;
			}

			const [sentenceBefore = "", sentenceAfter = ""] =
				task.question.split(/_{3,}/);
			return {
				...sharedFields,
				sentenceBefore,
				sentenceAfter,
			};
		})
		.sort((a, b) => {
			if (a.type === "dialogueCloze") {
				return b.type === "dialogueCloze" ? 0 : 1;
			}
			if (b.type === "dialogueCloze") return -1;

			return dialogueOrder.get(a.audioUrl) - dialogueOrder.get(b.audioUrl);
		})
		.map((task, index) => ({ ...task, id: String(index + 1) }));
}

export function buildGeneratedDialogue(draft, characterImages) {
	return {
		...draft,
		id: draft.metadata.dialogueId,
		thumbnail: draft.metadata.thumbnail,
		title: draft.metadata.title,
		description: draft.metadata.situation,
		scene: draft.metadata.scene,
		characters: characterImages,
		tasks: buildGeneratedDialogueTasks(draft, characterImages),
	};
}
