"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
	ArrowRight,
	BookOpen,
	Clock3,
	Headphones,
	Search,
} from "lucide-react";
import { lessonData } from "./_data/lessonData";

const courseImages = {
	"office-introduction":
		"/dialogue/office-introduction/thumbnails/meeting-tem.png",
};

function getCourseImage(courseId) {
	return courseImages[courseId] || "/hero-img.png";
}

export default function DialoguePage() {
	const courses = useMemo(() => Object.values(lessonData), []);
	const [search, setSearch] = useState("");
	const [latestProgress, setLatestProgress] = useState(null);

	useEffect(() => {
		async function loadCurrentCourse() {
			try {
				const response = await fetch("/api/v1/dialogue-progress/latest", {
					credentials: "include",
				});

				if (!response.ok) return;

				const data = await response.json();
				setLatestProgress(data.data.progress || null);
			} catch (error) {
				console.error("Load latest dialogue progress error:", error);
			}
		}

		loadCurrentCourse();
	}, []);

	const currentCourse =
		courses.find((course) => course.id === latestProgress?.lessonId) || null;
	const normalizedSearch = search.trim().toLocaleLowerCase("vi");
	const courseMatchesSearch = (course) =>
		!normalizedSearch ||
		[course.title, course.description, course.level].some((value) =>
			value?.toLocaleLowerCase("vi").includes(normalizedSearch),
		);
	const currentCourseMatchesSearch =
		currentCourse && courseMatchesSearch(currentCourse);
	const otherCourses = courses.filter((course) => {
		if (course.id === currentCourse?.id) return false;
		return courseMatchesSearch(course);
	});

	const currentDialogue = currentCourse?.dialogues.find(
		(dialogue) => dialogue.id === latestProgress?.dialogueId,
	);
	const completedTaskIds = new Set(latestProgress?.completedTaskIds || []);
	const currentCompletedCount =
		currentDialogue?.tasks.filter((task) => completedTaskIds.has(task.id)).length ||
		0;
	const currentTaskCount = currentDialogue?.tasks.length || 0;
	const currentProgressPercent = currentTaskCount
		? Math.round((currentCompletedCount / currentTaskCount) * 100)
		: 0;

	return (
		<main className="min-h-screen bg-[#030616] px-4 py-6 text-white sm:px-6 sm:py-8 lg:px-8">
			<div className="mx-auto max-w-7xl">
				<section className="relative isolate min-h-[330px] overflow-hidden rounded-3xl border border-slate-800 bg-[#050b18] shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
					<div className="absolute inset-y-0 right-0 w-full md:w-[57%]">
						<Image
							src="/hero-img.png"
							alt="Maria và Tom đang luyện hội thoại"
							fill
							priority
							className="object-cover object-center opacity-45 md:opacity-100"
							sizes="(max-width: 768px) 100vw, 57vw"
						/>
						<div className="absolute inset-0 bg-[#050b18]/60 md:bg-transparent md:bg-gradient-to-r md:from-[#050b18] md:via-[#050b18]/20 md:to-transparent" />
						<div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#050b18] to-transparent md:hidden" />
					</div>

					<div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-blue-800/5 blur-3xl" />

					<div className="relative z-10 flex min-h-[330px] max-w-2xl flex-col justify-center px-6 py-10 sm:px-10 lg:px-14">
						<div className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-blue-500/20 bg-[#09172b]/90 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-blue-400">
							<Headphones className="h-4 w-4" />
							Luyện nghe mỗi ngày
						</div>

						<h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
							Hội thoại thực tế
						</h1>
						<p className="mt-3 max-w-xl text-base leading-7 text-slate-300 sm:text-lg">
							Luyện nghe và phản xạ qua các tình huống đời thường.
						</p>

						<label className="relative mt-7 block max-w-lg">
							<span className="sr-only">Tìm kiếm hội thoại</span>
							<Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
							<input
								type="search"
								value={search}
								onChange={(event) => setSearch(event.target.value)}
								placeholder="Tìm kiếm hội thoại..."
								className="h-14 w-full rounded-2xl border border-slate-700/90 bg-[#081226]/90 pl-12 pr-4 text-sm text-white shadow-[0_12px_30px_rgba(0,0,0,0.18)] outline-none transition placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15"
							/>
						</label>
					</div>
				</section>

				{currentCourseMatchesSearch && (
					<section className="mt-10">
						<div className="mb-4 flex items-end justify-between gap-4">
							<div>
								<p className="text-sm font-semibold uppercase tracking-[0.14em] text-blue-400">
									Tiếp tục hành trình
								</p>
								<h2 className="mt-1 text-2xl font-bold text-white">Đang học</h2>
							</div>
							{currentProgressPercent > 0 && (
								<span className="text-sm font-semibold text-emerald-400">
									{currentProgressPercent}% hoàn thành gần nhất
								</span>
							)}
						</div>

						<div className="overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-[#0b1529] to-[#07101f] p-4 shadow-[0_18px_50px_rgba(0,0,0,0.2)] sm:p-5">
							<div className="flex flex-col gap-5 lg:flex-row lg:items-center">
								<div className="relative aspect-[16/9] w-full shrink-0 overflow-hidden rounded-xl border border-slate-700/70 sm:w-64 lg:w-72">
									<Image
										src={getCourseImage(currentCourse.id)}
										alt={currentCourse.title}
										fill
										className="object-cover"
										sizes="(max-width: 640px) 100vw, 288px"
									/>
									<div className="absolute inset-0 bg-gradient-to-t from-slate-950/45 via-transparent to-transparent" />
								</div>

								<div className="min-w-0 flex-1">
									<h3 className="text-xl font-bold text-white sm:text-2xl">
										{currentCourse.title}
									</h3>
									<p className="mt-2 max-w-2xl line-clamp-2 leading-6 text-slate-400">
										{currentCourse.description}
									</p>

									<div className="mt-4 flex flex-wrap gap-2 text-sm text-slate-300">
										<span className="inline-flex items-center gap-2 rounded-lg border border-blue-400/15 bg-blue-400/10 px-3 py-1.5 text-blue-300">
											<span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
											{currentCourse.level}
										</span>
										<span className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-1.5">
											<Clock3 className="h-4 w-4 text-slate-500" />
											{currentCourse.duration}
										</span>
										<span className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-1.5">
											<BookOpen className="h-4 w-4 text-slate-500" />
											{currentCourse.dialogues.length} hội thoại
										</span>
									</div>

									{currentTaskCount > 0 && (
										<div className="mt-5 max-w-2xl">
											<div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
												<div
													className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500"
													style={{ width: `${currentProgressPercent}%` }}
												/>
											</div>
										</div>
									)}
								</div>

								<Link
									href={`/dialogue/${currentCourse.id}`}
									className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-6 font-semibold text-white shadow-[0_10px_28px_rgba(79,70,229,0.25)] transition hover:-translate-y-0.5 hover:from-blue-500 hover:to-violet-500"
								>
									Tiếp tục học
									<ArrowRight className="h-5 w-5" />
								</Link>
							</div>
						</div>
					</section>
				)}

				{otherCourses.length > 0 ? (
					<section className="mt-12 pb-10">
						<div className="flex items-end justify-between gap-4">
							<div>
								<p className="text-sm font-semibold uppercase tracking-[0.14em] text-blue-400">
									Chọn một chủ đề
								</p>
								<h2 className="mt-1 text-2xl font-bold text-white">
									Khám phá hội thoại
								</h2>
							</div>
							<span className="text-sm text-slate-500">
								{otherCourses.length} khóa học
							</span>
						</div>

						<div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
							{otherCourses.map((course) => (
								<Link
									key={course.id}
									href={`/dialogue/${course.id}`}
									className="group relative flex overflow-hidden rounded-[1.75rem] border border-slate-800/90 bg-gradient-to-b from-[#0b162b] to-[#07101f] shadow-[0_18px_45px_rgba(0,0,0,0.22)] transition duration-300 hover:-translate-y-1.5 hover:border-emerald-400/40 hover:shadow-[0_26px_65px_rgba(6,78,59,0.22)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-4 focus-visible:ring-offset-[#030616] sm:flex-col"
								>
									<div className="relative min-h-48 w-[42%] shrink-0 overflow-hidden bg-slate-900 sm:aspect-[16/10] sm:min-h-0 sm:w-full">
										<Image
											src={getCourseImage(course.id)}
											alt={course.title}
											fill
											className="object-cover transition duration-700 ease-out group-hover:scale-105"
											sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
										/>
										<div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-[#0b162b]/45 sm:bg-gradient-to-t sm:from-[#0b162b]/75 sm:via-transparent sm:to-transparent" />
										<span className="absolute left-3 top-3 rounded-full border border-emerald-300/25 bg-emerald-950/70 px-3 py-1.5 text-xs font-semibold text-emerald-300 shadow-lg backdrop-blur-md sm:left-auto sm:right-4 sm:top-4">
											{course.level}
										</span>
									</div>

									<div className="flex min-w-0 flex-1 flex-col p-5 sm:p-6">
										<h3 className="text-lg font-bold leading-snug text-white transition group-hover:text-emerald-300 sm:text-xl">
											{course.title}
										</h3>
										<p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-400 sm:min-h-[4.5rem]">
											{course.description}
										</p>

										<div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-800/80 pt-4 text-xs font-medium text-slate-400">
											<span className="inline-flex items-center gap-1.5">
												<BookOpen className="h-4 w-4 text-blue-400" />
												{course.dialogues.length} hội thoại
											</span>
											<span className="inline-flex items-center gap-1.5">
												<Clock3 className="h-4 w-4 text-violet-400" />
												{course.duration}
											</span>
										</div>

										<div className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-emerald-300">
											Bắt đầu học
											<span className="grid h-8 w-8 place-items-center rounded-full bg-emerald-500/10 transition duration-300 group-hover:translate-x-1 group-hover:bg-emerald-500 group-hover:text-white">
												<ArrowRight className="h-4 w-4" />
											</span>
										</div>
									</div>
								</Link>
							))}
						</div>
					</section>
				) : normalizedSearch && !currentCourseMatchesSearch ? (
					<div className="mt-10 rounded-2xl border border-dashed border-slate-700 bg-slate-900/30 px-6 py-14 text-center">
						<p className="text-lg font-semibold text-white">
							Không tìm thấy hội thoại phù hợp.
						</p>
						<p className="mt-2 text-sm text-slate-400">
							Thử tìm kiếm bằng từ khác.
						</p>
					</div>
				) : null}
			</div>
		</main>
	);
}
