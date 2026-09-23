import atAHotelConfig from "@/scripts/config/courses/at-a-hotel.mjs";

import checkingIn from "../dialogues/at-a-hotel/checking-in.json";
import { atAHotelMedia } from "../dialogues/at-a-hotel/media";
import { buildGeneratedDialogue } from "../helpers/buildDialogue";

function buildCourseDialogue(draft) {
	if (
		atAHotelConfig?.courseId !== "at-a-hotel" ||
		!Array.isArray(atAHotelConfig.dialogues) ||
		!Array.isArray(atAHotelConfig.characters)
	) {
		throw new Error("At a Hotel course config is missing or invalid.");
	}

	const dialogueId = draft?.metadata?.dialogueId;
	if (!dialogueId) {
		throw new Error("At a Hotel dialogue is missing metadata.dialogueId.");
	}

	const config = atAHotelConfig.dialogues.find(
		(item) => item.dialogueId === dialogueId,
	);
	if (!config) {
		throw new Error(`Missing At a Hotel config for dialogue "${dialogueId}".`);
	}

	const media = atAHotelMedia[dialogueId];
	if (!media) {
		throw new Error(`Missing At a Hotel media for dialogue "${dialogueId}".`);
	}

	const speakers = new Set(draft.dialogue.map((line) => line.speaker));
	for (const speaker of speakers) {
		if (!atAHotelConfig.characters.includes(speaker)) {
			throw new Error(
				`Unknown At a Hotel character "${speaker}" in dialogue "${dialogueId}".`,
			);
		}

		if (!media.characters[speaker]) {
			throw new Error(
				`Missing At a Hotel image for character "${speaker}" in dialogue "${dialogueId}".`,
			);
		}
	}

	const dialogue = buildGeneratedDialogue(draft, media.characters);

	return {
		...dialogue,
		title: config.title?.trim() ?? dialogue.title,
		description: config.situation ?? dialogue.description,
		thumbnail: config.thumbnail ?? dialogue.thumbnail,
	};
}

const atAHotelCourse = {
	id: "at-a-hotel",
	heroImage: checkingIn.metadata.scene,
	image: checkingIn.metadata.scene,
	title: "Tại khách sạn",
	description:
		"Học cách nhận phòng và giao tiếp trong những tình huống quen thuộc tại khách sạn.",
	level: "beginner",
	dialogues: [buildCourseDialogue(checkingIn)],
};

export default atAHotelCourse;
