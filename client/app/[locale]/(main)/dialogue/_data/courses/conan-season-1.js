import conanSeason1Config from "@/scripts/config/anime/conan-season-1.mjs";

import theRollerCoaster from "../stories/conan-season-1/the-roller-coaster.json";
import theMenInBlack from "../stories/conan-season-1/the-men-in-black.json";
import aSmallBody from "../stories/conan-season-1/a-small-body.json";
import { conanSeason1Media } from "../stories/conan-season-1/media";
import { buildGeneratedDialogue } from "../helpers/buildDialogue";

function buildCourseDialogue(draft) {
	if (
		conanSeason1Config?.courseId !== "conan-season-1" ||
		!Array.isArray(conanSeason1Config.dialogues) ||
		!Array.isArray(conanSeason1Config.characters)
	) {
		throw new Error("Conan Season 1 course config is missing or invalid.");
	}

	const dialogueId = draft?.metadata?.dialogueId;
	if (!dialogueId) {
		throw new Error("Conan Season 1 dialogue is missing metadata.dialogueId.");
	}

	const config = conanSeason1Config.dialogues.find(
		(item) => item.dialogueId === dialogueId,
	);
	if (!config) {
		throw new Error(`Missing Conan Season 1 config for dialogue "${dialogueId}".`);
	}

	const media = conanSeason1Media[dialogueId];
	if (!media) {
		throw new Error(`Missing Conan Season 1 media for dialogue "${dialogueId}".`);
	}

	const speakers = new Set(draft.dialogue.map((line) => line.speaker));
	for (const speaker of speakers) {
		if (!conanSeason1Config.characters.includes(speaker)) {
			throw new Error(
				`Unknown Conan Season 1 character "${speaker}" in dialogue "${dialogueId}".`,
			);
		}

		if (!media.characters[speaker]) {
			throw new Error(
				`Missing Conan Season 1 image for character "${speaker}" in dialogue "${dialogueId}".`,
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

const conanSeason1Course = {
	id: "conan-season-1",
	contentType: "story",
	heroImage: theRollerCoaster.metadata.scene,
	image: theRollerCoaster.metadata.scene,
	title: "Conan Season 1",
	description: "Shinichi và Ran vui vẻ trò chuyện sau khi đi tàu lượn. Khi chuẩn bị về nhà, Shinichi nhìn thấy hai người đàn ông đáng ngờ.",
	localized: {"title":{"vi":"Thám tử Conan – Mùa 1","en":"Detective Conan – Season 1"},"description":{"vi":"Shinichi và Ran vui vẻ trò chuyện sau khi đi tàu lượn. Khi chuẩn bị về nhà, Shinichi nhìn thấy hai người đàn ông đáng ngờ.","en":"Shinichi and Ran talk happily after riding the roller coaster. As they get ready to go home, Shinichi notices two suspicious men."}},
	level: conanSeason1Config.level,
	dialogues: [
		buildCourseDialogue(theRollerCoaster),
		buildCourseDialogue(theMenInBlack),
		buildCourseDialogue(aSmallBody),
	],
};

export default conanSeason1Course;
