"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { buildStudyHeatmapDays } from "@/app/_lib/studyHeatmap.mjs";

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
	const t = useTranslations("Profile");
	const locale = useLocale();
	const [days, setDays] = useState([]);
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

	useEffect(() => {
		async function fetchActivities() {
			const res = await fetch("/api/v1/study-activities", {
				credentials: "include",
			});

			if (!res.ok) return;

			const data = await res.json();

			setDays(buildStudyHeatmapDays(data.data.activities));
		}

		fetchActivities();
	}, []);

	return (
		<div className="mt-10">
			<div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-4 sm:p-6">
				<h2 className="text-lg font-semibold text-white sm:text-xl">
					{t("activity")}
				</h2>

				<div className="mt-6 overflow-x-auto">
					<div className="w-max min-w-full">
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
								{days.map((day) => (
									<div
										key={day.date}
										title={`${formatDisplayDate(day.date, locale)}\n${day.count === 0 && day.hasQualifiedStudy ? t("qualifiedActivityTooltip") : t("activityTooltip", { count: day.count })}`}
										className={`h-3 w-3 rounded-sm sm:h-4 sm:w-4 lg:h-5 lg:w-5 ${levelClass[day.level]}`}
									/>
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
