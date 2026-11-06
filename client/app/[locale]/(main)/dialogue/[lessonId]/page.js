"use client";

import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { useParams } from "next/navigation";
import {
	ArrowLeft,
	ArrowRight,
	BookOpen,
	CheckCircle2,
	ChevronDown,
	Clock3,
	Headphones,
	LoaderCircle,
} from "lucide-react";
import { lessonData } from "../_data/lessonData";
import { getLocalizedDialogueValue } from "@/app/_lib/dialogue/localization";
import { useLocale, useTranslations } from "next-intl";
import { useAuth } from "@/app/_contexts/AuthContext";
import { useLessonProgressResource } from "@/app/_lib/useStudyResources";

import Image from "next/image";

const beginnerStarterTaskTypeKeys = {
	fillBlank: "fillBlankTitle",
	multipleChoice: "starterQuiz",
	dialogueCloze: "dialogueClozeTitle",
};

export default function DialogueLessonPage() {
	const locale = useLocale();
	const t = useTranslations("DialogueFeature");
	const { lessonId } = useParams();
	const lesson = lessonData[lessonId];
	const [openDialogueId, setOpenDialogueId] = useState(null);
	const { user, loading: authLoading } = useAuth();
	const userId = user?._id || user?.id;
	const {
		data: progressSnapshot,
		loading: progressLoading,
		error: progressError,
		refresh: refreshProgress,
	} = useLessonProgressResource(userId, lessonId, !authLoading);
	const progressEntries = progressSnapshot || [];
	const isProgressLoading = authLoading || Boolean(userId && progressLoading);
	const hasConfirmedProgress = Boolean(userId) && !isProgressLoading && progressSnapshot !== undefined;
	const progressUnavailable = Boolean(userId && progressError && progressSnapshot === undefined);
	const progressRefreshFailed = Boolean(userId && progressError && progressSnapshot !== undefined);
	const progress = { [lessonId]: Object.fromEntries(progressEntries.map(item => [item.dialogueId, item.completedTaskIds || []])) };

	const totalTaskCount =
		lesson?.dialogues.reduce(
			(total, dialogue) => total + dialogue.tasks.length,
			0,
		) || 0;
	const estimatedDurationMinutes = Math.ceil(totalTaskCount * 0.4);

	const totalCompletedTaskCount =
		lesson?.dialogues.reduce((total, dialogue) => {
			const completedIds = new Set(progress[lessonId]?.[dialogue.id] || []);
			return (
				total +
				dialogue.tasks.filter((task) => completedIds.has(task.id)).length
			);
		}, 0) || 0;
	const progressPercent = totalTaskCount
		? Math.round((totalCompletedTaskCount / totalTaskCount) * 100)
		: 0;

	if (!lesson) {
		return (
			<div className="p-8 text-white">{t("courseNotFound")}</div>
		);
	}

	return (
		<div className="min-h-screen px-4 pb-20 pt-2 text-white sm:px-8">
			<div className="mx-auto mt-4 max-w-6xl">
				<Link
					href="/dialogue"
					className="inline-flex items-center gap-2 rounded-lg px-2 py-1 text-base font-medium text-secondary transition hover:text-main focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
				>
					<ArrowLeft size={20} aria-hidden="true" />
					{t("back")}
				</Link>
			</div>
			{isProgressLoading && (
				<div role="status" aria-live="polite" className="mx-auto mt-4 flex max-w-6xl items-center gap-2 rounded-xl border border-app bg-surface px-4 py-3 text-sm text-secondary">
					<LoaderCircle size={17} aria-hidden="true" className="shrink-0 animate-spin text-brand-text" />
					{t("progressLoading")}
				</div>
			)}
			{(progressUnavailable || progressRefreshFailed) && (
				<div role="alert" className="mx-auto mt-4 flex max-w-6xl flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/25 bg-amber-500/5 px-4 py-3 text-sm text-main">
					<p>{t(progressRefreshFailed ? "progressRefreshFailed" : "progressUnavailable")}</p>
					<button type="button" onClick={() => { void refreshProgress(true).catch(() => {}); }} className="min-h-11 rounded-lg border border-app bg-surface px-4 py-2 font-semibold text-main transition hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
						{t("retryProgressLoad")}
					</button>
				</div>
			)}
				{/* Hero */}
				<div className="relative mx-auto mt-4 min-h-[290px] max-w-6xl overflow-hidden rounded-sm border border-app bg-hero">
					{/* Hero image */}
					<div className="absolute inset-y-0 right-0 hidden w-[58%] md:block">
						<Image
							src={lesson.heroImage}
							alt={getLocalizedDialogueValue(lesson, "title", locale)}
							fill
							priority
							className="object-cover object-center"
							sizes="58vw"
						/>

						{/* Fade image into background */}
						<div className="absolute inset-0 bg-gradient-to-r from-hero via-hero/40 to-transparent" />
					</div>

					{/* Mobile background decoration */}
					<div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent md:hidden" />

					{/* Content */}
					<div className="relative z-10 flex min-h-[290px] max-w-2xl flex-col justify-center p-6 sm:p-8">
						<div className="flex flex-wrap items-center gap-3">
							<h1 className="text-2xl font-bold text-white sm:text-3xl">
								{getLocalizedDialogueValue(lesson, "title", locale)}
							</h1>

							<span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
								{t.has(`level.${lesson.level}`) ? t(`level.${lesson.level}`) : lesson.level}
							</span>
						</div>

						<p className="mt-3 max-w-xl leading-relaxed text-slate-400">
							{getLocalizedDialogueValue(lesson, "description", locale)}
						</p>

						<div className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-sm text-slate-400">
							<span className="flex items-center gap-2">
								<BookOpen size={16} />
								{t("dialoguesCount", { count: lesson.dialogues.length })}
							</span>

							<span className="flex items-center gap-2">
								<Clock3 size={16} />{t("minutes", { count: estimatedDurationMinutes })}
							</span>

							{hasConfirmedProgress && <span className="flex items-center gap-2">
								<CheckCircle2 size={16} />
								{t("tasksCompleted", { completed: totalCompletedTaskCount, total: totalTaskCount })}
							</span>}
						</div>

						{/* Progress */}
						{hasConfirmedProgress && <div className="mt-6 max-w-xl">
							<div className="mb-2 flex items-center justify-between text-xs">
								<span className="text-slate-500">{t("courseProgress")}</span>
								<span className="font-semibold text-emerald-400">
									{progressPercent}%
								</span>
							</div>

							<div className="h-2 overflow-hidden rounded-full bg-slate-800">
								<div
									className="h-full rounded-full bg-emerald-500 transition-all duration-500"
									style={{ width: `${progressPercent}%` }}
								/>
							</div>
						</div>}
						{!authLoading && !userId && (
							<p role="note" className="mt-3 max-w-xl text-xs leading-relaxed text-secondary">
								{t("guestProgressNotSaved")}
							</p>
						)}
					</div>
				</div>
			<div className="mx-auto max-w-5xl">
				{/* Dialogues */}
				<section className="mt-10">
					<h2 className="text-xl font-semibold">{t("dialoguesHeading")}</h2>

					<div className="mt-4 space-y-3">
						{lesson.dialogues.map((dialogue, index) => {
							const isOpen = openDialogueId === dialogue.id;
							const isBeginnerStarter =
								lessonId === "asking-for-directions" && index === 0;
							const starterActivityKeys = isBeginnerStarter
								? [
									"starterListen",
									...new Set(
										dialogue.tasks
											.map((task) => beginnerStarterTaskTypeKeys[task.type])
											.filter(Boolean),
									),
								]
								: [];
							const completedTaskIds = new Set(
								progress[lessonId]?.[dialogue.id] || [],
							);
							const completedCount = dialogue.tasks.filter((task) =>
								completedTaskIds.has(task.id),
							).length;
							const currentTask = hasConfirmedProgress && dialogue.tasks.find(
								(task) => !completedTaskIds.has(task.id),
							);
							const totalTasks = dialogue.tasks.length;

							const isCompleted = hasConfirmedProgress &&
								totalTasks > 0 && completedCount === totalTasks;

							const isInProgress = hasConfirmedProgress && completedCount > 0 && !isCompleted;
							const statusKey = isCompleted ? "completed" : isInProgress ? "continue" : "notStarted";
							const statusTone = isCompleted
								? "bg-success-soft text-success"
								: isInProgress
									? "bg-primary-soft text-brand-text"
									: "bg-hover text-secondary";
							const thumbnail = dialogue.thumbnail;

							return (
								<div
									key={dialogue.id}
									className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50"
								>
									<button
										type="button"
										onClick={() =>
											setOpenDialogueId(isOpen ? null : dialogue.id)
										}
										aria-expanded={isOpen}
										className="flex w-full items-center gap-3 p-3 text-left transition hover:bg-slate-800/40 sm:gap-4"
									>
										{/* Thumbnail */}
										{thumbnail && (
											<span className="relative h-16 w-24 shrink-0 overflow-hidden rounded-xl border border-slate-700 sm:h-20 sm:w-32">
												<Image
													src={thumbnail}
													alt={getLocalizedDialogueValue(dialogue, "title", locale)}
													fill
													className="object-cover"
													sizes="(max-width: 640px) 96px, 128px"
												/>
											</span>
										)}

										{/* Number */}
										<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-800 text-sm font-semibold text-slate-300">
											{index + 1}
										</span>

										{/* Information */}
										<span className="min-w-0 flex-1">
											<span className="block truncate font-semibold text-white">
												{getLocalizedDialogueValue(dialogue, "title", locale)}
											</span>
											{hasConfirmedProgress && <span
												data-testid="dialogue-progress-status"
												className={`mt-1 inline-flex w-fit max-w-full rounded-full px-2.5 py-0.5 text-xs font-medium leading-4 sm:hidden ${statusTone}`}
											>
												{t(statusKey)}
											</span>}

											<span className="mt-1 hidden truncate text-sm text-slate-500 sm:block">
												{getLocalizedDialogueValue(dialogue, "description", locale)}
											</span>
										</span>

										{/* Status */}
										{hasConfirmedProgress && <span
											data-testid="dialogue-progress-status"
											className={`hidden shrink-0 rounded-full px-3 py-1 text-xs font-medium sm:inline-flex ${statusTone}`}
										>
											{t(statusKey)}
											</span>}

										<ChevronDown
											size={20}
											className={`shrink-0 text-slate-500 transition-transform ${
												isOpen ? "rotate-180" : ""
											}`}
										/>
									</button>

									{isBeginnerStarter && (
										<div
											data-testid="beginner-starter-overview"
											role="group"
											aria-label={t("starterSummaryLabel")}
											className="border-t border-app px-3 py-3 sm:px-4"
										>
											<p data-testid="beginner-starter-activities" className="flex flex-wrap gap-x-2 text-xs leading-5 text-secondary">
												{starterActivityKeys.map((key, activityIndex) => (
													<span key={key}>
														{activityIndex > 0 && <span aria-hidden="true" className="mr-2">·</span>}
														{t(key)}
													</span>
												))}
											</p>
											<div className="mt-2 flex items-center justify-between gap-2">
												<span data-testid="beginner-starter-task-count" className="text-xs font-medium text-secondary">
													{t("starterTaskCount", { count: dialogue.tasks.length })}
												</span>
												<Link
													data-testid="beginner-starter-link"
													href={`/dialogue/${lessonId}/${dialogue.id}`}
													className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
												>
													{t("starterStartHere")}
													<ArrowRight size={16} aria-hidden="true" />
												</Link>
											</div>
										</div>
									)}

									{isOpen && (
										<div className="space-y-4 border-t border-slate-800 px-4 py-4 sm:px-5">
											{dialogue.dialogue?.length > 0 && !isBeginnerStarter && (
												<Link
													href={`/dialogue/${lessonId}/${dialogue.id}`}
													className="inline-flex items-center gap-2 rounded-xl border border-violet-500/40 bg-violet-500/10 px-4 py-2.5 text-sm font-semibold text-violet-300 transition hover:bg-violet-500/20 hover:text-white"
												>
													<Headphones size={17} />
													{t("listenDialogue")}
												</Link>
											)}
											{dialogue.tasks.length > 0 ? (
												<div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-10">
													{dialogue.tasks.map((task) => {
															const isCompleted = hasConfirmedProgress && completedTaskIds.has(task.id);
															const isCurrent = hasConfirmedProgress && currentTask?.id === task.id;

														return (
															<Link
																key={task.id}
																href={`/dialogue/${lessonId}/${dialogue.id}/${task.id}`}
																className={`flex min-h-10 items-center justify-center rounded-lg border px-2 py-2 text-center text-xs font-semibold transition sm:text-sm ${
																	isCompleted
																		? "border-green-500/40 bg-green-500/10 text-green-400 hover:bg-green-500/20"
																		: isCurrent
																			? "border-blue-500 bg-blue-500/15 text-blue-300 hover:bg-blue-500/25"
																			: "border-slate-700 bg-slate-950/40 text-slate-400 hover:border-slate-600 hover:text-white"
																}`}
															>
																{isCompleted ? "✓ " : ""}{t("exerciseNumber", { number: task.id })}
															</Link>
														);
													})}
												</div>
											) : (
												<p className="text-sm text-slate-500">
													{t("contentUpdating")}
												</p>
											)}
										</div>
									)}
								</div>
							);
						})}
					</div>
				</section>
			</div>
		</div>
	);
}
