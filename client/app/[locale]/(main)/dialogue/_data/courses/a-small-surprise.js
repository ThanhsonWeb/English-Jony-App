import aSmallSurpriseConfig from "@/scripts/config/stories/a-small-surprise.mjs";

import aSpecialDay from "../stories/a-small-surprise/a-special-day.json";
import aSecretPlan from "../stories/a-small-surprise/a-secret-plan.json";
import theBrokenCake from "../stories/a-small-surprise/the-broken-cake.json";
import theBestGift from "../stories/a-small-surprise/the-best-gift.json";
import { aSmallSurpriseMedia } from "../stories/a-small-surprise/media";
import { buildGeneratedDialogue } from "../helpers/buildDialogue";

function buildCourseDialogue(draft) {
	if (
		aSmallSurpriseConfig?.courseId !== "a-small-surprise" ||
		!Array.isArray(aSmallSurpriseConfig.dialogues) ||
		!Array.isArray(aSmallSurpriseConfig.characters)
	) {
		throw new Error("A Small Surprise course config is missing or invalid.");
	}

	const dialogueId = draft?.metadata?.dialogueId;
	if (!dialogueId) {
		throw new Error("A Small Surprise dialogue is missing metadata.dialogueId.");
	}

	const config = aSmallSurpriseConfig.dialogues.find(
		(item) => item.dialogueId === dialogueId,
	);
	if (!config) {
		throw new Error(`Missing A Small Surprise config for dialogue "${dialogueId}".`);
	}

	const media = aSmallSurpriseMedia[dialogueId];
	if (!media) {
		throw new Error(`Missing A Small Surprise media for dialogue "${dialogueId}".`);
	}

	const speakers = new Set(draft.dialogue.map((line) => line.speaker));
	for (const speaker of speakers) {
		if (!aSmallSurpriseConfig.characters.includes(speaker)) {
			throw new Error(
				`Unknown A Small Surprise character "${speaker}" in dialogue "${dialogueId}".`,
			);
		}

		if (!media.characters[speaker]) {
			throw new Error(
				`Missing A Small Surprise image for character "${speaker}" in dialogue "${dialogueId}".`,
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

const aSmallSurpriseCourse = {
	id: "a-small-surprise",
	contentType: "story",
	heroImage: aSpecialDay.metadata.scene,
	image: aSpecialDay.metadata.scene,
	title: "A Small Surprise",
	description: "Noah remembers that tomorrow is Dad's birthday. He wants to give Dad a special gift, but he has little money. He asks Mom for help.",
	localized: {"title":{"vi":"Một bất ngờ nhỏ","en":"A Small Surprise"},"description":{"vi":"Noah nhớ ra ngày mai là sinh nhật của bố. Cậu muốn tặng bố một món quà đặc biệt nhưng chỉ có ít tiền. Cậu nhờ mẹ giúp đỡ.","en":"Noah remembers that tomorrow is Dad's birthday. He wants to give Dad a special gift, but he has little money. He asks Mom for help."}},
	level: aSmallSurpriseConfig.level,
	dialogues: [
		buildCourseDialogue(aSpecialDay),
		buildCourseDialogue(aSecretPlan),
		buildCourseDialogue(theBrokenCake),
		buildCourseDialogue(theBestGift),
	],
};

export default aSmallSurpriseCourse;
