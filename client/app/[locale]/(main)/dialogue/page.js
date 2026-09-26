"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
	ArrowRight,
	BookOpen,
	BriefcaseBusiness,
	ChevronDown,
	CircleCheck,
	Clock3,
	Grid2X2,
	House,
	MessageCircleMore,
	Plane,
	Search,
	Utensils,
} from "lucide-react";
import { lessonData } from "./_data/lessonData";
import { useLocale, useTranslations } from "next-intl";
const courseImages = {
	"coffee-shop": "/dialogue/coffee-shop/thumbnails/coffee-shop.png",
	"office-introduction":
		"/dialogue/office-introduction/thumbnails/office-introduction.png",
	"weekend-camping": "/dialogue/weekend-camping/thumbnails/weekend-camping.png",

	"asking-for-directions":
		"/dialogue/asking-for-directions/thumbnails/asking-for-direction.png",
	"at-a-hotel": "/dialogue/at-a-hotel/thumbnails/at-a-hotel.png",
};

function getCourseImage(courseId) {
	return courseImages[courseId] || "/hero-img.png";
}

const cefrLevelLabels = {
	beginner: "A1",
	a1: "A1",
	a2: "A2",
	b1: "B1",
	b2: "B2",
	c1: "C1",
	c2: "C2",
};

const courseLevelsByFilter = {
	beginner: ["beginner", "a1", "a2"],
	intermediate: ["intermediate", "b1", "b2"],
	advanced: ["advanced", "c1", "c2"],
};

const dialogueCategories = [
	"all",
	"office",
	"travel",
	"food",
	"life",
	"daily",
	"story",
];

const categoryIcons = {
	all: Grid2X2,
	office: BriefcaseBusiness,
	travel: Plane,
	food: Utensils,
	life: House,
	daily: MessageCircleMore,
	story: BookOpen,
};

const courseIdsByCategory = {
	office: ["office-introduction"],
	travel: ["at-a-hotel", "asking-for-directions", "weekend-camping"],
	food: ["coffee-shop"],
	life: ["at-a-hotel", "weekend-camping"],
	daily: [
		"at-a-hotel",
		"asking-for-directions",
		"coffee-shop",
		"office-introduction",
		"weekend-camping",
	],
	story: ["weekend-camping"],
};

function getCefrLevelLabel(level) {
	const normalizedLevel = level?.toLowerCase();
	return cefrLevelLabels[normalizedLevel] ?? level;
}

