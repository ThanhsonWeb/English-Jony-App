"use client";

import { useEffect, useState } from "react";

const levelClass = {
	0: "bg-slate-900",
	1: "bg-emerald-950",
	2: "bg-emerald-800",
	3: "bg-emerald-600",
	4: "bg-emerald-400",
};

function formatDate(date) {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");

	return `${year}-${month}-${day}`;
}

function formatDisplayDate(dateString) {
	return new Date(`${dateString}T00:00:00`).toLocaleDateString("vi-VN");
}

function getLevel(count) {
	if (count === 0) return 0;
	if (count <= 2) return 1;
	if (count <= 5) return 2;
	if (count <= 9) return 3;
	return 4;
}

function StudyHeatmap() {
	const [days, setDays] = useState([]);
	const totalWeeks = Math.ceil(days.length / 7);
	const monthLabelsByWeek = new Map(
		days
			.map((day, index) => {
				const date = new Date(`${day.date}T00:00:00`);

				if (date.getDate() !== 1) return null;

				return [
					Math.floor(index / 7),
					`Th${date.getMonth() + 1}`,
				];
			})
			.filter(Boolean),
	);
	const totalActivities = days.reduce((total, day) => total + day.count, 0);

	useEffect(() => {
		async function fetchActivities() {
			const res = await fetch("/api/v1/study-activities", {
				credentials: "include",
			});

			if (!res.ok) return;

			const data = await res.json();

			const activityMap = new Map(
				data.data.activities.map((activity) => [activity.date, activity.count]),
			);

			const today = new Date();
			today.setHours(0, 0, 0, 0);

			const startDate = new Date(today);
			// Show the current month and the five previous calendar months.
			startDate.setMonth(today.getMonth() - 5, 1);

			// Start from Sunday, like GitHub
			startDate.setDate(startDate.getDate() - startDate.getDay());

			const totalDays =
				Math.floor((today - startDate) / (1000 * 60 * 60 * 24)) + 1;

			const heatmapDays = Array.from({ length: totalDays }, (_, index) => {
				const date = new Date(startDate);
				date.setDate(startDate.getDate() + index);

				const dateString = formatDate(date);
				const count = activityMap.get(dateString) || 0;

				return {
					date: dateString,
					count,
					level: getLevel(count),
				};
			});

			setDays(heatmapDays);
		}

		fetchActivities();
	}, []);

	return (
		<div className="mt-10">
			<div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-4 sm:p-6">
				<h2 className="text-lg font-semibold text-white sm:text-xl">
					Tổng quan hoạt động (6 tháng gần đây)
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
								{["", "T2", "", "T4", "", "T6", ""].map(
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
										title={`${formatDisplayDate(day.date)}\n${day.count} hoạt động`}
										className={`h-3 w-3 rounded-sm sm:h-4 sm:w-4 lg:h-5 lg:w-5 ${levelClass[day.level]}`}
									/>
								))}
							</div>
						</div>
					</div>
				</div>

				{/* Footer */}
				<div className="mt-5 flex flex-col gap-3 border-t border-slate-800 pt-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
					<span>{totalActivities} hoạt động trong 6 tháng</span>

					<div className="flex items-center gap-2">
						<span>Ít</span>

						{[0, 1, 2, 3, 4].map((level) => (
							<div
								key={level}
								className={`h-3 w-3 rounded-sm sm:h-4 sm:w-4 ${levelClass[level]}`}
							/>
						))}

						<span>Nhiều</span>
					</div>
				</div>
			</div>
		</div>
	);
}

export default StudyHeatmap;
