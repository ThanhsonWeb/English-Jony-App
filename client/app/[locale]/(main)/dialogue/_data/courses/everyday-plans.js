import everydayPlansConfig from "@/scripts/config/dialogues/everyday-plans.mjs";
import makingPlansAfterWork from "../dialogues/everyday-plans/making-plans-after-work.json";
import { everydayPlansMedia } from "../dialogues/everyday-plans/media";
import { buildGeneratedDialogue } from "../helpers/buildDialogue";
import { a2R2Url } from "@/app/_lib/dialogue/a2R2Media.mjs";

const dialogueConfig = everydayPlansConfig.dialogues.find(
	(item) => item.dialogueId === makingPlansAfterWork.metadata.dialogueId,
);
if (!dialogueConfig) throw new Error("Missing Everyday Plans dialogue configuration.");

const media = everydayPlansMedia[makingPlansAfterWork.metadata.dialogueId];
const useR2 = process.env.NEXT_PUBLIC_A2_R2_MEDIA === "1";
const convert = (item) => ({ ...item, ...(item.audioUrl ? { audioUrl: a2R2Url(item.audioUrl, useR2) } : {}), ...(item.scene ? { scene: a2R2Url(item.scene, useR2) } : {}) });
const testDraft = {
	...makingPlansAfterWork,
	metadata: { ...makingPlansAfterWork.metadata, scene: a2R2Url(makingPlansAfterWork.metadata.scene, useR2) },
	dialogue: makingPlansAfterWork.dialogue.map(convert),
	tasks: makingPlansAfterWork.tasks.map(convert),
};
const dialogue = buildGeneratedDialogue(testDraft, media.characters, { ...media, scene: a2R2Url(media.scene, useR2) });

export default {
	id: everydayPlansConfig.courseId,
	contentType: "dialogue",
	heroImage: testDraft.metadata.scene,
	image: testDraft.metadata.scene,
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
		thumbnail: a2R2Url(dialogueConfig.thumbnail, useR2),
	}],
};
