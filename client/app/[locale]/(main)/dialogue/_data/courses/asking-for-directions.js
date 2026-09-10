import findingTheBusStop from "../dialogues/asking-for-directions/finding-the-bus-stop.json";
import findingTheTrainStation from "../dialogues/asking-for-directions/finding-the-train-station.json";
import goingToTheSupermarket from "../dialogues/asking-for-directions/going-to-the-supermarket.json";
import { buildGeneratedDialogue } from "../helpers/buildDialogue";
import askingForDirectionsConfig from "@/scripts/config/courses/asking-for-direction.mjs";

const characterImages = {
	Ben: "/dialogue/asking-for-directions/shared/ben.png",
	Emma: "/dialogue/asking-for-directions/shared/emma.png",
};

function buildCourseDialogue(draft) {
	const dialogue = buildGeneratedDialogue(draft, characterImages);
	const config = askingForDirectionsConfig.dialogues.find(
		(item) => item.dialogueId === dialogue.id,
	);

	return {
		...dialogue,
		title: config?.title?.trim() ?? dialogue.title,
		description: config?.situation ?? dialogue.description,
		thumbnail: config?.thumbnail ?? dialogue.thumbnail,
	};
}

const askingForDirectionsCourse = {
	id: "asking-for-directions",
	heroImage: findingTheBusStop.metadata.scene,
	image: findingTheBusStop.metadata.scene,
	title: "Hỏi đường",
	description: "Học cách hỏi và chỉ đường qua những tình huống thực tế.",
	level: "beginner",
	duration: "10 phút",
	dialogues: [
		buildCourseDialogue(findingTheBusStop),
		buildCourseDialogue(goingToTheSupermarket),
		buildCourseDialogue(findingTheTrainStation),
	],
};

export default askingForDirectionsCourse;
