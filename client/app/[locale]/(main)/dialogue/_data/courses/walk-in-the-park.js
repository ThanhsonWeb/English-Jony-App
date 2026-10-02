import walkInTheParkConfig from "@/scripts/config/dialogues/walk-in-the-park.mjs";

import meetingAtThePark from "../dialogues/walk-in-the-park/meeting-at-the-park.json";
import talkingAboutWork from "../dialogues/walk-in-the-park/talking-about-work.json";
import talkingAboutThemselves from "../dialogues/walk-in-the-park/talking-about-themselves.json";
import weekendPlans from "../dialogues/walk-in-the-park/weekend-plans.json";
import { walkInTheParkMedia } from "../dialogues/walk-in-the-park/media";
import { buildGeneratedDialogue } from "../helpers/buildDialogue";

function buildCourseDialogue(draft) {
	if (
		walkInTheParkConfig?.courseId !== "walk-in-the-park" ||
		!Array.isArray(walkInTheParkConfig.dialogues) ||
		!Array.isArray(walkInTheParkConfig.characters)
	) {
		throw new Error("Walk In The Park course config is missing or invalid.");
	}

	const dialogueId = draft?.metadata?.dialogueId;
	if (!dialogueId) {
		throw new Error("Walk In The Park dialogue is missing metadata.dialogueId.");
	}

	const config = walkInTheParkConfig.dialogues.find(
		(item) => item.dialogueId === dialogueId,
	);
	if (!config) {
		throw new Error(`Missing Walk In The Park config for dialogue "${dialogueId}".`);
	}

	const media = walkInTheParkMedia[dialogueId];
	if (!media) {
		throw new Error(`Missing Walk In The Park media for dialogue "${dialogueId}".`);
	}

	const speakers = new Set(draft.dialogue.map((line) => line.speaker));
	for (const speaker of speakers) {
		if (!walkInTheParkConfig.characters.includes(speaker)) {
			throw new Error(
				`Unknown Walk In The Park character "${speaker}" in dialogue "${dialogueId}".`,
			);
		}

		if (!media.characters[speaker]) {
			throw new Error(
				`Missing Walk In The Park image for character "${speaker}" in dialogue "${dialogueId}".`,
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

const walkInTheParkCourse = {
	id: "walk-in-the-park",
	heroImage: meetingAtThePark.metadata.scene,
	image: meetingAtThePark.metadata.scene,
	title: "Walk In The Park",
	description: "Ben và Emma gặp nhau ở công viên vào một buổi chiều. Họ chào nhau và quyết định đi dạo cùng nhau.",
	localized: {"title":{"vi":"Đi dạo trong công viên","en":"A Walk in the Park"},"description":{"vi":"Ben và Emma gặp nhau ở công viên vào một buổi chiều. Họ chào nhau và quyết định đi dạo cùng nhau.","en":"Ben and Emma meet at the park one afternoon. They greet each other and decide to take a walk together."}},
	level: walkInTheParkConfig.level,
	dialogues: [
		buildCourseDialogue(meetingAtThePark),
		buildCourseDialogue(talkingAboutWork),
		buildCourseDialogue(talkingAboutThemselves),
		buildCourseDialogue(weekendPlans),
	],
};

export default walkInTheParkCourse;
