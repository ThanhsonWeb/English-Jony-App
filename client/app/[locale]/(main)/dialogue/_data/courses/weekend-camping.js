import arrivingAtTheCampsite from "../dialogues/weekend-camping/arriving-at-the-campsite";
import cookingDinner from "../dialogues/weekend-camping/cooking-dinner";
import settingUpTheTent from "../dialogues/weekend-camping/setting-up-the-tent";
import startingACampfire from "../dialogues/weekend-camping/starting-a-campfire";
import talkingByTheCampfire from "../dialogues/weekend-camping/talking-by-the-campfire";

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
			// startingACampfire,
			//cooking dinner 
			cookingDinner,
			// talking by the campfire
			talkingByTheCampfire,
		],
	};

export default weekendCampingCourse;
