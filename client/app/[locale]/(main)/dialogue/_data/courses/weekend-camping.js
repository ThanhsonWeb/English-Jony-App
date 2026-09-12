import cookingDinnerDraft from "../dialogues/weekend-camping/cooking-dinner.json";
import talkingByTheCampfireDraft from "../dialogues/weekend-camping/talking-by-the-campfire.json";
import { buildGeneratedDialogueTasks } from "../helpers/buildDialogue";
import arrivingAtTheCampsite from "../dialogues/weekend-camping/arriving-at-the-campsite";
import settingUpTheTent from "../dialogues/weekend-camping/setting-up-the-tent";
import startingACampfire from "../dialogues/weekend-camping/starting-a-campfire";
import { weekendCampingCharacterImages } from "../dialogues/weekend-camping/helpers";

const weekendCampingCourse = {
		id: "weekend-camping",
		heroImage: "/dialogue/weekend-camping/arriving-at-the-campsite/bg.png",
		title: "Cuối tuần cắm trại",
		image: "/dialogue/weekend-camping/arriving-at-the-campsite/bg.png",
		description:
			"Theo chân Leo và Mia trong chuyến cắm trại cuối tuần và học tiếng Anh qua những tình huống thực tế.",
		level: "beginner",
		duration: "30 phút",
		dialogues: [
			// arriving at the campsite
			arrivingAtTheCampsite,
			// setting-up-the-tent
			settingUpTheTent,
			//starting-a-campfire
			startingACampfire,
			//cooking dinner
			{
				...cookingDinnerDraft,
				id: cookingDinnerDraft.metadata.dialogueId,
				thumbnail: cookingDinnerDraft.metadata.thumbnail,
				title: cookingDinnerDraft.metadata.title,
				description: cookingDinnerDraft.metadata.situation,
				scene: cookingDinnerDraft.metadata.scene,
				characters: weekendCampingCharacterImages,
				tasks: buildGeneratedDialogueTasks(
					cookingDinnerDraft,
					weekendCampingCharacterImages,
				),
			},
			// talking by the campfire
			{
				...talkingByTheCampfireDraft,
				id: talkingByTheCampfireDraft.metadata.dialogueId,
				thumbnail: talkingByTheCampfireDraft.metadata.thumbnail,
				title: talkingByTheCampfireDraft.metadata.title,
				description: talkingByTheCampfireDraft.metadata.situation,
				scene: talkingByTheCampfireDraft.metadata.scene,
				characters: weekendCampingCharacterImages,
				tasks: buildGeneratedDialogueTasks(
					talkingByTheCampfireDraft,
					weekendCampingCharacterImages,
				),
			},
		],
	};

export default weekendCampingCourse;
