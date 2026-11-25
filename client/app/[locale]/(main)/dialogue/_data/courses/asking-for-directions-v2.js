import findingTheBusStop from "../dialogues/asking-for-directions-v2/finding-the-bus-stop.json";
import { askingForDirectionsV2Media } from "../dialogues/asking-for-directions-v2/media";
import { buildGeneratedDialogue } from "../helpers/buildDialogue";

function buildCourseDialogue(draft) {
	const media = askingForDirectionsV2Media[draft.metadata.dialogueId];
	return buildGeneratedDialogue(draft, media.characters, media);
}

export default {
	id: "asking-for-directions-v2",
	title: "Hỏi đường v2",
	description: "Học cách hỏi và chỉ đường.",
	localized: {
		title: { vi: "Hỏi đường v2", en: "Asking for directions v2" },
		description: { vi: "Học cách hỏi và chỉ đường.", en: "Learn to ask for and give directions." },
	},
	level: "beginner",
	image: findingTheBusStop.metadata.scene,
	heroImage: findingTheBusStop.metadata.scene,
	dialogues: [buildCourseDialogue(findingTheBusStop)],
};