export default function DialoguePage() {
	const t = useTranslations("DialogueLanding");
	const locale = useLocale();
	const levelOptions = ["all", "beginner", "intermediate", "advanced"].map(
		(value) => ({ value, label: t(`levels.${value}`) }),
	);
	const levelLabels = Object.fromEntries(
		levelOptions.map((option) => [option.value, option.label]),
	);
	const getLocalizedCourseValue = (course, field) => {
		const key = `courses.${course.id}.${field}`;
		return t.has(key) ? t(key) : course[field];
	};
	const courses = useMemo(() => Object.values(lessonData), []);
	const [search, setSearch] = useState("");
	const [selectedLevel, setSelectedLevel] = useState("all");
	const [selectedCategory, setSelectedCategory] = useState("all");
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

	const normalizedSearch = search.trim().toLocaleLowerCase(locale);
	const courseMatchesSearch = (course) => {
		if (!normalizedSearch) return true;

		return [
			getLocalizedCourseValue(course, "title"),
			getLocalizedCourseValue(course, "description"),
			levelLabels[course.level],
		].some((value) =>
			value?.toLocaleLowerCase(locale).includes(normalizedSearch),
		);
	};
	const courseMatchesLevel = (course) => {
		if (selectedLevel === "all") return true;

		return courseLevelsByFilter[selectedLevel].includes(
			course.level?.toLowerCase(),
		);
	};
	const courseMatchesCategory = (course) =>
		selectedCategory === "all" ||
		courseIdsByCategory[selectedCategory]?.includes(course.id);
	const courseMatchesFilters = (course) =>
		courseMatchesSearch(course) && courseMatchesLevel(course);
	const currentCourseMatchesSearch = Boolean(
		currentCourse && courseMatchesFilters(currentCourse),
	);
	const visibleCourses = courses.filter(
		(course) => courseMatchesFilters(course) && courseMatchesCategory(course),
	);
	const currentStats = currentCourse ? courseStats[currentCourse.id] : null;

	return (
		<main className="min-h-screen bg-page px-4 pb-6 text-main sm:px-6 sm:pb-8 lg:px-8">
			<div className="mx-auto max-w-[1548px]">
				{/* ==================== HERO SECTION ==================== */}
				<section className="relative isolate overflow-hidden border-b border-app bg-hero">
					<div className="pointer-events-none absolute -right-12 bottom-[-70px] hidden h-44 w-72 rounded-full bg-[var(--sj-banner-glow-primary)] opacity-40 blur-3xl xl:block" />
					<div className="pointer-events-none absolute bottom-0 right-4 hidden h-[145px] w-[180px] xl:block">
						<div className="absolute bottom-0 left-0 h-[130px] w-[95px]">
							<Image
								src="/dialogue/office-introduction/shared/maria.png"
								alt=""
								fill
								priority
								className="object-contain object-bottom"
								sizes="95px"
							/>
						</div>
						<div className="absolute bottom-0 right-0 h-[145px] w-[100px]">
							<Image
								src="/dialogue/office-introduction/shared/tom.png"
								alt=""
								fill
								priority
								className="object-contain object-bottom"
								sizes="100px"
							/>
						</div>
					</div>

					<div className="relative z-10 grid min-h-[150px] items-center gap-5 px-5 py-5 sm:px-8 md:grid-cols-[minmax(0,1fr)_minmax(250px,400px)] md:gap-8 md:py-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,430px)_180px]">
						<div className="min-w-0">
							<h1 className="text-3xl font-bold tracking-tight text-main sm:text-4xl">
								{t("title")}
							</h1>
							<p className="mt-2 max-w-2xl text-sm leading-6 text-secondary sm:text-base">
								{t("subtitle")}
							</p>
						</div>
						<label className="relative block w-full">
							<span className="sr-only">{t("searchLabel")}</span>
							<Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary" />
							<input
								type="search"
								value={search}
								onChange={(event) => setSearch(event.target.value)}
								placeholder={t("searchPlaceholder")}
								className="h-12 w-full rounded-xl border border-app bg-surface pl-11 pr-4 text-sm text-main outline-none transition placeholder:text-secondary focus:border-primary focus:ring-2 focus:ring-primary/15"
							/>
						</label>
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
										● {t("learning")}
									</span>
								</div>

								<div className="min-w-0 flex-1">
									<div className="flex flex-wrap items-center gap-2">
										<h2 className="text-lg font-bold text-white sm:text-xl">
											{getLocalizedCourseValue(currentCourse, "title")}
										</h2>
										<span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
											{getCefrLevelLabel(currentCourse.level)}
										</span>
									</div>
									<p className="mt-1.5 max-w-2xl line-clamp-2 text-sm leading-5 text-slate-400">
										{getLocalizedCourseValue(currentCourse, "description")}
									</p>

									<div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-400">
										<span className="inline-flex items-center gap-1.5">
											<BookOpen className="h-4 w-4 text-violet-400" />
											{t("exercises", { count: currentStats.totalTaskCount })}
										</span>
										<span className="inline-flex items-center gap-1.5">
											<Clock3 className="h-4 w-4 text-slate-500" />~
											{currentCourse.duration}
										</span>
										<span className="inline-flex items-center gap-1.5">
											<CircleCheck className="h-4 w-4 text-violet-400" />
											{t("completedCount", {
												completed: currentStats.completedTaskCount,
												total: currentStats.totalTaskCount,
											})}
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
									{t("continue")}
									<ArrowRight className="h-5 w-5" />
								</Link>
							</div>
						</div>
					</section>
				)}
				{/* ==================== OTHER COURSES / DISCOVERY ==================== */}

				<section className="mt-7 pb-10">
					<div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-8 xl:grid-cols-[296px_minmax(0,1fr)]">
						<div className="min-w-0 lg:sticky lg:top-24 lg:self-start">
						<nav
							aria-label={t("categoryNavLabel")}
							className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-2 lg:mx-0 lg:flex-col lg:overflow-visible lg:border-r lg:border-app lg:pr-7 lg:pb-0"
						>
							{dialogueCategories.map((category) => {
								const isActive = selectedCategory === category;
								const Icon = categoryIcons[category];
								const count = category === "all"
									? courses.length
									: courses.filter((course) =>
										courseIdsByCategory[category].includes(course.id),
									).length;
								return (
									<button
										key={category}
										type="button"
										aria-pressed={isActive}
										onClick={() => setSelectedCategory(category)}
										className={`relative flex h-12 shrink-0 items-center gap-3 rounded-xl px-4 text-left text-sm font-medium transition lg:w-full ${
											isActive
												? "bg-primary/15 text-brand-text before:absolute before:inset-y-0 before:left-0 before:w-1 before:rounded-full before:bg-primary before:shadow-[0_0_12px_var(--sj-primary)]"
												: "text-secondary hover:bg-hover hover:text-main"
										}`}
									>
										<Icon className={`h-5 w-5 shrink-0 ${isActive ? "text-primary" : ""}`} strokeWidth={1.8} />
										<span className="whitespace-nowrap">{t(`categories.${category}`)}</span>
										<span className="ml-auto hidden min-w-8 rounded-full bg-surface-muted px-2 py-1 text-center text-xs text-secondary lg:inline-block">
											{count}
										</span>
									</button>
								);
							})}
						</nav>
						</div>
						<div className="min-w-0">
							<div className="mb-4 flex flex-wrap items-center justify-between gap-3">
								<h2 className="relative pb-3 text-2xl font-bold text-main after:absolute after:bottom-0 after:left-0 after:h-1 after:w-12 after:rounded-full after:bg-primary">
									{t("explore")}
								</h2>
								<div className="flex items-center gap-4">
									<span className="text-sm text-secondary">
										{t("topics", { count: visibleCourses.length })}
									</span>
									<label className="relative block">
										<span className="sr-only">{t("levelFilter")}</span>
										<select
											value={selectedLevel}
											onChange={(event) => setSelectedLevel(event.target.value)}
											className="h-11 min-w-36 appearance-none rounded-xl border border-app bg-surface pl-4 pr-9 text-sm font-medium text-main outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
										>
											{levelOptions.map((option) => (
												<option key={option.value} value={option.value}>
													{option.label}
												</option>
											))}
										</select>
										<ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary" />
									</label>
								</div>
							</div>
							{visibleCourses.length > 0 ? (
						<div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
							{visibleCourses.map((course) => {
								const stats = courseStats[course.id];
								const statusLabel = stats.isCompleted
									? t("completed")
									: stats.isStarted
										? t("learning")
										: t("notStarted");
								const actionLabel = stats.isCompleted
									? t("review")
									: stats.isStarted
										? t("continue")
										: t("start");
								const statusClassName = stats.isCompleted
									? "border-emerald-500/30 bg-emerald-600 text-white"
									: stats.isStarted
										? "border-white/20 bg-primary text-white"
										: "border-white/15 bg-black/70 text-white";

								return (
									<Link
										key={course.id}
										href={`/dialogue/${course.id}`}
										className="group flex h-full flex-col overflow-hidden rounded-[14px] border border-app bg-surface shadow-sm transition duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg"
									>
										{/* Thumbnail */}
										<div className="relative aspect-[2.1/1] overflow-hidden bg-slate-900">
											<Image
												src={getCourseImage(course.id)}
												alt={course.title}
												fill
											className="object-cover transition duration-300 group-hover:scale-[1.03]"
												sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
											/>

											<div className="absolute inset-0 bg-gradient-to-t from-[#0b1424]/30 via-transparent to-transparent" />

											{/* Dialogue count */}
											<span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-md bg-black/70 px-2.5 py-1.5 text-xs font-semibold text-white backdrop-blur-sm">
												<BookOpen className="h-3.5 w-3.5" />
												{t("dialogues", { count: course.dialogues.length })}
											</span>

											{/* Level badge */}
											<span className="absolute right-3 top-3 rounded-md border border-primary/20 bg-[#062435]/90 px-2.5 py-1 text-[11px] font-semibold text-cyan-300 backdrop-blur-sm">
												{getCefrLevelLabel(course.level)}
											</span>

											<span
												className={`absolute left-3 top-3 rounded-md border px-2.5 py-1 text-[11px] font-semibold shadow-sm ${statusClassName}`}
											>
												{statusLabel}
											</span>
										</div>

										{/* Content */}
										<div className="flex min-h-[196px] flex-1 flex-col p-5">
											<h3 className="line-clamp-1 text-lg font-bold text-main">
												{getLocalizedCourseValue(course, "title")}
											</h3>

											<p className="mt-1.5 min-h-12 line-clamp-2 text-sm leading-6 text-secondary">
												{getLocalizedCourseValue(course, "description")}
											</p>

											<div className="mt-auto flex items-center gap-3 pt-4">
												<div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-muted">
													<div
														className="h-full rounded-full bg-primary transition-all duration-500"
														style={{ width: `${stats.progressPercent}%` }}
													/>
												</div>
												<span className="shrink-0 text-xs font-semibold text-secondary">
													{stats.completedTaskCount}/{stats.totalTaskCount}
												</span>
											</div>

											<span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-brand-text">
												{actionLabel}
												<ArrowRight className="h-4 w-4" />
											</span>
										</div>
									</Link>
								);
							})}
						</div>
							) : (
							<div className="mt-2 rounded-2xl border border-dashed border-app bg-surface/40 px-6 py-14 text-center">
								<p className="text-lg font-semibold text-main">
									{normalizedSearch ||
									selectedLevel === "all" ||
									selectedCategory !== "all"
										? t("noResults")
										: t("noLevelResults")}
								</p>
								{normalizedSearch && (
									<p className="mt-2 text-sm text-secondary">
										{t("tryAnotherSearch")}
									</p>
								)}
							</div>
							)}
						</div>
					</div>
				</section>
			</div>
		</main>
	);
}
