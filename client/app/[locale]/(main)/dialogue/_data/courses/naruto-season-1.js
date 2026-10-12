import narutoSeason1Config from "@/scripts/config/anime/naruto-season-1.mjs";

import theLonelyBoy from "../stories/naruto-season-1/the-lonely-boy.json";
import theNinjaTest from "../stories/naruto-season-1/the-ninja-test.json";
import theForbiddenScroll from "../stories/naruto-season-1/the-forbidden-scroll.json";
import someoneBelievesInHim from "../stories/naruto-season-1/someone-believes-in-him.json";
import { narutoSeason1Media } from "../stories/naruto-season-1/media";
import { buildGeneratedDialogue } from "../helpers/buildDialogue";

function buildCourseDialogue(draft) {
	if (
		narutoSeason1Config?.courseId !== "naruto-season-1" ||
		!Array.isArray(narutoSeason1Config.dialogues) ||
		!Array.isArray(narutoSeason1Config.characters)
	) {
		throw new Error("Naruto Season 1 course config is missing or invalid.");
	}

	const dialogueId = draft?.metadata?.dialogueId;
	if (!dialogueId) {
		throw new Error("Naruto Season 1 dialogue is missing metadata.dialogueId.");
	}

	const config = narutoSeason1Config.dialogues.find(
		(item) => item.dialogueId === dialogueId,
	);
	if (!config) {
		throw new Error(`Missing Naruto Season 1 config for dialogue "${dialogueId}".`);
	}

	const media = narutoSeason1Media[dialogueId];
	if (!media) {
		throw new Error(`Missing Naruto Season 1 media for dialogue "${dialogueId}".`);
	}

	const speakers = new Set(draft.dialogue.map((line) => line.speaker));
	for (const speaker of speakers) {
		if (!narutoSeason1Config.characters.includes(speaker)) {
			throw new Error(
				`Unknown Naruto Season 1 character "${speaker}" in dialogue "${dialogueId}".`,
			);
		}

		if (!media.characters[speaker]) {
			throw new Error(
				`Missing Naruto Season 1 image for character "${speaker}" in dialogue "${dialogueId}".`,
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

const narutoSeason1Course = {
	id: "naruto-season-1",
	contentType: "story",
	heroImage: theLonelyBoy.metadata.scene,
	image: theLonelyBoy.metadata.scene,
	title: "Naruto Season 1",
	description: "Naruto lives alone in the Hidden Leaf Village. He wants people to notice him and dreams of becoming Hokage.",
	localized: {"title":{"vi":"Naruto - Mùa 1","en":"Naruto - Season 1"},"description":{"vi":"Theo chân Naruto, một cậu bé ninja ở Làng Lá, trên hành trình tìm kiếm sự công nhận, tình bạn và theo đuổi ước mơ trở thành Hokage.","en":"Follow Naruto, a young ninja from the Hidden Leaf Village, as he searches for acceptance, friendship, and a chance to become Hokage."}},
	level: narutoSeason1Config.level,
	dialogues: [
		buildCourseDialogue(theLonelyBoy),
		buildCourseDialogue(theNinjaTest),
		buildCourseDialogue(theForbiddenScroll),
		buildCourseDialogue(someoneBelievesInHim),
	],
};

export default narutoSeason1Course;
