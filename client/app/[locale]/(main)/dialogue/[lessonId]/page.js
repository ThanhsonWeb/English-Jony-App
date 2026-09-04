"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
	ArrowLeft,
	BookOpen,
	CheckCircle2,
	ChevronDown,
	Clock3,
	Headphones,
} from "lucide-react";
import { lessonData } from "../_data/lessonData";

import Image from "next/image";

export default function DialogueLessonPage() {
	const { lessonId } = useParams();
	const lesson = lessonData[lessonId];
	const [openDialogueId, setOpenDialogueId] = useState(null);
	const [progress, setProgress] = useState({});

	const loadProgress = useCallback(async () => {
		try {
			const res = await fetch(`/api/v1/dialogue-progress/${lessonId}`, {
				credentials: "include",
				cache: "no-store",
			});

			if (!res.ok) {
				throw new Error("Failed to load dialogue progress");
			}

			const data = await res.json();

			const lessonProgress = {};

			data.data.progress.forEach((item) => {
				lessonProgress[item.dialogueId] = item.completedTaskIds || [];
			});

			setProgress({
				[lessonId]: lessonProgress,
			});
		} catch (error) {
			console.error("Load dialogue progress error:", error);
		}
	}, [lessonId]);

	useEffect(() => {
		function applySavedProgress(event) {
			const savedProgress = event.detail;

			if (!savedProgress || savedProgress.lessonId !== lessonId) return;

			setProgress((current) => ({
				...current,
				[lessonId]: {
					...current[lessonId],
					[savedProgress.dialogueId]: savedProgress.completedTaskIds || [],
				},
			}));
		}

		const loadTimer = lessonId
			? window.setTimeout(loadProgress, 0)
			: null;

		window.addEventListener("focus", loadProgress);
		window.addEventListener("dialogue-progress-updated", applySavedProgress);

		return () => {
			if (loadTimer !== null) window.clearTimeout(loadTimer);
			window.removeEventListener("focus", loadProgress);
			window.removeEventListener(
				"dialogue-progress-updated",
				applySavedProgress,
			);
		};
	}, [lessonId, loadProgress]);

	const totalTaskCount =
		lesson?.dialogues.reduce(
			(total, dialogue) => total + dialogue.tasks.length,
			0,
		) || 0;

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
			<div className="p-8 text-white">Không tìm thấy chủ đề hội thoại.</div>
		);
	}

	return (
		<div className="min-h-screen px-4 py-2 text-white sm:px-8">
				{/* Hero */}
				<div className="relative mt-4 min-h-[290px] overflow-hidden rounded-sm border border-slate-800 bg-[#07101f] mx-auto max-w-6xl">
					{/* Hero image */}
					<div className="absolute inset-y-0 right-0 hidden w-[58%] md:block">
						<Image
							src={lesson.heroImage}
							alt={lesson.title}
							fill
							priority
							className="object-cover object-center"
							sizes="58vw"
						/>

						{/* Fade image into background */}
						<div className="absolute inset-0 bg-gradient-to-r from-[#07101f] via-[#07101f]/40 to-transparent" />
					</div>

					{/* Mobile background decoration */}
					<div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent md:hidden" />

					{/* Content */}
					<div className="relative z-10 flex min-h-[290px] max-w-2xl flex-col justify-center p-6 sm:p-8">
						<div className="flex flex-wrap items-center gap-3">
							<h1 className="text-2xl font-bold text-white sm:text-3xl">
								{lesson.title} 
							</h1>

							<span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
								{lesson.level}
							</span>
						</div>

						<p className="mt-3 max-w-xl leading-relaxed text-slate-400">
							{lesson.description}
						</p>

						<div className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-sm text-slate-400">
							<span className="flex items-center gap-2">
								<BookOpen size={16} />
								{lesson.dialogues.length} hội thoại
							</span>

							<span className="flex items-center gap-2">
								<Clock3 size={16} />~{lesson.duration}
							</span>

							<span className="flex items-center gap-2">
								<CheckCircle2 size={16} />
								{totalCompletedTaskCount}/{totalTaskCount} bài hoàn thành
							</span>
						</div>

						{/* Progress */}
						<div className="mt-6 max-w-xl">
							<div className="mb-2 flex items-center justify-between text-xs">
								<span className="text-slate-500">Tiến độ khóa học</span>
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
						</div>
					</div>
				</div>
			<div className="mx-auto max-w-5xl">
				{/* Dialogues */}
				<section className="mt-10">
					<h2 className="text-xl font-semibold">Các hội thoại</h2>

					<div className="mt-4 space-y-3">
						{lesson.dialogues.map((dialogue, index) => {
							const isOpen = openDialogueId === dialogue.id;
							const completedTaskIds = new Set(
								progress[lessonId]?.[dialogue.id] || [],
							);
							const completedCount = dialogue.tasks.filter((task) =>
								completedTaskIds.has(task.id),
							).length;
							const currentTask = dialogue.tasks.find(
								(task) => !completedTaskIds.has(task.id),
							);
							const totalTasks = dialogue.tasks.length;

							const isCompleted =
								totalTasks > 0 && completedCount === totalTasks;

							const isInProgress = completedCount > 0 && !isCompleted;
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
													alt={dialogue.title}
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
												{dialogue.title}
											</span>

											<span className="mt-1 hidden truncate text-sm text-slate-500 sm:block">
												{dialogue.description}
											</span>
										</span>

										{/* Status */}
										<span
											className={`hidden shrink-0 rounded-full px-3 py-1 text-xs font-medium sm:inline-flex ${
												isCompleted
													? "bg-emerald-500/10 text-emerald-400"
													: isInProgress
														? "bg-purple-500/10 text-purple-400"
														: "bg-slate-800 text-slate-400"
											}`}
										>
											{isCompleted
												? "Hoàn thành"
												: isInProgress
													? "Tiếp tục"
													: "Chưa bắt đầu"}
										</span>

										<ChevronDown
											size={20}
											className={`shrink-0 text-slate-500 transition-transform ${
												isOpen ? "rotate-180" : ""
											}`}
										/>
									</button>

									{isOpen && (
										<div className="space-y-4 border-t border-slate-800 px-4 py-4 sm:px-5">
											{dialogue.dialogue?.length > 0 && (
												<Link
													href={`/dialogue/${lessonId}/${dialogue.id}`}
													className="inline-flex items-center gap-2 rounded-xl border border-violet-500/40 bg-violet-500/10 px-4 py-2.5 text-sm font-semibold text-violet-300 transition hover:bg-violet-500/20 hover:text-white"
												>
													<Headphones size={17} />
													Nghe hội thoại
												</Link>
											)}
											{dialogue.tasks.length > 0 ? (
												<div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-10">
													{dialogue.tasks.map((task) => {
														const isCompleted = completedTaskIds.has(task.id);
														const isCurrent = currentTask?.id === task.id;

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
																{isCompleted ? "✓ " : ""}Bài {task.id}
															</Link>
														);
													})}
												</div>
											) : (
												<p className="text-sm text-slate-500">
													Nội dung hội thoại đang được cập nhật.
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
