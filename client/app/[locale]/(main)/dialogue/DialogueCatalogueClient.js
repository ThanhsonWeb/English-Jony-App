"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import {
	ArrowRight,
	BookOpen,
	Clapperboard,
	ChevronDown,
	ChevronLeft,
	ChevronRight,
	GraduationCap,
	Grid2X2,
	LoaderCircle,
	Plane,
	Search,
	FolderOpen,
	Utensils,
} from "lucide-react";
import { lessonData } from "./_data/lessonData";
import { getLocalizedDialogueValue } from "@/app/_lib/dialogue/localization";
import { matchesCourseCategory } from "@/app/_lib/dialogue/catalogueCategories.mjs";
import { useLocale, useTranslations } from "next-intl";
import { useAuth } from "@/app/_contexts/AuthContext";
import { useCatalogueProgressResource } from "@/app/_lib/useStudyResources";
import { useRouter } from "@/i18n/navigation";
const courseImages = {
	"everyday-plans": "/dialogue/everyday-plans/thumbnails/making-plans-after-work.webp",
	"coffee-shop": "/dialogue/coffee-shop/thumbnails/coffee-shop.webp",
	"office-introduction":
		"/dialogue/office-introduction/thumbnails/office-introduction.webp",
	"weekend-camping": "/dialogue/weekend-camping/thumbnails/weekend-camping.webp",

	"asking-for-directions":
		"/dialogue/asking-for-directions/thumbnails/asking-for-direction.webp",
	"at-a-hotel": "/dialogue/at-a-hotel/thumbnails/at-a-hotel.webp",
	"grocery-store": "/dialogue/grocery-store/thumbnails/grocery-store.webp",
	"restaurant": "/dialogue/restaurant/thumbnails/restaurant.webp",
	"walk-in-the-park": "/dialogue/walk-in-the-park/thumbnails/walk-in-the-park.webp",
	"ten-minutes-a-day": "/stories/ten-minutes-a-day/thumbnails/ten-minutes-a-day.webp",
	"grateful": "/stories/grateful/thumbnails/grateful.webp",
	"a-small-surprise": "/stories/a-small-surprise/thumbnails/a-small-surprise.webp",
	"a-little-lie": "/stories/a-little-lie/thumbnails/the-broken-window.png",
	"naruto-season-1": "/stories/naruto-season-1/thumbnails/naruto-season-1.webp",
	"conan-season-1": "/stories/conan-season-1/thumbnails/conan-season-1.png",
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
	"travel",
	"food",
	"anime",
	"story",
	"other",
];

function matchesCategory(course, category) {
	return category === "other"
		? !["travel", "food", "anime", "story"].some(value => matchesCourseCategory(course, value))
		: matchesCourseCategory(course, category);
}

const categoryIcons = {
	all: Grid2X2,
	travel: Plane,
	food: Utensils,
	anime: Clapperboard,
	story: BookOpen,
	other: FolderOpen,
};

function getCefrLevelLabel(level) {
	const normalizedLevel = level?.toLowerCase();
	return cefrLevelLabels[normalizedLevel] ?? level;
}

