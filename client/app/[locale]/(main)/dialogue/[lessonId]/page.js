"use client";

import { useState, useSyncExternalStore } from "react";
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
import {
	getDialogueProgressServerSnapshot,
	getDialogueProgressSnapshot,
	parseDialogueProgress,
	subscribeToDialogueProgress,
} from "../_utils/dialogueProgress";

export default function DialogueLessonPage() {
	const { lessonId } = useParams();
	const lesson = lessonData[lessonId];
	const [openDialogueId, setOpenDialogueId] = useState(
		lesson?.dialogues[0]?.id || null,
	);
	const progressSnapshot = useSyncExternalStore(
		subscribeToDialogueProgress,
		getDialogueProgressSnapshot,
		getDialogueProgressServerSnapshot,
	);
	const progress = parseDialogueProgress(progressSnapshot);
	const totalTaskCount =
		lesson?.dialogues.reduce((total, dialogue) => total + dialogue.tasks.length, 0) ||
		0;
	const totalCompletedTaskCount =
		lesson?.dialogues.reduce((total, dialogue) => {
			const completedIds = new Set(progress[lessonId]?.[dialogue.id] || []);
			return (
				total + dialogue.tasks.filter((task) => completedIds.has(task.id)).length
			);
		}, 0) || 0;

	if (!lesson) {
		return <div className="p-8 text-white">Không tìm thấy chủ đề hội thoại.</div>;
	}

	return (
		<div className="min-h-screen px-4 py-8 text-white sm:px-8">
			<div className="mx-auto max-w-5xl">
				<Link
					href="/dialogue"
					className="inline-flex items-center gap-2 text-slate-400 hover:text-white"
				>
					<ArrowLeft size={18} />
					Quay lại
				</Link>

				<div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
					<div className="flex flex-wrap items-center gap-3">
						<h1 className="text-2xl font-bold sm:text-3xl">{lesson.title} 🏢</h1>
						<span className="rounded-full bg-green-500/10 px-3 py-1 text-xs font-medium text-green-400">
							{lesson.level}
						</span>
					</div>

					<p className="mt-3 max-w-2xl text-slate-400">{lesson.description}</p>

					<div className="mt-5 flex flex-wrap gap-5 text-sm text-slate-400">
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

					<div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-800">
						<div
							className="h-full rounded-full bg-green-500"
							style={{
								width: `${totalTaskCount ? (totalCompletedTaskCount / totalTaskCount) * 100 : 0}%`,
							}}
						/>
					</div>
				</div>

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
										className="flex w-full items-center gap-4 px-4 py-4 text-left transition hover:bg-slate-800/40 sm:px-5"
									>
										<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-800 text-sm font-semibold text-slate-300">
											{index + 1}
										</span>
										<span className="min-w-0 flex-1">
											<span className="block font-semibold text-white">
												{dialogue.title}
											</span>
											<span className="mt-1 block text-sm text-slate-500">
												{dialogue.description}
											</span>
										</span>
										<span className="shrink-0 rounded-full bg-slate-800 px-3 py-1 text-xs font-medium text-slate-300">
											{completedCount}/{dialogue.tasks.length} hoàn thành
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
