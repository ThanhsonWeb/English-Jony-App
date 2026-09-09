export function normalizeGrammarSentence(value = "") {
	return value
		.trim()
		.toLocaleLowerCase("en")
		.replace(/[’‘]/g, "'")
		.replace(/\s+/g, " ");
}

export function findGrammarNoteForTask(draft, task) {
	if (task.type !== "fillBlank" || !task.question) return undefined;

	let answerIndex = 0;
	const answers = Array.isArray(task.answers) ? task.answers : [task.answer];
	const completedQuestion = task.question.replace(
		/_{3,}/g,
		() => answers[answerIndex++] || "",
	);
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

			const [sentenceBefore = "", sentenceAfter = ""] =
				task.question.split(/_{3,}/);
			return {
				...sharedFields,
				sentenceBefore,
				sentenceAfter,
			};
		})
		.sort(
			(a, b) =>
				dialogueOrder.get(a.audioUrl) - dialogueOrder.get(b.audioUrl),
		)
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
