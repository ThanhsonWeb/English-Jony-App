"use client";

import { useCallback, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { lessonData } from "../../../_data/lessonData";

import GuestProgressReminder from "@/app/_components/GuestProgressReminder";
import FillBlankTask from "@/app/_components/FillBlankTask";
import MultipleChoiceTask from "@/app/_components/MultipleChoiceTask";
import ArrangeWordsTask from "@/app/_components/ArrangeWordsTask";
import DialogueClozeReviewTask from "@/app/_components/DialogueClozeReviewTask";
import DialogueReviewTask from "@/app/_components/DialogueReviewTask";
import { useAuth } from "@/app/_contexts/AuthContext";

const GUEST_REMINDER_DISMISSED_KEY =
	"studyjony-guest-progress-reminder-dismissed";

export default function DialogueTaskPage() {
	const { lessonId, dialogueId, taskId } = useParams();
	const router = useRouter();
	const { user, loading: authLoading } = useAuth();
	const [guestReminderRequested, setGuestReminderRequested] = useState(false);
	const dismissGuestReminder = useCallback(() => {
		sessionStorage.setItem(GUEST_REMINDER_DISMISSED_KEY, "true");
		setGuestReminderRequested(false);
	}, []);

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

	function maybeShowGuestReminder() {
		if (taskIndex !== 0 || user) return;
		if (sessionStorage.getItem(GUEST_REMINDER_DISMISSED_KEY) === "true") {
			return;
		}

		setGuestReminderRequested(true);
	}

	const onComplete = async () => {
		maybeShowGuestReminder();

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
	let taskContent;

	switch (task.type) {
		case "fillBlank":
			taskContent = <FillBlankTask key={task.id} {...props} />;
			break;

		case "multipleChoice":
			taskContent = <MultipleChoiceTask {...props} />;
			break;

		case "arrangeWords":
			taskContent = <ArrangeWordsTask {...props} />;
			break;

		case "dialogueCloze":
			taskContent = <DialogueClozeReviewTask {...props} />;
			break;

		case "review":
			taskContent = <DialogueReviewTask {...props} />;
			break;

		default:
			taskContent = (
				<p>
					<div className="p-8 text-white">Loại bài học không được hỗ trợ.</div>
					<h1 className="text-amber-50" >shortcut : </h1>
				</p>
			);
	}

	return (
		<>
			{taskContent}
			<GuestProgressReminder
				isOpen={guestReminderRequested && !authLoading && !user}
				onDismiss={dismissGuestReminder}
			/>
		</>
	);
}
