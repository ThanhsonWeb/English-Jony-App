"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import {
	ArrowRight,
	BookOpen,
	BriefcaseBusiness,
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	CircleCheck,
	Clock3,
	GraduationCap,
	Grid2X2,
	House,
	MessageCircleMore,
	Plane,
	Search,
	Utensils,
} from "lucide-react";
import { lessonData } from "./_data/lessonData";
import { getLocalizedDialogueValue } from "@/app/_lib/dialogue/localization";
import { matchesCourseCategory } from "@/app/_lib/dialogue/catalogueCategories.mjs";
import { useLocale, useTranslations } from "next-intl";
const courseImages = {
	"coffee-shop": "/dialogue/coffee-shop/thumbnails/coffee-shop.png",
	"office-introduction":
		"/dialogue/office-introduction/thumbnails/office-introduction.png",
	"weekend-camping": "/dialogue/weekend-camping/thumbnails/weekend-camping.png",

	"asking-for-directions":
		"/dialogue/asking-for-directions/thumbnails/asking-for-direction.png",
	"at-a-hotel": "/dialogue/at-a-hotel/thumbnails/at-a-hotel.png",
	"grocery-store": "/dialogue/grocery-store/thumbnails/grocery-store.png",
	"restaurant": "/dialogue/restaurant/thumbnails/restaurant.png",
	"walk-in-the-park": "/dialogue/walk-in-the-park/thumbnails/walk-in-the-park.png",
	"ten-minutes-a-day": "/stories/ten-minutes-a-day/thumbnails/ten-minutes-a-day.png",
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
	const getLocalizedCourseValue = (course, field) => getLocalizedDialogueValue(course, field, locale);
	const courses = useMemo(() => Object.values(lessonData), []);
	const [search, setSearch] = useState("");
	const [selectedLevel, setSelectedLevel] = useState("all");
	const [selectedCategory, setSelectedCategory] = useState("all");
	const categoryNavRef = useRef(null);
	const [categoryScroll, setCategoryScroll] = useState({
		left: false,
		right: false,
	});
	const [progressByLesson, setProgressByLesson] = useState({});

	useEffect(() => {
		const nav = categoryNavRef.current;
		if (!nav) return;

		const updateScrollButtons = () => {
			const fitsWithoutButtons =
				nav.scrollWidth <= nav.parentElement.clientWidth + 1;
			const left = !fitsWithoutButtons && nav.scrollLeft > 1;
			const right =
				!fitsWithoutButtons &&
				nav.scrollLeft + nav.clientWidth < nav.scrollWidth - 1;
			setCategoryScroll((previous) =>
				previous.left === left && previous.right === right
					? previous
					: { left, right },
			);
		};

		const keepSelectedVisible = () => {
			if (window.innerWidth >= 1280) return;
			const selected = nav.querySelector('[aria-pressed="true"]');
			if (!selected) return;
			const navRect = nav.getBoundingClientRect();
			const selectedRect = selected.getBoundingClientRect();
			if (selectedRect.left < navRect.left + 8) {
				nav.scrollBy({ left: selectedRect.left - navRect.left - 8 });
			} else if (selectedRect.right > navRect.right - 8) {
				nav.scrollBy({ left: selectedRect.right - navRect.right + 8 });
			}
		};

		const resizeObserver = new ResizeObserver(updateScrollButtons);
		resizeObserver.observe(nav);
		nav.addEventListener("scroll", updateScrollButtons, { passive: true });
		window.addEventListener("resize", keepSelectedVisible);
		keepSelectedVisible();
		updateScrollButtons();

		return () => {
			resizeObserver.disconnect();
			nav.removeEventListener("scroll", updateScrollButtons);
			window.removeEventListener("resize", keepSelectedVisible);
		};
	}, [selectedCategory]);

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
		matchesCourseCategory(course, selectedCategory);
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
		<main className="min-h-screen bg-page px-4 pb-10 text-main sm:px-6 lg:px-8">
			<div className="mx-auto max-w-[1548px]">
				{/* ==================== HERO SECTION ==================== */}
				<section className="bg-hero">
					<div className="grid items-center gap-5 px-5 py-6 sm:px-8 sm:py-7 md:grid-cols-[minmax(0,1fr)_minmax(220px,320px)] md:gap-5 md:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,400px)] lg:gap-8 lg:px-8">
						<div className="min-w-0">
							<h1 className="text-3xl font-bold tracking-tight text-main sm:text-4xl">
								{t.rich("title", {
									accent: (text) => (
										<span className="text-brand-text">{text}</span>
									),
								})}
							</h1>
							<p className="mt-1.5 max-w-2xl text-sm leading-6 text-secondary sm:text-base">
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
								className="h-12 w-full rounded-xl border border-app bg-surface pl-11 pr-4 text-sm text-main shadow-sm outline-none transition placeholder:text-secondary focus:border-primary focus:ring-2 focus:ring-primary/15"
							/>
						</label>
					</div>
				</section>
				{/* ==================== CURRENT / IN-PROGRESS COURSE ==================== */}

				{currentCourseMatchesSearch && (
					<section className="mt-5">
						<div className="overflow-hidden rounded-xl border border-app bg-gradient-to-br from-surface via-surface to-primary/5 p-4 shadow-sm sm:p-5 md:p-3 lg:p-4 xl:p-5">
							<div className="flex flex-col gap-5 md:flex-row md:items-center md:gap-3 lg:gap-4 xl:gap-6">
								<div className="relative aspect-[16/9] w-full shrink-0 overflow-hidden rounded-lg border border-app md:w-48 lg:w-56 xl:w-64">
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
										<h2 className="text-lg font-bold text-main sm:text-xl">
											{getLocalizedCourseValue(currentCourse, "title")}
										</h2>
										<span className="rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-brand-text">
											{getCefrLevelLabel(currentCourse.level)}
										</span>
									</div>
									<p className="mt-1.5 max-w-2xl line-clamp-2 text-sm leading-5 text-secondary">
										{getLocalizedCourseValue(currentCourse, "description")}
									</p>

									<div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-secondary">
										<span className="inline-flex items-center gap-1.5">
											<BookOpen className="h-4 w-4 text-brand-text" />
											{t("exercises", { count: currentStats.totalTaskCount })}
										</span>
										<span className="inline-flex items-center gap-1.5">
											<Clock3 className="h-4 w-4 text-secondary" />~
											{currentCourse.duration}
										</span>
										<span className="inline-flex items-center gap-1.5">
											<CircleCheck className="h-4 w-4 text-brand-text" />
											{t("completedCount", {
												completed: currentStats.completedTaskCount,
												total: currentStats.totalTaskCount,
											})}
										</span>
									</div>

									{currentStats.totalTaskCount > 0 && (
										<div className="mt-3 flex max-w-xl items-center gap-3">
											<div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-muted">
												<div
													className="h-full rounded-full bg-primary transition-all duration-500"
													style={{ width: `${currentStats.progressPercent}%` }}
												/>
											</div>
											<span className="w-9 text-right text-xs font-semibold text-secondary">
												{currentStats.progressPercent}%
											</span>
										</div>
									)}
								</div>

								<Link
									href={`/dialogue/${currentCourse.id}`}
									className="inline-flex min-h-11 shrink-0 self-stretch items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-primary px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary md:self-center lg:gap-3 lg:px-5 xl:px-6"
								>
									{t("continue")}
									<ArrowRight className="h-5 w-5" />
								</Link>
							</div>
						</div>
					</section>
				)}
				{/* ==================== OTHER COURSES / DISCOVERY ==================== */}

				<section className="mt-6 pb-10">
					<div className="grid min-w-0 items-start gap-5 xl:grid-cols-[272px_minmax(0,1fr)] xl:gap-6">
						<div className="min-w-0 xl:sticky xl:top-[140px] xl:self-start xl:h-fit">
							<div className="flex min-w-0 items-center gap-1 xl:block">
								{categoryScroll.left && (
									<button
										type="button"
										aria-label={t("previousCategories")}
										onClick={() =>
											categoryNavRef.current?.scrollBy({
												left: -220,
												behavior: "smooth",
											})
										}
										className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-app bg-surface text-secondary hover:bg-hover hover:text-main focus-visible:outline-2 focus-visible:outline-primary xl:hidden"
									>
										<ChevronLeft className="h-5 w-5" />
									</button>
								)}
								<nav
									ref={categoryNavRef}
									aria-label={t("categoryNavLabel")}
									className="flex min-w-0 flex-1 flex-nowrap gap-1 overflow-x-auto overflow-y-hidden overscroll-x-contain pb-2 touch-pan-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden xl:flex-col xl:overflow-visible xl:border-r xl:border-app xl:pr-4 xl:pb-0"
								>
									{dialogueCategories.map((category) => {
										const isActive = selectedCategory === category;
										const Icon = categoryIcons[category];
										const count =
											category === "all"
												? courses.length
												: courses.filter((course) =>
														matchesCourseCategory(course, category),
													).length;
										return (
											<button
												key={category}
												type="button"
												aria-pressed={isActive}
												onClick={() => setSelectedCategory(category)}
												className={`relative flex h-11 shrink-0 items-center gap-3 rounded-xl px-4 text-left text-sm font-medium transition xl:w-full ${
													isActive
														? "bg-primary/15 text-brand-text before:absolute before:inset-y-0 before:left-0 before:w-1 before:rounded-full before:bg-primary before:shadow-[0_0_12px_var(--sj-primary)]"
														: "text-secondary hover:bg-hover hover:text-main"
												}`}
											>
												<Icon
													className={`h-5 w-5 shrink-0 ${isActive ? "text-primary" : ""}`}
													strokeWidth={1.8}
												/>
												<span className="whitespace-nowrap">
													{t(`categories.${category}`)}
												</span>
												<span
													className={`ml-auto hidden min-w-8 rounded-full px-2 py-1 text-center text-xs xl:inline-block ${isActive ? "bg-primary/15 text-brand-text" : "bg-surface-muted text-secondary"}`}
												>
													{count}
												</span>
											</button>
										);
									})}
								</nav>
								{categoryScroll.right && (
									<button
										type="button"
										aria-label={t("nextCategories")}
										onClick={() =>
											categoryNavRef.current?.scrollBy({
												left: 220,
												behavior: "smooth",
											})
										}
										className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-app bg-surface text-secondary hover:bg-hover hover:text-main focus-visible:outline-2 focus-visible:outline-primary xl:hidden"
									>
										<ChevronRight className="h-5 w-5" />
									</button>
								)}
							</div>
						</div>
						<div className="min-w-0">
							<div className="mb-3 flex flex-wrap items-center justify-between gap-3">
								<h2 className="relative pb-3 text-2xl font-bold text-main after:absolute after:bottom-0 after:left-0 after:h-1 after:w-12 after:rounded-full after:bg-primary">
									{t("explore")}
								</h2>
								<div className="flex items-center gap-4">
									<span className="text-sm text-secondary">
										{t("topics", { count: visibleCourses.length })}
									</span>
									<label className="relative block">
										<span className="sr-only">{t("levelFilter")}</span>
										<GraduationCap className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-text" />
										<select
											value={selectedLevel}
											onChange={(event) => setSelectedLevel(event.target.value)}
											className="h-11 min-w-36 appearance-none rounded-xl border border-app bg-surface pl-10 pr-9 text-sm font-medium text-main outline-none transition hover:border-primary/40 focus:border-primary focus:ring-2 focus:ring-primary/20"
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
								<div className="grid gap-5 xl:gap-[22px] sm:grid-cols-2 xl:grid-cols-3">
									{visibleCourses.map((course) => {
										const stats = courseStats[course.id];
										const statusLabel = stats.isCompleted
											? t("completed")
											: stats.isStarted
												? t("learning")
												: t("notStarted");
										const statusClassName = stats.isCompleted
											? "border-emerald-500/30 bg-emerald-600 text-white"
											: stats.isStarted
												? "border-transparent bg-primary text-white"
												: "border-white/15 bg-black/70 text-white";

										return (
											<Link
												key={course.id}
												href={`/dialogue/${course.id}`}
													className="group flex h-full flex-col rounded-[18px] border border-transparent bg-surface p-3 transition duration-200 hover:-translate-y-0.5 hover:border-primary/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
											>
												{/* Thumbnail */}
													<div className="relative aspect-[2.1/1] overflow-hidden rounded-[14px] bg-slate-900">
													<Image
														src={getCourseImage(course.id)}
													alt={getLocalizedCourseValue(course, "title")}
														fill
														className="object-cover transition duration-300 group-hover:scale-[1.03]"
														sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
													/>

													<div className="absolute inset-0 bg-gradient-to-t from-[#0b1424]/30 via-transparent to-transparent" />

													{/* Dialogue count */}
													<span className="absolute bottom-2 right-2 inline-flex items-center gap-1.5 rounded-md bg-black/70 px-2.5 py-1.5 text-[11px] font-semibold text-white backdrop-blur-sm">
														<BookOpen className="h-3.5 w-3.5" />
														{t("dialogues", { count: course.dialogues.length })}
													</span>

													<span
														className={`absolute left-2 top-2 rounded-md border px-2.5 py-1 text-[10px] font-semibold shadow-sm ${statusClassName}`}
													>
														{statusLabel}
													</span>
												</div>

												{/* Content */}
													<div className="flex flex-1 flex-col px-1 pb-1 pt-3 sm:pt-4">
													<div className="flex min-w-0 items-center gap-2">
														<h3 className="min-w-0 flex-1 line-clamp-1 text-base font-bold text-main">
															{getLocalizedCourseValue(course, "title")}
														</h3>
														<span className="shrink-0 rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-brand-text">
															{getCefrLevelLabel(course.level)}
														</span>
													</div>

													<p className="mt-1.5 min-h-10 line-clamp-2 text-[13px] leading-5 text-secondary">
														{getLocalizedCourseValue(course, "description")}
													</p>

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
