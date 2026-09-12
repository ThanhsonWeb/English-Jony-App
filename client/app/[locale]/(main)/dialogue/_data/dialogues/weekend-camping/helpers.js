function orderDialogueTasks(tasks, orderedTaskIds) {
	return orderedTaskIds.map((taskId, index) => ({
		...tasks.find((task) => task.id === taskId),
		id: String(index + 1),
	}));
}

const weekendCampingCharacterImages = {
	Leo: "/dialogue/weekend-camping/shared/leo.png",
	Mia: "/dialogue/weekend-camping/shared/mia.png",
};

function weekendCampingFillBlankTask(
	id,
	dialogueId,
	speaker,
	audioIndex,
	transcript,
	sentenceBefore,
	answer,
	sentenceAfter,
) {
	return {
		id,
		type: "fillBlank",
		title: "Điền từ còn thiếu",
		instruction: "Nghe và điền từ còn thiếu.",
		scene: `/dialogue/weekend-camping/${dialogueId}/bg.png`,
		character: {
			name: speaker,
			image: weekendCampingCharacterImages[speaker],
		},
		audioUrl: `/dialogue/weekend-camping/${dialogueId}/audio/${speaker.toLowerCase()}-${String(audioIndex).padStart(2, "0")}.mp3`,
		transcript,
		sentenceBefore,
		sentenceAfter,
		answer,
	};
}

export {
	orderDialogueTasks,
	weekendCampingCharacterImages,
	weekendCampingFillBlankTask,
};