export default function DialogueCatalogueClient({ isStartIntent = false, initialCategory = "all" }) {
	const router = useRouter();
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
	const { user, loading: authLoading } = useAuth();
	const userId = user?._id || user?.id;
	const {
		data: progressSnapshot,
		loading: progressLoading,
		error: progressError,
		refresh: refreshProgress,
	} = useCatalogueProgressResource(userId, courses, !authLoading);
	const progressByLesson = useMemo(() => progressSnapshot || {}, [progressSnapshot]);
	const isProgressLoading = authLoading || Boolean(userId && progressLoading);
	const hasConfirmedProgress = !isProgressLoading && (!userId || progressSnapshot !== undefined);
	const progressUnavailable = Boolean(userId && progressError && progressSnapshot === undefined);
	const progressRefreshFailed = Boolean(userId && progressError && progressSnapshot !== undefined);
	const [search, setSearch] = useState("");
	const [selectedLevel, setSelectedLevel] = useState("all");
	const [levelMenuOpen, setLevelMenuOpen] = useState(false);
	const [selectedCategory, setSelectedCategory] = useState(initialCategory);
	const startIntentHandled = useRef(false);
	const categoryNavRef = useRef(null);
	const levelFilterRef = useRef(null);
	const searchRef = useRef(null);
	const [categoryScroll, setCategoryScroll] = useState({
		left: false,
		right: false,
	});
	const selectedLevelLabel = levelOptions.find(option => option.value === selectedLevel)?.label;

	useEffect(() => {
		function focusSearch(event) {
			if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || event.isComposing || event.repeat) return;
			if (event.target instanceof HTMLElement && event.target.closest("input, textarea, select, [contenteditable]:not([contenteditable='false']), [role='dialog']")) return;
			if (document.querySelector("dialog[open], [role='dialog'][aria-modal='true']")) return;
			if (!searchRef.current) return;
			event.preventDefault();
			searchRef.current.focus();
		}
		window.addEventListener("keydown", focusSearch);
		return () => window.removeEventListener("keydown", focusSearch);
	}, []);

	useEffect(() => {
		if (!levelMenuOpen) return;
		const closeOnOutsideClick = event => {
			if (!levelFilterRef.current?.contains(event.target)) setLevelMenuOpen(false);
		};
		document.addEventListener("pointerdown", closeOnOutsideClick);
		return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
	}, [levelMenuOpen]);

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
		matchesCategory(course, selectedCategory);
	const courseMatchesFilters = (course) =>
		courseMatchesSearch(course) && courseMatchesLevel(course);
	const visibleCourses = courses.filter(
		(course) => courseMatchesFilters(course) && courseMatchesCategory(course),
	);
	const groupedView = selectedCategory === "all" && !normalizedSearch;
	const sections = groupedView
		? dialogueCategories.filter(category => category !== "all").map(category => ({ category, items: visibleCourses.filter(course => matchesCategory(course, category)) })).filter(section => section.items.length).sort((a, b) => b.items.length - a.items.length)
		: [{ category: null, items: visibleCourses }];

	useEffect(() => {
		if (startIntentHandled.current || !isStartIntent) return;
		if (isProgressLoading) return;

		startIntentHandled.current = true;
		if (userId && progressSnapshot === undefined && progressError) {
			router.replace("/dialogue");
			return;
		}

		const hasLearningProgress = Object.values(courseStats).some(
			(stats) => stats.completedTaskCount > 0,
		);
		router.replace(
			hasLearningProgress
				? "/dialogue"
				: "/dialogue/asking-for-directions/finding-a-cafe",
		);
	}, [courseStats, isProgressLoading, isStartIntent, progressError, progressSnapshot, router, userId]);

	if (isStartIntent) {
		return (
			<main className="flex min-h-screen items-center justify-center bg-page px-4 text-main">
				<div role="status" aria-live="polite" className="flex items-center gap-2 text-sm text-secondary">
					<LoaderCircle size={17} aria-hidden="true" className="shrink-0 animate-spin text-brand-text" />
					{t("progressLoading")}
				</div>
			</main>
		);
	}

	return (
		<main data-testid="dialogue-catalogue" className="min-h-screen bg-page px-4 pb-10 text-main sm:px-6 lg:px-8">
			<div className="mx-auto max-w-[1548px]">
				{/* ==================== HERO SECTION ==================== */}
				<section className="relative overflow-hidden bg-hero">
					<svg aria-hidden="true" viewBox="0 0 420 130" fill="none" className="pointer-events-none absolute bottom-0 left-1/2 h-24 w-72 -translate-x-1/2 text-primary opacity-[0.17] sm:h-32 sm:w-96">
						<circle cx="325" cy="28" r="12" fill="currentColor" opacity=".5" />
						<path d="M0 130 48 104l20-24 14 5 27-29 15 8 22-19 23 19 20 6 20 25 28-12 25 24 21-8 27 17 35-9 35 23Z" fill="currentColor" opacity=".28" />
						<path d="m70 130 39-32 17-23 17-6 21-22 13 9 14-14 18 17 14 4 22-32 7-5 7-12 9 9 10 6 19 27 13 6 18 22 17 5 35 41Z" fill="currentColor" opacity=".48" />
						<path d="m252 26 7-12 9 9 10 6 19 27 13 6 18 22 17 5 35 41H246l22-28-10-16 10-9-11-17 7-10Z" fill="currentColor" opacity=".35" />
						<path d="m225 63 20-32 7-5 7-12 9 9 10 6 17 24-14-7-5 4-8-9-5 9-7-10-6 15-7-5-8 12Zm-82 6 21-22 13 9 14-14 18 17-10-3-6 5-5-7-8 9-5-4-9 8-6-3Z" fill="currentColor" opacity=".9" />
						<path d="m259 14-5 35-7 15 5 9-15 27m31-59 10 17-4 10 16 16m-124-37-5 24-14 13m40-30 8 18 12 10" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" opacity=".75" />
						<path d="M222 93c-12 9 12 11 2 19-6 5-18 9-24 18h24c3-7 16-10 19-17 3-8-17-11-12-20Z" fill="currentColor" opacity=".4" />
						<g fill="currentColor" opacity=".8">
							<path d="m45 123 8-18-3 1 6-14 6 14-3-1 8 18h-9v7h-4v-7Zm32 2 7-15-3 1 5-12 5 12-3-1 7 15h-7v5h-4v-5Zm281-3 7-16-3 1 5-12 5 12-3-1 7 16h-7v8h-4v-8Zm27 3 6-13-2 1 4-10 4 10-2-1 6 13h-6v5h-4v-5Z" />
						</g>
						<g fill="currentColor" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
							<circle cx="335" cy="71" r="2.4" stroke="none" />
							<path d="m334 75-1 8 3 3 2-3-1-8Z" strokeWidth="1" />
							<path d="m334 79-3 3m6-3 2 3m-5 3-2 5m4-5 2 5" fill="none" strokeWidth="1.8" />
							<path d="M337 76h2v5h-2z" stroke="none" />
						</g>
						<g stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity=".8">
							<path d="M65 22v12m-6-6h12m-10-4 8 8m0-8-8 8M360 52v10m-5-5h10m-8-3 6 6m0-6-6 6M155 12v8m-4-4h8" />
						</g>
						<g fill="currentColor" opacity=".65"><circle cx="105" cy="50" r="2" /><circle cx="190" cy="30" r="1.5" /><circle cx="305" cy="65" r="2" /><circle cx="395" cy="25" r="1.5" /></g>
					</svg>
					<div className="relative grid items-center gap-5 px-5 py-6 sm:px-8 sm:py-7 md:grid-cols-[minmax(0,1fr)_minmax(220px,320px)] md:gap-5 md:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,400px)] lg:gap-8 lg:px-8">
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
								ref={searchRef}
								type="search"
								value={search}
								onChange={(event) => setSearch(event.target.value)}
								placeholder={t("searchPlaceholder")}
								className="h-12 w-full rounded-xl border border-app bg-surface pl-11 pr-14 text-sm text-main shadow-sm outline-none transition placeholder:text-secondary focus:border-primary focus:ring-2 focus:ring-primary/15"
							/>
							<kbd aria-hidden="true" className="pointer-events-none absolute right-8 top-1/2 -translate-y-1/2 rounded border border-app bg-surface-muted px-1.5 py-0.5 text-xs text-secondary">/</kbd>
						</label>
					</div>
				</section>
				{isProgressLoading && (
					<div role="status" aria-live="polite" className="mt-4 flex items-center gap-2 rounded-xl border border-app bg-surface px-4 py-3 text-sm text-secondary">
						<LoaderCircle size={17} aria-hidden="true" className="shrink-0 animate-spin text-brand-text" />
						{t("progressLoading")}
					</div>
				)}
				{(progressUnavailable || progressRefreshFailed) && (
					<div role="alert" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/25 bg-amber-500/5 px-4 py-3 text-sm text-main">
						<p>{t(progressRefreshFailed ? "progressRefreshFailed" : "progressUnavailable")}</p>
						<button type="button" onClick={() => { void refreshProgress(true).catch(() => {}); }} className="min-h-11 rounded-lg border border-app bg-surface px-4 py-2 font-semibold text-main transition hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
							{t("retryProgressLoad")}
						</button>
					</div>
				)}
				{/* ==================== OTHER COURSES / DISCOVERY ==================== */}

				<section className="mt-6 pb-10">
					<div className="grid min-w-0 items-stretch gap-5 xl:grid-cols-[272px_minmax(0,1fr)] xl:gap-6">
						<div className="min-w-0 xl:border-r xl:border-app xl:pr-6">
						<div className="min-w-0 self-start lg:sticky lg:top-20 lg:z-10 lg:h-fit lg:bg-page">
							<h2 className="mb-3 hidden px-3 text-xs font-semibold uppercase tracking-wider text-secondary xl:block">{t("categoryHeading")}</h2>
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
									className="flex min-w-0 flex-1 flex-nowrap gap-1 overflow-x-auto overflow-y-hidden overscroll-x-contain pb-2 touch-pan-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden xl:flex-col xl:overflow-visible xl:pb-0"
								>
									{dialogueCategories.map((category) => {
										const isActive = selectedCategory === category;
										const Icon = categoryIcons[category];
										const count =
											category === "all"
												? courses.length
												: courses.filter((course) =>
																matchesCategory(course, category),
													).length;
										return (
											<button
												key={category}
												type="button"
												aria-pressed={isActive}
												onClick={() => setSelectedCategory(category)}
												className={`relative flex min-h-10 shrink-0 items-center gap-3 rounded-xl border px-3 py-2 text-left text-sm font-medium transition-all duration-200 xl:w-full ${
													isActive
																? "border-teal-500/25 bg-teal-500/15 text-brand-text"
																: "border-transparent text-secondary hover:bg-hover hover:text-main"
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
															className={`ml-auto hidden min-w-8 rounded-full px-2 py-1 text-center text-xs xl:inline-block ${isActive ? "bg-teal-500/20 text-brand-text" : "bg-surface-muted text-secondary"}`}
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
						</div>
						<div className="min-w-0">
							<div className="mb-4 flex flex-wrap items-center justify-between gap-3">
								<h2 className="pb-3 text-2xl font-bold text-main">
									{t("explore")}
								</h2>
								<div className="flex items-center gap-4">
									<div ref={levelFilterRef} className="relative">
										<span id="dialogue-level-filter-label" className="sr-only">{t("levelFilter")}</span>
										<button
											type="button"
											aria-labelledby="dialogue-level-filter-label"
											aria-haspopup="listbox"
											aria-expanded={levelMenuOpen}
											onClick={() => setLevelMenuOpen(open => !open)}
											className="flex h-11 min-w-56 cursor-pointer items-center gap-3 rounded-xl border border-app bg-surface pl-3 pr-3 text-sm font-medium text-main outline-none transition hover:border-primary/40 focus:border-primary focus:ring-2 focus:ring-primary/20"
										>
											<GraduationCap className="h-4 w-4 shrink-0 text-brand-text" />
											<span className="flex-1 text-left">{selectedLevelLabel}</span>
											<ChevronDown className={`h-4 w-4 shrink-0 text-secondary transition-transform ${levelMenuOpen ? "rotate-180" : ""}`} />
										</button>
										{levelMenuOpen && (
											<div
												role="listbox"
												aria-labelledby="dialogue-level-filter-label"
												className="absolute right-0 top-full z-50 mt-2 w-full overflow-hidden rounded-xl border border-app bg-surface p-1 shadow-xl"
											>
												{levelOptions.map(option => (
													<button
														key={option.value}
														type="button"
														role="option"
														aria-selected={selectedLevel === option.value}
														onClick={() => {
															setSelectedLevel(option.value);
															setLevelMenuOpen(false);
														}}
														className={`block w-full cursor-pointer rounded-lg px-3 py-2 text-left text-sm transition ${selectedLevel === option.value ? "bg-primary/15 text-primary" : "text-main hover:bg-hover"}`}
													>
														{option.label}
													</button>
												))}
											</div>
										)}
									</div>
								</div>
							</div>
							{visibleCourses.length > 0 ? (
								<div className="space-y-6">
								{sections.map(({ category, items }) => {
									const Icon = category ? categoryIcons[category] : null;
									return <section key={category || "results"}>
									{category && <div className="mb-3 flex items-center justify-between gap-3"><h3 className="flex items-center gap-2 text-lg font-bold text-main"><Icon size={20} className="shrink-0 text-brand-text" aria-hidden="true" />{t(`categories.${category}`)} <span className="text-sm font-normal text-secondary">({items.length})</span></h3>{items.length > 3 && <button type="button" onClick={() => setSelectedCategory(category)} className="inline-flex items-center gap-1 text-sm font-medium text-brand-text hover:underline">{t("viewCategory", { count: items.length })} <ArrowRight size={16} aria-hidden="true" /></button>}</div>}
									<div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
									{(category ? items.slice(0, 3) : items).map((course) => {
										const stats = courseStats[course.id];
										const statusLabel = !hasConfirmedProgress
											? null
											: stats.isCompleted
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
															className="group flex h-full cursor-pointer flex-col rounded-[18px] border border-transparent bg-surface p-2 transition-all duration-300 ease-out hover:-translate-y-1 hover:border-teal-500/60 hover:shadow-xl hover:shadow-teal-500/10 dark:hover:bg-[#151e32] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transform-none motion-reduce:transition-none"
											>
												{/* Thumbnail */}
													<div className="relative aspect-[2.1/1] overflow-hidden rounded-[14px] bg-slate-900">
													<Image
														src={getCourseImage(course.id)}
													alt={getLocalizedCourseValue(course, "title")}
														fill
																			className="object-cover transition-transform duration-500 ease-out group-hover:scale-105 motion-reduce:transform-none motion-reduce:transition-none"
														sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
													/>

													<div className="absolute inset-0 bg-gradient-to-t from-[#0b1424]/30 via-transparent to-transparent" />

												{statusLabel && <span
														className={`absolute left-2 top-2 rounded-md border px-2.5 py-1 text-[10px] font-semibold shadow-sm ${statusClassName}`}
													>
														{statusLabel}
													</span>}
												</div>

												{/* Content */}
															<div className="flex flex-1 flex-col px-1 pb-1 pt-2 sm:pt-3">
															<div className="mb-3 flex min-w-0 items-center gap-2">
																		<h3 className="min-w-0 flex-1 line-clamp-1 text-lg font-bold text-main transition-colors duration-200 group-hover:text-teal-600 dark:group-hover:text-teal-400 motion-reduce:transition-none">
															{getLocalizedCourseValue(course, "title")}
														</h3>
														<span className="shrink-0 rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-brand-text">
															{getCefrLevelLabel(course.level)}
														</span>
													</div>

															<div className="mt-auto flex items-center justify-between gap-2 border-t border-app pt-2.5 text-xs text-secondary">
																<span>{t("dialogues", { count: course.dialogues.length })}</span>
																				<span className="inline-flex items-center gap-1 font-medium text-brand-text">{t("exploreAction")} <ArrowRight size={14} className="transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transform-none motion-reduce:transition-none" aria-hidden="true" /></span>
															</div>

												</div>
											</Link>
										);
									})}
									</div>
								</section>})}
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
