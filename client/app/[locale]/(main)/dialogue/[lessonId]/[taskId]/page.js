"use client";

import { useParams } from "next/navigation";
import { lessonData } from "../../_data/lessonData";

import FillBlankTask from "@/app/_components/FillBlankTask";
import ListeningTask from "@/app/_components/ListeningTask";
import MultipleChoiceTask from "@/app/_components/MultipleChoiceTask";
import ArrangeWordsTask from "@/app/_components/ArrangeWordsTask";
import DialogueReviewTask from "@/app/_components/DialogueReviewTask";

export default function DialogueTaskPage() {
	const { taskId, lessonId } = useParams();

	const lesson = lessonData[lessonId];

	const task = lesson?.tasks.find(
		(task) => task.id === taskId,
	);

	if (!task) {
		return (
			<div className="p-8 text-white">
				Không tìm thấy bài học.
			</div>
		);
	}

	const taskIndex = lesson.tasks.findIndex(
		(task) => task.id === taskId,
	);

	const nextTask = lesson.tasks[taskIndex + 1];

	const props = {
		task,
		lessonId,
		nextTask,
	};

	switch (task.type) {
		case "listening":
			return <ListeningTask {...props} />;

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
				<div className="p-8 text-white">
					Loại bài học không được hỗ trợ.
				</div>
			);
	}
}