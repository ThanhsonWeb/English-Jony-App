import gratefulConfig from "@/scripts/config/stories/grateful.mjs";

import aBusyMorning from "../stories/grateful/a-busy-morning.json";
import aSmallActOfKindness from "../stories/grateful/a-small-act-of-kindness.json";
import { gratefulMedia } from "../stories/grateful/media";
import { buildGeneratedDialogue } from "../helpers/buildDialogue";

function buildCourseDialogue(draft) {
	if (
		gratefulConfig?.courseId !== "grateful" ||
		!Array.isArray(gratefulConfig.dialogues) ||
		!Array.isArray(gratefulConfig.characters)
	) {
		throw new Error("Grateful course config is missing or invalid.");
	}

	const dialogueId = draft?.metadata?.dialogueId;
	if (!dialogueId) {
		throw new Error("Grateful dialogue is missing metadata.dialogueId.");
	}

	const config = gratefulConfig.dialogues.find(
		(item) => item.dialogueId === dialogueId,
	);
	if (!config) {
		throw new Error(`Missing Grateful config for dialogue "${dialogueId}".`);
	}

	const media = gratefulMedia[dialogueId];
	if (!media) {
		throw new Error(`Missing Grateful media for dialogue "${dialogueId}".`);
	}

	const speakers = new Set(draft.dialogue.map((line) => line.speaker));
	for (const speaker of speakers) {
		if (!gratefulConfig.characters.includes(speaker)) {
			throw new Error(
				`Unknown Grateful character "${speaker}" in dialogue "${dialogueId}".`,
			);
		}

		if (!media.characters[speaker]) {
			throw new Error(
				`Missing Grateful image for character "${speaker}" in dialogue "${dialogueId}".`,
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

const gratefulCourse = {
	id: "grateful",
	contentType: "story",
	heroImage: aBusyMorning.metadata.scene,
	image: aBusyMorning.metadata.scene,
	title: "Grateful",
	description: "Lily is late for school. Mom prepares her breakfast and helps her find her bag, but Lily leaves without saying thank you.",
	localized: {"title":{"vi":"Biết ơn","en":"Being Grateful"},"description":{"vi":"Lily sắp muộn học. Mẹ chuẩn bị bữa sáng và giúp Lily tìm cặp sách, nhưng cô bé rời đi mà không nói lời cảm ơn.","en":"Lily is late for school. Mom prepares her breakfast and helps her find her bag, but Lily leaves without saying thank you."}},
	level: gratefulConfig.level,
	dialogues: [
		buildCourseDialogue(aBusyMorning),
		buildCourseDialogue(aSmallActOfKindness),
	],
};

export default gratefulCourse;
