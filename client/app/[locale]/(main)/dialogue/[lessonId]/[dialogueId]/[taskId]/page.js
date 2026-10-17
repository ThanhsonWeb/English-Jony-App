"use client";

import { useCallback, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { getLocalizedDialogueValue } from "@/app/_lib/dialogue/localization";
import { englishMcOptions, englishMcQuestions } from "@/app/_lib/dialogue/mcQuestions";

import { lessonData } from "../../../_data/lessonData";

import GuestProgressReminder from "@/app/_components/GuestProgressReminder";
import FillBlankTask from "@/app/_components/FillBlankTask";
import MultipleChoiceTask from "@/app/_components/MultipleChoiceTask";
import ArrangeWordsTask from "@/app/_components/ArrangeWordsTask";
import DialogueClozeReviewTask from "@/app/_components/DialogueClozeReviewTask";
import DialogueReviewTask from "@/app/_components/DialogueReviewTask";
import DialogueExerciseHeader from "@/app/_components/DialogueExerciseHeader";
import { useAuth } from "@/app/_contexts/AuthContext";
import { DialogueProgressProvider, useDialogueProgressSave } from "@/app/_components/DialogueProgressSave";

const GUEST_REMINDER_DISMISSED_KEY =
	"studyjony-guest-progress-reminder-dismissed";

export default function DialogueTaskPage() {
	const { lessonId, dialogueId, taskId } = useParams();
	const locale = useLocale();
	const t = useTranslations("DialogueFeature");
	const { user, loading: authLoading } = useAuth();
	const progressSave = useDialogueProgressSave(`/api/v1/dialogue-progress/${lessonId}/${dialogueId}/tasks/${taskId}`);
	const [guestReminderRequested, setGuestReminderRequested] = useState(false);
	const guestReminderSeen = useRef(false);
	const dismissGuestReminder = useCallback(() => {
		setGuestReminderRequested(false);
	}, []);

	const lesson = lessonData[lessonId];

	const dialogue = lesson?.dialogues.find((item) => item.id === dialogueId);

	const task = dialogue?.tasks.find((item) => item.id === taskId);

	if (!dialogue || !task) {
		return <div className="p-8 text-white">{t("taskNotFound")}</div>;
	}

	const totalTasks = dialogue.tasks.length;

	const taskIndex = dialogue.tasks.findIndex((item) => item.id === taskId);
	const mcIndex = dialogue.tasks.slice(0, taskIndex + 1).filter((item) => item.type === "multipleChoice").length - 1;

	const previousTask = dialogue.tasks[taskIndex - 1];
	const nextTask = dialogue.tasks[taskIndex + 1];
	const nextTaskWithScene = nextTask && {
		...nextTask,
		scene: nextTask.scene || dialogue.scene,
	};
	const completionHref = dialogue.usefulWords?.length
		? `/dialogue/${lessonId}/${dialogueId}/useful-words`
		: `/dialogue/${lessonId}`;
	const matchingDialogueLine = dialogue.dialogue?.find(
		(line) => line.audioUrl === task.audioUrl,
	);
	const taskWithTranslation = {
		...task,
		title: task.localized?.title?.[locale] ??
			(locale === "en" ? t(`${task.type}Title`) : task.title || t(`${task.type}Title`)),
		instruction: task.localized?.instruction?.[locale] ??
			(locale === "en" ? undefined : task.instruction) ??
			(t.has(`${task.type}Instruction`) ? t(`${task.type}Instruction`) : undefined),
		completionMessage: task.localized?.completionMessage?.[locale] ?? task.completionMessage,
		resultMessage: task.localized?.resultMessage?.[locale] ?? task.resultMessage,
		...(task.type === "multipleChoice" ? {
			question: task.localized?.question?.[locale] ??
				(locale === "en" ? englishMcQuestions[lessonId]?.[dialogueId]?.[mcIndex] || t("mcFallbackQuestion") : task.question),
			localizedOptions: task.localized?.options?.map((option) => option[locale]) ??
				(locale === "en" ? englishMcOptions[lessonId]?.[dialogueId]?.[task.id] : undefined),
			explanation: task.localized?.explanation?.[locale] ?? task.explanation,
		} : {}),
		scene: task.scene || dialogue.scene,
		translation: task.translation || matchingDialogueLine?.translation,
	};

	function maybeShowGuestReminder() {
		if (taskIndex !== 0 || user || guestReminderSeen.current) return;
		try {
			if (sessionStorage.getItem(GUEST_REMINDER_DISMISSED_KEY) === "true") return;
			// Count the reminder when shown, including if the guest leaves to log in.
			sessionStorage.setItem(GUEST_REMINDER_DISMISSED_KEY, "true");
		} catch { /* Still show once in this page session if storage is unavailable. */ }

		guestReminderSeen.current = true;
		setGuestReminderRequested(true);
	}

	const onComplete = async (completion) => {
		maybeShowGuestReminder();
		return progressSave.save(completion);
	};

	const props = {
		task: taskWithTranslation,
		dialogueLine: matchingDialogueLine,
		lessonId,
		dialogueId,
		previousTask,
		nextTask: nextTaskWithScene,
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
				<p className="p-8 text-white">{t("unsupportedTask")}</p>
			);
	}

	return (
		<DialogueProgressProvider key={`${lessonId}/${dialogueId}/${taskId}`} value={{
			...progressSave,
			autoAdvancePaused: guestReminderRequested && !user,
		}}>
			<DialogueExerciseHeader
				lessonId={lessonId}
				lessonTitle={getLocalizedDialogueValue(lesson, "title", locale)}
				dialogueTitle={getLocalizedDialogueValue(dialogue, "title", locale)}
			/>
			{taskContent}
			<GuestProgressReminder
				isOpen={guestReminderRequested && !authLoading && !user}
				onDismiss={dismissGuestReminder}
			/>
		</DialogueProgressProvider>
	);
}
