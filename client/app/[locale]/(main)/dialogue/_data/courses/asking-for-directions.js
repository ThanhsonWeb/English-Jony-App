import findingTheBusStop from "../dialogues/asking-for-directions/finding-the-bus-stop.json";
import { buildGeneratedDialogue } from "../helpers/buildDialogue";

const characterImages = {
	Ben: "/dialogue/asking-for-directions/shared/ben.png",
	Emma: "/dialogue/asking-for-directions/shared/emma.png",
};

const askingForDirectionsCourse = {
	id: "asking-for-directions",
	heroImage: findingTheBusStop.metadata.scene,
	image: findingTheBusStop.metadata.scene,
	title: "Hỏi đường",
	description: "Học cách hỏi và chỉ đường qua những tình huống thực tế.",
	level: "beginner",
	duration: "10 phút",
	dialogues: [buildGeneratedDialogue(findingTheBusStop, characterImages)],
};

export default askingForDirectionsCourse;
