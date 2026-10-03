import tenMinutesADayConfig from "@/scripts/config/stories/ten-minutes-a-day.mjs";

import theOldBook from "../stories/ten-minutes-a-day/the-old-book.json";
import onlyTenMinutes from "../stories/ten-minutes-a-day/only-ten-minutes.json";
import thePresentation from "../stories/ten-minutes-a-day/the-presentation.json";
import theRealTreasure from "../stories/ten-minutes-a-day/the-real-treasure.json";
import { tenMinutesADayMedia } from "../stories/ten-minutes-a-day/media";
import { buildGeneratedDialogue } from "../helpers/buildDialogue";

function buildCourseDialogue(draft) {
	if (
		tenMinutesADayConfig?.courseId !== "ten-minutes-a-day" ||
		!Array.isArray(tenMinutesADayConfig.dialogues) ||
		!Array.isArray(tenMinutesADayConfig.characters)
	) {
		throw new Error("Ten Minutes A Day course config is missing or invalid.");
	}

	const dialogueId = draft?.metadata?.dialogueId;
	if (!dialogueId) {
		throw new Error("Ten Minutes A Day dialogue is missing metadata.dialogueId.");
	}

	const config = tenMinutesADayConfig.dialogues.find(
		(item) => item.dialogueId === dialogueId,
	);
	if (!config) {
		throw new Error(`Missing Ten Minutes A Day config for dialogue "${dialogueId}".`);
	}

	const media = tenMinutesADayMedia[dialogueId];
	if (!media) {
		throw new Error(`Missing Ten Minutes A Day media for dialogue "${dialogueId}".`);
	}

	const speakers = new Set(draft.dialogue.map((line) => line.speaker));
	for (const speaker of speakers) {
		if (!tenMinutesADayConfig.characters.includes(speaker)) {
			throw new Error(
				`Unknown Ten Minutes A Day character "${speaker}" in dialogue "${dialogueId}".`,
			);
		}

		if (!media.characters[speaker]) {
			throw new Error(
				`Missing Ten Minutes A Day image for character "${speaker}" in dialogue "${dialogueId}".`,
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

const tenMinutesADayCourse = {
	id: "ten-minutes-a-day",
	contentType: "story",
	heroImage: theOldBook.metadata.scene,
	image: theOldBook.metadata.scene,
	title: "Ten Minutes A Day",
	description: "Mr. Daniel gives Leo and Ryan the same English book and asks them to read for ten minutes every day.",
	localized: {"title":{"vi":"Mười phút mỗi ngày","en":"Ten Minutes a Day"},"description":{"vi":"Mr. Daniel tặng Leo và Ryan cùng một cuốn sách tiếng Anh và đề nghị họ đọc mười phút mỗi ngày.","en":"Mr. Daniel gives Leo and Ryan the same English book and asks them to read for ten minutes every day."}},
	level: tenMinutesADayConfig.level,
	dialogues: [
		buildCourseDialogue(theOldBook),
		buildCourseDialogue(onlyTenMinutes),
		buildCourseDialogue(thePresentation),
		buildCourseDialogue(theRealTreasure),
	],
};

export default tenMinutesADayCourse;
