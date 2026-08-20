"use client";
import { useEffect, useState } from "react";

function StudyHeatmap() {
	const [days, setDays] = useState([]);

	const levelClass = {
		0: "bg-slate-900",
		1: "bg-emerald-950",
		2: "bg-emerald-800",
		3: "bg-emerald-600",
		4: "bg-emerald-400",
	};

	useEffect(() => {
		const data = Array.from({ length: 365 }, (_, i) => ({
			id: i,
			level: Math.floor(Math.random() * 5),
		}));

		setDays(data);
	}, []);
	return (
		<div className="mt-10">
			<h2 className="mb-4 text-lg font-semibold text-slate-100">
				Hoạt động học tập
			</h2>

			<div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
				{/* months */}
				<div className="mb-3 grid min-w-[720px] grid-cols-12 text-xs text-slate-400">
					<span>Sep</span>
					<span>Oct</span>
					<span>Nov</span>
					<span>Dec</span>
					<span>Jan</span>
					<span>Feb</span>
					<span>Mar</span>
					<span>Apr</span>
					<span>May</span>
					<span>Jun</span>
					<span>Jul</span>
					<span>Aug</span>
				</div>
				{/* days */}
				<div className="grid min-w-[720px] grid-flow-col grid-rows-7 gap-1">
					{days.map((day) => (
						<div
							key={day.id}
							className={`h-3 w-3 rounded-sm ${levelClass[day.level]}`}
						/>
					))}
				</div>

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
	);
}

export default StudyHeatmap;
