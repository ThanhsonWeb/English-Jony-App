import orderingACoffee from "../dialogues/coffee-shop/ordering-a-coffee.json";

import { buildGeneratedDialogue } from "../helpers/buildDialogue";
import { coffeeShopMedia } from "../dialogues/coffee-shop/media";

import coffeeShopConfig from "@/scripts/config/courses/coffee-shop.mjs";

function buildCourseDialogue(draft) {
	const media = coffeeShopMedia[draft.metadata.dialogueId];
	const dialogue = buildGeneratedDialogue(draft, media.characters);
	const config = coffeeShopConfig.dialogues.find(
		(item) => item.dialogueId === dialogue.id,
	);

	return {
		...dialogue,
		title: config?.title?.trim() ?? dialogue.title,
		description: config?.situation ?? dialogue.description,
		thumbnail: config?.thumbnail ?? dialogue.thumbnail,
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
	dialogues: [buildCourseDialogue(orderingACoffee)],
};

export default coffeeShopCourse;
