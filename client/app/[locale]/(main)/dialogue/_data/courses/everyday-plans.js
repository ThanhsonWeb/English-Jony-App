import everydayPlansConfig from "@/scripts/config/dialogues/everyday-plans.mjs";
import makingPlansAfterWork from "../dialogues/everyday-plans/making-plans-after-work.json";
import { everydayPlansMedia } from "../dialogues/everyday-plans/media";
import { buildGeneratedDialogue } from "../helpers/buildDialogue";

const dialogueConfig = everydayPlansConfig.dialogues.find(
	(item) => item.dialogueId === makingPlansAfterWork.metadata.dialogueId,
);
if (!dialogueConfig) throw new Error("Missing Everyday Plans dialogue configuration.");

const media = everydayPlansMedia[makingPlansAfterWork.metadata.dialogueId];
const dialogue = buildGeneratedDialogue(makingPlansAfterWork, media.characters, media);

export default {
	id: everydayPlansConfig.courseId,
	contentType: "dialogue",
	heroImage: makingPlansAfterWork.metadata.scene,
	image: makingPlansAfterWork.metadata.scene,
	title: everydayPlansConfig.title,
	description: everydayPlansConfig.description,
	localized: {
		title: makingPlansAfterWork.metadata.localized.courseTitle,
		description: makingPlansAfterWork.metadata.localized.courseDescription,
	},
	level: everydayPlansConfig.level,
	dialogues: [{
		...dialogue,
		title: dialogueConfig.title,
		description: dialogueConfig.situation,
		thumbnail: dialogueConfig.thumbnail,
	}],
};
