"use client";

import { useParams, useRouter } from "next/navigation";

import { lessonData } from "../../../_data/lessonData";

import FillBlankTask from "@/app/_components/FillBlankTask";
import MultipleChoiceTask from "@/app/_components/MultipleChoiceTask";
import ArrangeWordsTask from "@/app/_components/ArrangeWordsTask";
import DialogueClozeReviewTask from "@/app/_components/DialogueClozeReviewTask";
import DialogueReviewTask from "@/app/_components/DialogueReviewTask";

export default function DialogueTaskPage() {
	const { lessonId, dialogueId, taskId } = useParams();
	const router = useRouter();

	const lesson = lessonData[lessonId];

	const dialogue = lesson?.dialogues.find((item) => item.id === dialogueId);

	const task = dialogue?.tasks.find((item) => item.id === taskId);

	if (!dialogue || !task) {
		return <div className="p-8 text-white">Không tìm thấy bài học.</div>;
	}

	const totalTasks = dialogue.tasks.length;

	const taskIndex = dialogue.tasks.findIndex((item) => item.id === taskId);

	const nextTask = dialogue.tasks[taskIndex + 1];
	const completionHref = dialogue.usefulWords?.length
		? `/dialogue/${lessonId}/${dialogueId}/useful-words`
		: `/dialogue/${lessonId}`;
	const matchingDialogueLine = dialogue.dialogue?.find(
		(line) => line.audioUrl === task.audioUrl,
	);
	const taskWithTranslation = {
		...task,
		scene: dialogue.scene || task.scene,
		translation: task.translation || matchingDialogueLine?.translation,
	};

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
			const savedProgress = data.data?.progress;

			window.dispatchEvent(
				new CustomEvent("dialogue-progress-updated", {
					detail: savedProgress,
				}),
			);
			router.refresh();
		} catch (error) {
			console.error(error);
		}
	};

	const props = {
		task: taskWithTranslation,
		lessonId,
		dialogueId,
		nextTask,
		completionHref,
		totalTasks,
		onComplete,
	};

	switch (task.type) {
		case "fillBlank":
			return <FillBlankTask key={task.id} {...props} />;

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
				<p>
					<div className="p-8 text-white">Loại bài học không được hỗ trợ.</div>
					<h1 className="text-amber-50" >shortcut : </h1>
				</p>
			);
	}
}
