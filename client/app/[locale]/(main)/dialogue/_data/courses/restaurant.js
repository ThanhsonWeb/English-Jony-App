import restaurantConfig from "@/scripts/config/dialogues/restaurant.mjs";

import gettingATable from "../dialogues/restaurant/getting-a-table.json";
import readingTheMenu from "../dialogues/restaurant/reading-the-menu.json";
import orderingFood from "../dialogues/restaurant/ordering-food.json";
import duringTheMeal from "../dialogues/restaurant/during-the-meal.json";
import { restaurantMedia } from "../dialogues/restaurant/media";
import { buildGeneratedDialogue } from "../helpers/buildDialogue";

function buildCourseDialogue(draft) {
	if (
		restaurantConfig?.courseId !== "restaurant" ||
		!Array.isArray(restaurantConfig.dialogues) ||
		!Array.isArray(restaurantConfig.characters)
	) {
		throw new Error("Restaurant course config is missing or invalid.");
	}

	const dialogueId = draft?.metadata?.dialogueId;
	if (!dialogueId) {
		throw new Error("Restaurant dialogue is missing metadata.dialogueId.");
	}

	const config = restaurantConfig.dialogues.find(
		(item) => item.dialogueId === dialogueId,
	);
	if (!config) {
		throw new Error(`Missing Restaurant config for dialogue "${dialogueId}".`);
	}

	const media = restaurantMedia[dialogueId];
	if (!media) {
		throw new Error(`Missing Restaurant media for dialogue "${dialogueId}".`);
	}

	const speakers = new Set(draft.dialogue.map((line) => line.speaker));
	for (const speaker of speakers) {
		if (!restaurantConfig.characters.includes(speaker)) {
			throw new Error(
				`Unknown Restaurant character "${speaker}" in dialogue "${dialogueId}".`,
			);
		}

		if (!media.characters[speaker]) {
			throw new Error(
				`Missing Restaurant image for character "${speaker}" in dialogue "${dialogueId}".`,
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

const restaurantCourse = {
	id: restaurantConfig.courseId,
	heroImage: gettingATable.metadata.scene,
	image: gettingATable.metadata.scene,
	title: "Nhà hàng",
	description: "Luyện giao tiếp đơn giản khi đến nhà hàng, gọi món và thanh toán.",
	level: restaurantConfig.level,
	dialogues: [
		buildCourseDialogue(gettingATable),
		buildCourseDialogue(readingTheMenu),
		buildCourseDialogue(orderingFood),
		buildCourseDialogue(duringTheMeal),
	],
};

export default restaurantCourse;
