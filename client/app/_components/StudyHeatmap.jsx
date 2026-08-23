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

function getLevel(count) {
	if (count === 0) return 0;
	if (count <= 2) return 1;
	if (count <= 5) return 2;
	if (count <= 9) return 3;
	return 4;
}

function StudyHeatmap() {
	const [days, setDays] = useState([]);
	const monthLabels = days
		.map((day, index) => {
			const date = new Date(`${day.date}T00:00:00`);

			if (date.getDate() !== 1) return null;

			return {
				name: date.toLocaleDateString("en-US", {
					month: "short",
				}),
				left: Math.floor(index / 7) * 16,
			};
		})
		.filter(Boolean);

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
			startDate.setDate(today.getDate() - 364);

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
			<h2 className="mb-4 text-lg font-semibold text-slate-100">
				Hoạt động học tập
			</h2>
			<div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
				<div className="w-max min-w-[848px]">
					{/* Months */}
					<div className="relative mb-3 h-5 text-xs text-slate-400">
						{monthLabels.map((month) => (
							<span
								key={`${month.name}-${month.left}`}
								className="absolute"
								style={{ left: `${month.left}px` }}
							>
								{month.name}
							</span>
						))}
					</div>

					{/* Days */}
					<div className="grid w-max grid-flow-col auto-cols-max grid-rows-7 gap-1">
						{days.map((day) => (
							<div
								key={day.date}
								title={`${day.date}: ${day.count} từ`}
								className={`h-3 w-3 rounded-sm ${levelClass[day.level]}`}
							/>
						))}
					</div>

					{/* Legend */}
					<div className="mt-4 flex items-center justify-end gap-2 text-xs text-slate-500">
						<span>Ít</span>

						{[0, 1, 2, 3, 4].map((level) => (
							<div
								key={level}
								className={`h-3 w-3 rounded-sm ${levelClass[level]}`}
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
