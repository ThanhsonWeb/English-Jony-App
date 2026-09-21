import orderingACoffee from "../dialogues/coffee-shop/ordering-a-coffee.json";
import choosingASnack from "../dialogues/coffee-shop/choosing-a-snack.json";

import askingWifi from "../dialogues/coffee-shop/asking-about-the-wifi.json";
import fixingOrder from "../dialogues/coffee-shop/fixing-an-order.json";

import { buildGeneratedDialogue } from "../helpers/buildDialogue";
import { coffeeShopMedia } from "../dialogues/coffee-shop/media";

import coffeeShopConfig from "@/scripts/config/courses/coffee-shop.mjs";

function buildCourseDialogue(draft) {
	if (
		coffeeShopConfig?.courseId !== "coffee-shop" ||
		!Array.isArray(coffeeShopConfig.dialogues) ||
		!Array.isArray(coffeeShopConfig.characters)
	) {
		throw new Error("Coffee Shop course config is missing or invalid.");
	}

	const dialogueId = draft?.metadata?.dialogueId;
	if (!dialogueId) {
		throw new Error("Coffee Shop dialogue is missing metadata.dialogueId.");
	}

	const config = coffeeShopConfig.dialogues.find(
		(item) => item.dialogueId === dialogueId,
	);
	if (!config) {
		throw new Error(`Missing Coffee Shop config for dialogue "${dialogueId}".`);
	}

	const media = coffeeShopMedia[dialogueId];
	if (!media) {
		throw new Error(`Missing Coffee Shop media for dialogue "${dialogueId}".`);
	}

	const speakers = new Set(draft.dialogue.map((line) => line.speaker));
	for (const speaker of speakers) {
		if (!coffeeShopConfig.characters.includes(speaker)) {
			throw new Error(
				`Unknown Coffee Shop character "${speaker}" in dialogue "${dialogueId}".`,
			);
		}

		if (!media.characters[speaker]) {
			throw new Error(
				`Missing Coffee Shop image for character "${speaker}" in dialogue "${dialogueId}".`,
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

const coffeeShopCourse = {
	id: "coffee-shop",
	heroImage: orderingACoffee.metadata.scene,
	image: orderingACoffee.metadata.scene,
	title: "Quán cà phê",
	description:
		"Học cách gọi đồ uống và giao tiếp trong những tình huống quen thuộc tại quán cà phê.",
	level: "beginner",
	duration: "10 phút",
	dialogues: [
		buildCourseDialogue(orderingACoffee),
		buildCourseDialogue(choosingASnack),
		buildCourseDialogue(askingWifi),
		buildCourseDialogue(fixingOrder),
	],
};

export default coffeeShopCourse;
