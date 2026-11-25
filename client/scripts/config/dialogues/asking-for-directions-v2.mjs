import original from "./asking-for-directions.mjs";

export default {
	...original,
	courseId: "asking-for-directions-v2",
	clozeCoversMissingFillBlank: true,
	dialogues: original.dialogues.filter((item) => item.dialogueId === "finding-the-bus-stop"),
};
