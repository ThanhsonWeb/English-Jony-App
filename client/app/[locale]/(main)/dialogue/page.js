"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
	ArrowRight,
	BookOpen,
	CircleCheck,
	Clock3,
	Headphones,
	Search,
} from "lucide-react";
import { lessonData } from "./_data/lessonData";

const courseImages = {
	"office-introduction":
		"/dialogue/office-introduction/thumbnails/office-introduction.png",
	"weekend-camping": "/dialogue/weekend-camping/thumbnails/weekend-camping.png",
};

const levelOptions = [
	{ value: "all", label: "Tất cả" },
	{ value: "beginner", label: "Cơ Bản" },
	{ value: "intermediate", label: "Trung Cấp" },
	{ value: "advanced", label: "Nâng Cao" },
];

const levelLabels = Object.fromEntries(
	levelOptions
		.filter((option) => option.value !== "all")
		.map((option) => [option.value, option.label]),
);

function getCourseImage(courseId) {
	return courseImages[courseId] || "/hero-img.png";
}

export default function DialoguePage() {
	const courses = useMemo(() => Object.values(lessonData), []);
	const [search, setSearch] = useState("");
	const [selectedLevel, setSelectedLevel] = useState("all");
	const [progressByLesson, setProgressByLesson] = useState({});

	useEffect(() => {
		let shouldIgnoreResult = false;

		async function loadProgress() {
			try {
				const lessonProgressEntries = await Promise.all(
					courses.map(async (course) => {
						const response = await fetch(
							`/api/v1/dialogue-progress/${course.id}`,
							{
								credentials: "include",
								cache: "no-store",
							},
						);

						if (!response.ok) return [course.id, []];

						const data = await response.json();
						return [course.id, data.data.progress || []];
					}),
				);

				if (!shouldIgnoreResult) {
					setProgressByLesson(Object.fromEntries(lessonProgressEntries));
				}
			} catch (error) {
				console.error("Load dialogue progress error:", error);
			}
		}

		loadProgress();
		window.addEventListener("focus", loadProgress);
		window.addEventListener("dialogue-progress-updated", loadProgress);

		return () => {
			shouldIgnoreResult = true;
			window.removeEventListener("focus", loadProgress);
			window.removeEventListener("dialogue-progress-updated", loadProgress);
		};
	}, [courses]);

	const courseStats = useMemo(() => {
		return Object.fromEntries(
			courses.map((course) => {
				const savedProgress = progressByLesson[course.id] || [];
				const progressByDialogue = new Map(
					savedProgress.map((item) => [
						item.dialogueId,
						new Set((item.completedTaskIds || []).map(String)),
					]),
				);
				const totalTaskCount = course.dialogues.reduce(
					(total, dialogue) => total + dialogue.tasks.length,
					0,
				);
				const completedTaskCount = course.dialogues.reduce(
					(total, dialogue) => {
						const completedIds = progressByDialogue.get(dialogue.id);
						return (
							total +
							dialogue.tasks.filter((task) =>
								completedIds?.has(String(task.id)),
							).length
						);
					},
					0,
				);
				const progressPercent = totalTaskCount
					? Math.round((completedTaskCount / totalTaskCount) * 100)
					: 0;
				const latestUpdatedAt = savedProgress.reduce(
					(latest, item) =>
						Math.max(latest, Date.parse(item.updatedAt || 0) || 0),
					0,
				);

				return [
					course.id,
					{
						totalTaskCount,
						completedTaskCount,
						progressPercent,
						isStarted: completedTaskCount > 0,
						isCompleted:
							totalTaskCount > 0 && completedTaskCount === totalTaskCount,
						latestUpdatedAt,
					},
				];
			}),
		);
	}, [courses, progressByLesson]);

	const currentCourse = courses
		.filter((course) => {
			const stats = courseStats[course.id];
			return stats?.isStarted && !stats.isCompleted;
		})
		.sort(
			(first, second) =>
				courseStats[second.id].latestUpdatedAt -
				courseStats[first.id].latestUpdatedAt,
		)[0];

	const normalizedSearch = search.trim().toLocaleLowerCase("vi");
	const courseMatchesSearch = (course) => {
		if (!normalizedSearch) return true;

		return [course.title, course.description, levelLabels[course.level]].some(
			(value) => value?.toLocaleLowerCase("vi").includes(normalizedSearch),
		);
	};
	const courseMatchesLevel = (course) =>
		selectedLevel === "all" || course.level === selectedLevel;
	const courseMatchesFilters = (course) =>
		courseMatchesSearch(course) && courseMatchesLevel(course);
	const currentCourseMatchesSearch = Boolean(
		currentCourse && courseMatchesFilters(currentCourse),
	);
	const visibleCourses = courses.filter(courseMatchesFilters);
	const currentStats = currentCourse ? courseStats[currentCourse.id] : null;

	return (
		<main className="min-h-screen bg-page px-4 py-6 text-main sm:px-6 sm:py-8 lg:px-8">
			<div className="mx-auto max-w-7xl">
				{/* ==================== HERO SECTION ==================== */}
				<section className="relative isolate min-h-[205px] overflow-hidden border-b border-app bg-hero md:min-h-[220px]">
					<div className="absolute inset-0 z-0 bg-gradient-to-r from-hero via-hero/90 to-transparent" />
					<div className="pointer-events-none absolute right-[6%] top-[12%] z-[1] hidden h-52 w-[42%] rounded-full bg-violet-600/10 blur-[70px] md:block" />
					<div className="pointer-events-none absolute bottom-[-15%] right-[3%] z-[1] hidden h-48 w-[48%] rounded-full bg-blue-600/10 blur-[65px] md:block" />

					<div className="pointer-events-none absolute inset-y-0 right-[5%] z-20 hidden w-[42%] md:block lg:right-[7%] lg:w-[40%]">
						<div className="absolute bottom-0 left-0 h-[92%] w-[54%]">
							<Image
								src="/dialogue/office-introduction/shared/maria.png"
								alt=""
								fill
								priority
								className="object-contain object-bottom  "
								sizes="24vw"
							/>
						</div>
						<div className="absolute bottom-0 right-[2%] h-[96%] w-[53%]">
							<Image
								src="/dialogue/office-introduction/shared/tom.png"
								alt=""
								fill
								priority
								className="object-contain object-bottom  "
								sizes="24vw"
							/>
						</div>
					</div>

					<div className="pointer-events-none absolute bottom-[-18%] right-[2%] z-10 hidden h-64 w-[58%] opacity-70 md:block">
						<div className="absolute inset-0 rounded-[50%] border-t border-violet-500/55 [transform:rotate(-7deg)] shadow-[0_-10px_35px_rgba(124,58,237,0.08)]" />
						<div className="absolute inset-x-4 inset-y-4 rounded-[50%] border-t border-blue-500/50 [transform:rotate(-7deg)]" />
						<div className="absolute inset-x-8 inset-y-8 rounded-[50%] border-t border-violet-400/45 [transform:rotate(-7deg)]" />
						<div className="absolute inset-x-12 inset-y-12 rounded-[50%] border-t border-blue-400/35 [transform:rotate(-7deg)]" />
						<div className="absolute inset-x-16 inset-y-16 rounded-[50%] border-t border-violet-300/25 [transform:rotate(-7deg)]" />
					</div>

					<div className="absolute -left-24 -top-24 z-[1] h-72 w-72 rounded-full bg-violet-700/10 blur-3xl" />
					{/* Content  */}
					<div className="relative z-30 flex min-h-[205px] max-w-2xl flex-col justify-center px-5 py-6 sm:px-8 md:min-h-[220px] md:max-w-[55%] md:px-9 lg:px-12 xl:px-14">
						<h1 className="bg-gradient-to-r from-violet-300 to-blue-300 bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:text-4xl">
							Hội thoại thực tế{" "}
							<Headphones className="inline h-7 w-7 text-blue-300" />
						</h1>
						<p className="mt-3 max-w-xl text-sm leading-6 text-slate-400 sm:text-base">
							Luyện nghe và phản xạ qua các tình huống đời thường.
						</p>

						<div className="mt-4 flex w-full max-w-xl flex-col gap-3 sm:flex-row sm:items-center">
							<label className="relative block flex-1">
								<span className="sr-only">Tìm kiếm hội thoại</span>
								<Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
								<input
									type="search"
									value={search}
									onChange={(event) => setSearch(event.target.value)}
									placeholder="Tìm kiếm bài học hoặc chủ đề..."
									className="h-11 w-full rounded-lg border border-app bg-surface pl-11 pr-4 text-sm text-main outline-none transition placeholder:text-secondary focus:border-primary focus:ring-2 focus:ring-primary/15"
								/>
							</label>

							<label className="relative shrink-0 sm:w-48">
								<span className="sr-only">Lọc hội thoại theo trình độ</span>
								<select
									value={selectedLevel}
									onChange={(event) => setSelectedLevel(event.target.value)}
									className="h-11 w-full rounded-lg border border-app bg-surface px-3 text-sm text-secondary outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
								>
									{levelOptions.map((option) => (
										<option key={option.value} value={option.value}>
											Cấp độ: {option.label}
										</option>
									))}
								</select>
							</label>
						</div>
					</div>
				</section>
				{/* ==================== CURRENT / IN-PROGRESS COURSE ==================== */}

				{currentCourseMatchesSearch && (
					<section className="mt-6">
						<div className="overflow-hidden rounded-xl border border-app bg-surface p-4 shadow-sm sm:p-5">
							<div className="flex flex-col gap-5 md:flex-row md:items-center lg:gap-6">
								<div className="relative aspect-[16/9] w-full shrink-0 overflow-hidden rounded-lg border border-slate-700/70 md:w-56 lg:w-64">
									<Image
										src={getCourseImage(currentCourse.id)}
										alt={currentCourse.title}
										fill
										className="object-cover"
										sizes="(max-width: 768px) 100vw, 256px"
									/>
									<div className="absolute inset-0 bg-gradient-to-t from-slate-950/45 via-transparent to-transparent" />
									<span className="absolute left-2 top-2 rounded-full border border-white/20 bg-primary px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm">
										● Đang học
									</span>
								</div>

								<div className="min-w-0 flex-1">
									<div className="flex flex-wrap items-center gap-2">
										<h2 className="text-lg font-bold text-white sm:text-xl">
											{currentCourse.title}
										</h2>
										<span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
											{levelLabels[currentCourse.level]}
										</span>
									</div>
									<p className="mt-1.5 max-w-2xl line-clamp-2 text-sm leading-5 text-slate-400">
										{currentCourse.description}
									</p>

									<div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-400">
										<span className="inline-flex items-center gap-1.5">
											<BookOpen className="h-4 w-4 text-violet-400" />
											{currentStats.totalTaskCount} bài tập
										</span>
										<span className="inline-flex items-center gap-1.5">
											<Clock3 className="h-4 w-4 text-slate-500" />~
											{currentCourse.duration}
										</span>
										<span className="inline-flex items-center gap-1.5">
											<CircleCheck className="h-4 w-4 text-violet-400" />
											{currentStats.completedTaskCount}/
											{currentStats.totalTaskCount} hoàn thành
										</span>
									</div>

									{currentStats.totalTaskCount > 0 && (
										<div className="mt-3 flex max-w-xl items-center gap-3">
											<div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800">
												<div
													className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500"
													style={{ width: `${currentStats.progressPercent}%` }}
												/>
											</div>
											<span className="w-9 text-right text-xs font-semibold text-slate-400">
												{currentStats.progressPercent}%
											</span>
										</div>
									)}
								</div>

								<Link
									href={`/dialogue/${currentCourse.id}`}
									className="inline-flex min-h-11 shrink-0 self-stretch items-center justify-center gap-3 rounded-lg bg-gradient-to-r from-violet-600 to-blue-600 px-6 text-sm font-semibold text-white shadow-lg shadow-primary/15 transition hover:-translate-y-0.5 hover:from-violet-500 hover:to-blue-500 md:self-center"
								>
									Tiếp tục học
									<ArrowRight className="h-5 w-5" />
								</Link>
							</div>
						</div>
					</section>
				)}
				{/* ==================== OTHER COURSES / DISCOVERY ==================== */}

				{visibleCourses.length > 0 ? (
					<section className="mt-12 pb-10">
						<div className="flex items-end justify-between gap-4">
							<div>
							
								<h2 className="mt-1 text-2xl font-bold text-white">
									Khám phá hội thoại
								</h2>
							</div>
							<span className="text-sm text-slate-500">
								{visibleCourses.length} chủ đề
							</span>
						</div>

						<div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
							{visibleCourses.map((course) => {
								const stats = courseStats[course.id];
								const statusLabel = stats.isCompleted
									? "Hoàn thành"
									: stats.isStarted
										? "Đang học"
										: "Chưa bắt đầu";
								const actionLabel = stats.isCompleted
									? "Ôn tập lại"
									: stats.isStarted
										? "Tiếp tục học"
										: "Bắt đầu học";
								const statusClassName = stats.isCompleted
									? "border-emerald-500/30 bg-emerald-600 text-white"
									: stats.isStarted
										? "border-white/20 bg-primary text-white"
										: "border-white/15 bg-black/70 text-white";

								return (
									<Link
										key={course.id}
										href={`/dialogue/${course.id}`}
										className="group overflow-hidden rounded-xl border border-app bg-surface shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-md"
									>
									{/* Thumbnail */}
									<div className="relative aspect-video overflow-hidden bg-slate-900">
										<Image
											src={getCourseImage(course.id)}
											alt={course.title}
											fill
											className="object-cover transition duration-300 group-hover:scale-[1.02]"
											sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
										/>

										<div className="absolute inset-0 bg-gradient-to-t from-[#0b1424]/85 via-transparent to-transparent" />

										{/* Dialogue count */}
										<span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-md bg-black/70 px-2.5 py-1.5 text-xs font-semibold text-white backdrop-blur-sm">
											<BookOpen className="h-3.5 w-3.5" />
											{course.dialogues.length} hội thoại
										</span>

										{/* Level badge */}
										<span className="absolute right-3 top-3 rounded-md border border-blue-400/20 bg-[#0a1530]/90 px-2.5 py-1 text-[11px] font-semibold text-blue-300 backdrop-blur-sm">
											{levelLabels[course.level]}
										</span>

										<span
											className={`absolute left-3 top-3 rounded-md border px-2.5 py-1 text-[11px] font-semibold shadow-sm ${statusClassName}`}
										>
											{statusLabel}
										</span>
									</div>

									{/* Content */}
									<div className="p-4">
										<h3 className="line-clamp-1 text-base font-bold text-white transition ">
											{course.title}
										</h3>

										<p className="mt-1.5 line-clamp-2 text-sm leading-5 text-slate-400">
											{course.description}
										</p>

										<div className="mt-4 flex items-center gap-3">
											<div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-muted">
												<div
													className="h-full rounded-full bg-emerald-500 transition-all duration-500"
													style={{ width: `${stats.progressPercent}%` }}
												/>
											</div>
											<span className="shrink-0 text-xs font-semibold text-secondary">
												{stats.completedTaskCount}/{stats.totalTaskCount}
											</span>
										</div>

										<span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
											{actionLabel}
											<ArrowRight className="h-4 w-4" />
										</span>
									</div>
									</Link>
								);
							})}
						</div>
					</section>
				) : (
					<div className="mt-10 rounded-2xl border border-dashed border-slate-700 bg-slate-900/30 px-6 py-14 text-center">
						<p className="text-lg font-semibold text-white">
							{normalizedSearch || selectedLevel === "all"
								? "Không tìm thấy hội thoại phù hợp."
								: "Chưa có chủ đề ở trình độ này."}
						</p>
						{normalizedSearch && (
							<p className="mt-2 text-sm text-slate-400">
								Thử tìm kiếm bằng từ khác.
							</p>
						)}
					</div>
				)}
			</div>
		</main>
	);
}
