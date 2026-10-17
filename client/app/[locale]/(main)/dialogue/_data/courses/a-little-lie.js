import aLittleLieConfig from "@/scripts/config/stories/a-little-lie.mjs";

import theBrokenWindow from "../stories/a-little-lie/the-broken-window.json";
import aLittleLie from "../stories/a-little-lie/a-little-lie.json";
import theHeavyFeeling from "../stories/a-little-lie/the-heavy-feeling.json";
import tellingTheTruth from "../stories/a-little-lie/telling-the-truth.json";
import { aLittleLieMedia } from "../stories/a-little-lie/media";
import { buildGeneratedDialogue } from "../helpers/buildDialogue";

function buildCourseDialogue(draft) {
	if (
		aLittleLieConfig?.courseId !== "a-little-lie" ||
		!Array.isArray(aLittleLieConfig.dialogues) ||
		!Array.isArray(aLittleLieConfig.characters)
	) {
		throw new Error("A Little Lie course config is missing or invalid.");
	}

	const dialogueId = draft?.metadata?.dialogueId;
	if (!dialogueId) {
		throw new Error("A Little Lie dialogue is missing metadata.dialogueId.");
	}

	const config = aLittleLieConfig.dialogues.find(
		(item) => item.dialogueId === dialogueId,
	);
	if (!config) {
		throw new Error(`Missing A Little Lie config for dialogue "${dialogueId}".`);
	}

	const media = aLittleLieMedia[dialogueId];
	if (!media) {
		throw new Error(`Missing A Little Lie media for dialogue "${dialogueId}".`);
	}

	const speakers = new Set(draft.dialogue.map((line) => line.speaker));
	for (const speaker of speakers) {
		if (!aLittleLieConfig.characters.includes(speaker)) {
			throw new Error(
				`Unknown A Little Lie character "${speaker}" in dialogue "${dialogueId}".`,
			);
		}

		if (!media.characters[speaker]) {
			throw new Error(
				`Missing A Little Lie image for character "${speaker}" in dialogue "${dialogueId}".`,
			);
		}
	}

	const dialogue = buildGeneratedDialogue(draft, media.characters, media);

	return {
		...dialogue,
		title: config.title?.trim() ?? dialogue.title,
		description: config.situation ?? dialogue.description,
		thumbnail: config.thumbnail ?? dialogue.thumbnail,
	};
}

const aLittleLieCourse = {
	id: "a-little-lie",
	contentType: "story",
	heroImage: theBrokenWindow.metadata.scene,
	image: theBrokenWindow.metadata.scene,
	title: "A Little Lie",
	description: "Noah vô tình làm vỡ cửa sổ khi chơi bóng. Cậu sợ mẹ phát hiện.",
	localized: {"title":{"vi":"Lời nói dối nhỏ","en":"A Little Lie"},"description":{"vi":"Một cậu bé học được rằng nói sự thật và nhận lỗi quan trọng hơn việc che giấu sai lầm.","en":"A boy learns that telling the truth and admitting mistakes is more important than hiding them."}},
	level: aLittleLieConfig.level,
	dialogues: [
		buildCourseDialogue(theBrokenWindow),
		buildCourseDialogue(aLittleLie),
		buildCourseDialogue(theHeavyFeeling),
		buildCourseDialogue(tellingTheTruth),
	],
};

export default aLittleLieCourse;
