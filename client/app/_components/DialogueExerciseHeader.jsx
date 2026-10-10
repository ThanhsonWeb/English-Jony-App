"use client";

import { ArrowLeft, ChevronLeft, ChevronRight, TentTree } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { DialogueProgressLink, useDialogueProgress } from "./DialogueProgressSave";

export default function DialogueExerciseHeader({
	lessonId,
	lessonTitle,
	dialogueTitle,
}) {
	const router = useRouter();
	const t = useTranslations("DialogueFeature");
	const continueButtonRef = useRef(null);
	const [isExitOpen, setIsExitOpen] = useState(false);
	const progress = useDialogueProgress();

	useEffect(() => {
		if (!isExitOpen) return;

		continueButtonRef.current?.focus();
		function handleKeyDown(event) {
			if (event.key === "Escape") setIsExitOpen(false);
		}

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [isExitOpen]);

	return (
		<>
			<header className="w-full px-4 pt-6 sm:px-8">
				<div className="mx-auto max-w-6xl">
				<div className="flex min-w-0 items-center gap-3">
				<button
					type="button"
					onClick={() => setIsExitOpen(true)}
					className="-ml-2 inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-semibold text-secondary transition hover:bg-surface-muted hover:text-main"
				>
					<ArrowLeft size={18} />
					{t("exit")}
				</button>
				<div className="flex min-w-0 items-center gap-2 text-sm sm:text-base">
					<TentTree size={20} className="shrink-0 text-secondary" />
					<span className="truncate text-secondary">{lessonTitle}</span>
					<span className="text-muted">/</span>
					<span className="truncate font-medium text-main">{dialogueTitle}</span>
				</div>
				</div>
				</div>
			</header>

			{isExitOpen && (
				<div
					className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
					role="presentation"
					onMouseDown={(event) => {
						if (event.target === event.currentTarget) setIsExitOpen(false);
					}}
				>
					<section
						role="dialog"
						aria-modal="true"
						aria-labelledby="exit-dialogue-title"
						aria-describedby="exit-dialogue-description"
						className="w-full max-w-sm rounded-2xl border border-app bg-surface p-5 text-main shadow-2xl sm:p-6"
					>
						<h2 id="exit-dialogue-title" className="text-xl font-bold">
							{t("leaveLesson")}
						</h2>
						<p
							id="exit-dialogue-description"
							className="mt-3 whitespace-pre-line text-sm leading-6 text-secondary"
						>
							{t(progress && !progress.canLeave ? "progressStorageUnavailable" : progress?.pendingCount ? "leaveUnsavedProgress" : "leaveConfirmation")}
						</p>

						<div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
							<button
								ref={continueButtonRef}
								type="button"
								onClick={() => setIsExitOpen(false)}
								className="min-h-11 rounded-xl border border-app px-4 py-2.5 text-sm font-semibold text-secondary transition hover:bg-surface-muted hover:text-main"
							>
								{t("keepLearning")}
							</button>
							<button
								type="button"
								onClick={() => router.push(`/dialogue/${lessonId}`)}
								disabled={progress && !progress.canLeave}
								className="min-h-11 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:opacity-50"
							>
								{t("exit")}
							</button>
						</div>
					</section>
				</div>
			)}
		</>
	);
}

export function DialogueTaskNavigation({
	lessonId,
	dialogueId,
	taskId,
	previousTask,
	nextTask,
	totalTasks,
}) {
	const t = useTranslations("DialogueFeature");
	const taskHref = (id) => `/dialogue/${lessonId}/${dialogueId}/${id}`;

	return (
		<nav
			className="mb-4 grid w-full grid-cols-[2.5rem_1fr_2.5rem] items-center gap-3"
			aria-label={t("exerciseNavigation")}
		>
			{previousTask ? (
				<DialogueProgressLink requireSave={false}
					href={taskHref(previousTask.id)}
					aria-label={t("previousExercise")}
					className="flex h-10 w-10 items-center justify-center rounded-full border border-app bg-surface text-secondary transition hover:border-primary hover:text-primary"
				>
					<ChevronLeft size={20} />
				</DialogueProgressLink>
			) : (
				<span className="h-10 w-10" aria-hidden="true" />
			)}

			<span className="text-center text-sm font-semibold text-main">
				{t("exercisePosition", { current: taskId, total: totalTasks })}
			</span>

			{nextTask ? (
				<DialogueProgressLink requireSave={false}
					href={taskHref(nextTask.id)}
					aria-label={t("nextExercise")}
					className="flex h-10 w-10 items-center justify-center rounded-full border border-app bg-surface text-secondary transition hover:border-primary hover:text-primary"
				>
					<ChevronRight size={20} />
				</DialogueProgressLink>
			) : (
				<span className="h-10 w-10" aria-hidden="true" />
			)}
		</nav>
	);
}
