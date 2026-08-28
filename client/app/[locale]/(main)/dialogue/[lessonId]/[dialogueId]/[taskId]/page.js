"use client";

import { useParams } from "next/navigation";
import { lessonData } from "../../../_data/lessonData";
import { markDialogueTaskComplete } from "../../../_utils/dialogueProgress";

import FillBlankTask from "@/app/_components/FillBlankTask";
import MultipleChoiceTask from "@/app/_components/MultipleChoiceTask";
import ArrangeWordsTask from "@/app/_components/ArrangeWordsTask";
import DialogueReviewTask from "@/app/_components/DialogueReviewTask";

export default function DialogueTaskPage() {
	const { lessonId, dialogueId, taskId } = useParams();
	const lesson = lessonData[lessonId];
	const dialogue = lesson?.dialogues.find((item) => item.id === dialogueId);
	const task = dialogue?.tasks.find((item) => item.id === taskId);
	const totalTasks = dialogue.tasks.length;

	if (!task) {
		return <div className="p-8 text-white">Không tìm thấy bài học.</div>;
	}

	const taskIndex = dialogue.tasks.findIndex((item) => item.id === taskId);
	const nextTask = dialogue.tasks[taskIndex + 1];
	const onComplete = () =>
		markDialogueTaskComplete(lessonId, dialogueId, taskId);
	const props = {
		task,
		lessonId,
		dialogueId,
		nextTask,
		totalTasks,
		onComplete,
	};

	switch (task.type) {
		case "fillBlank":
			return <FillBlankTask {...props} />;
		case "multipleChoice":
			return <MultipleChoiceTask {...props} />;
		case "arrangeWords":
			return <ArrangeWordsTask {...props} />;
		case "review":
			return <DialogueReviewTask {...props} />;
		default:
			return (
				<div className="p-8 text-white">Loại bài học không được hỗ trợ.</div>
			);
	}
}
