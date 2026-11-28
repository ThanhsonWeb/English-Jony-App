"use client";

import { useLocale, useTranslations } from "next-intl";
import { buildStudyHeatmapDays } from "@/app/_lib/studyHeatmap.mjs";
import { useAuth } from "@/app/_contexts/AuthContext";
import { useStudyActivitiesResource } from "@/app/_lib/useStudyResources";
import { useEffect, useRef } from "react";

const levelClass = {
	0: "bg-app dark:bg-slate-900",
	1: "bg-emerald-950",
	2: "bg-emerald-800",
	3: "bg-emerald-600",
	4: "bg-emerald-400",
};

function formatDisplayDate(dateString, locale) {
	return new Date(`${dateString}T00:00:00`).toLocaleDateString(locale);
}

function StudyHeatmap() {
	const scrollRef = useRef(null);
	useEffect(() => {
		if (window.matchMedia("(max-width: 639px)").matches && scrollRef.current) {
			scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
		}
	}, []);
	const t = useTranslations("Profile");
	const locale = useLocale();
	const { user, loading: authLoading } = useAuth();
	const { data: activities = [] } = useStudyActivitiesResource(user?._id || user?.id, !authLoading);
	const days = buildStudyHeatmapDays(activities);
	const totalWeeks = Math.ceil(days.length / 7);
	const monthLabelsByWeek = new Map(
		days
			.map((day, index) => {
				const date = new Date(`${day.date}T00:00:00Z`);

				if (date.getUTCDate() !== 1) return null;

				return [
					Math.floor(index / 7),
					new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" }).format(date),
				];
			})
			.filter(Boolean),
	);
	const totalActivities = days.reduce((total, day) => total + day.count, 0);
	const activeDays = days.filter(day => day.level > 0).length;

	return (
		<div className="mt-6">
			<div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-4 sm:p-6">
				<h2 className="text-lg font-semibold text-white sm:text-xl">
					{t("activity")}
				</h2>

				<div ref={scrollRef} className="mt-2 overflow-x-auto overscroll-x-contain pt-4 [scrollbar-width:thin]">
					<div className="mx-auto w-max">
						{/* Months */}
						<div className="mb-3 flex items-end gap-3">
							<div className="w-7 shrink-0" aria-hidden="true" />
							<div className="grid h-5 w-max grid-flow-col auto-cols-[12px] gap-1 text-xs text-slate-400 sm:auto-cols-[16px] lg:auto-cols-[20px]">
								{Array.from({ length: totalWeeks }, (_, weekIndex) => (
									<span
										key={`month-week-${weekIndex}`}
										className="whitespace-nowrap"
									>
										{monthLabelsByWeek.get(weekIndex) || ""}
									</span>
								))}
							</div>
						</div>

						{/* Weekdays and days */}
						<div className="flex items-start gap-3">
							<div className="grid w-7 shrink-0 grid-rows-7 gap-1 text-xs text-slate-500">
								{(locale === "vi"
									? ["", "T2", "", "T4", "", "T6", ""]
									: ["", "Mon", "", "Wed", "", "Fri", ""]
								).map(
									(label, index) => (
										<span
											key={`weekday-${index}`}
											className="flex h-3 items-center sm:h-4 lg:h-5"
										>
											{label}
										</span>
									),
								)}
							</div>

							<div className="grid w-max grid-flow-col auto-cols-max grid-rows-7 gap-1">
								{days.map((day, index) => (
									<button
										type="button"
										key={day.date}
										aria-label={`${formatDisplayDate(day.date, locale)}, ${t("activityTooltip", { count: day.count })}${day.count === 0 && day.hasQualifiedStudy ? `, ${t("qualifiedActivityTooltip")}` : ""}`}
										className={`group relative h-3 w-3 cursor-pointer rounded-sm focus-visible:z-20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-400 sm:h-4 sm:w-4 lg:h-5 lg:w-5 ${levelClass[day.level]}`}
									>
										<span aria-hidden="true" className={`pointer-events-none absolute z-30 hidden w-max max-w-48 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-left text-xs leading-5 text-slate-100 shadow-xl group-hover:block group-focus-visible:block ${index % 7 >= 4 ? "bottom-full mb-2" : "top-full mt-2"} ${index < 21 ? "left-0" : index >= days.length - 21 ? "right-0" : "left-1/2 -translate-x-1/2"}`}>
											<strong className="block">{formatDisplayDate(day.date, locale)}</strong>
											<span className="block text-slate-300">{t("activityTooltip", { count: day.count })}</span>
											{day.count === 0 && day.hasQualifiedStudy && <span className="block text-slate-300">{t("qualifiedActivityTooltip")}</span>}
										</span>
									</button>
								))}
							</div>
						</div>
					</div>
				</div>

				{/* Footer */}
				<div className="mt-5 flex flex-col gap-3 border-t border-slate-800 pt-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
					<span>{t("activitySummary", { days: activeDays, count: totalActivities })}</span>

					<div className="flex items-center gap-2">
						<span>{t("less")}</span>

						{[0, 1, 2, 3, 4].map((level) => (
							<div
								key={level}
								className={`h-3 w-3 rounded-sm sm:h-4 sm:w-4 ${levelClass[level]}`}
							/>
						))}

						<span>{t("more")}</span>
					</div>
				</div>
			</div>
		</div>
	);
}

export default StudyHeatmap;
