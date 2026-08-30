"use client";

import { useParams } from "next/navigation";

import { lessonData } from "../../../_data/lessonData";

import FillBlankTask from "@/app/_components/FillBlankTask";
import MultipleChoiceTask from "@/app/_components/MultipleChoiceTask";
import ArrangeWordsTask from "@/app/_components/ArrangeWordsTask";
import DialogueClozeReviewTask from "@/app/_components/DialogueClozeReviewTask";
import DialogueReviewTask from "@/app/_components/DialogueReviewTask";

export default function DialogueTaskPage() {
	const { lessonId, dialogueId, taskId } = useParams();

	const lesson = lessonData[lessonId];

	const dialogue = lesson?.dialogues.find((item) => item.id === dialogueId);

	const task = dialogue?.tasks.find((item) => item.id === taskId);

	if (!dialogue || !task) {
		return <div className="p-8 text-white">Không tìm thấy bài học.</div>;
	}

	const totalTasks = dialogue.tasks.length;

	const taskIndex = dialogue.tasks.findIndex((item) => item.id === taskId);

	const nextTask = dialogue.tasks[taskIndex + 1];

	const onComplete = async () => {
		try {
			const res = await fetch(
				`/api/v1/dialogue-progress/${lessonId}/${dialogueId}/tasks/${taskId}`,
				{
					method: "PATCH",
					credentials: "include",
				},
			);

			if (!res.ok) {
				throw new Error("Failed to save dialogue progress");
			}

			const data = await res.json();

			console.log("Progress saved:", data);
		} catch (error) {
			console.error(error);
		}
	};

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

		case "dialogueCloze":
			return <DialogueClozeReviewTask {...props} />;

		case "review":
			return <DialogueReviewTask {...props} />;

		default:
			return (
				<div className="p-8 text-white">Loại bài học không được hỗ trợ.</div>
			);
	}
}
