"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import { getLocalizedDialogueValue } from "@/app/_lib/dialogue/localization";

import DialogueUsefulWords from "@/app/_components/DialogueUsefulWords";
import { useAuth } from "@/app/_contexts/AuthContext";
import { useLessonProgressResource } from "@/app/_lib/useStudyResources";
import { lessonData } from "../../../_data/lessonData";

function subscribeToLocationChange(callback) {
	window.addEventListener("popstate", callback);
	return () => window.removeEventListener("popstate", callback);
}

function getCompletionRequested() {
	return new URLSearchParams(window.location.search).get("completed") === "1";
}

function getServerCompletionRequested() {
	return false;
}

export default function DialogueUsefulWordsPage() {
	const { lessonId, dialogueId } = useParams();
	const router = useRouter();
	const locale = useLocale();
	const t = useTranslations("DialogueFeature");
	const { user, loading: authLoading } = useAuth();
	const userId = user?._id || user?.id;
	const completionRequested = useSyncExternalStore(
		subscribeToLocationChange,
		getCompletionRequested,
		getServerCompletionRequested,
	);
	const { data: progressEntries = [] } = useLessonProgressResource(userId, lessonId, !authLoading && completionRequested);
	const lesson = lessonData[lessonId];
	const dialogue = lesson?.dialogues.find((item) => item.id === dialogueId);
	const usefulWords = dialogue?.usefulWords || [];
	const dialogueProgress = progressEntries.find((item) => item.dialogueId === dialogueId);
	const completedTaskIds = new Set(dialogueProgress?.completedTaskIds || []);
	const completedTaskCount = dialogue?.tasks.filter((task) => completedTaskIds.has(task.id)).length || 0;
	const isProgressComplete = Boolean(dialogue?.tasks.length) && completedTaskCount === dialogue.tasks.length;

	useEffect(() => {
		if (dialogue && usefulWords.length === 0) {
			router.replace(`/dialogue/${lessonId}`);
		}
	}, [dialogue, lessonId, router, usefulWords.length]);

	if (!dialogue) {
		return <div className="p-8 text-white">{t("dialogueNotFound")}</div>;
	}

	if (usefulWords.length === 0) {
		return (
			<div className="flex min-h-[calc(100vh-80px)] items-center justify-center text-slate-400">
				{t("redirecting")}
			</div>
		);
	}

	return (
		<DialogueUsefulWords
			words={usefulWords}
			lessonId={lessonId}
			dialogueId={dialogueId}
			dialogueTitle={getLocalizedDialogueValue(dialogue, "title", locale)}
			completionMessage={completionRequested && !authLoading
				? user
					? (isProgressComplete ? { type: "saved", completed: completedTaskCount, total: dialogue.tasks.length } : null)
					: { type: "guest" }
				: null}
		/>
	);
}
