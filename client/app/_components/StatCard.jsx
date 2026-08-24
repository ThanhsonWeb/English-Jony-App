function StatCard({ title, value, subtitle, icon, accent = "blue" }) {
	const styles = {
		violet: {
			card: "border-violet-500/20 bg-gradient-to-br from-[#111a33] to-[#0b1226]",
			iconWrap: "bg-violet-500/10 border border-violet-500/20 text-violet-400",
			line: "stroke-violet-400/70",
			value: "text-violet-400",
		},

		emerald: {
			card: "border-emerald-500/20 bg-gradient-to-br from-[#0d1a24] to-[#0a1220]",
			iconWrap:
				"bg-emerald-500/10 border border-emerald-500/20 text-emerald-400",
			line: "stroke-emerald-400/70",
			value: "text-green-400",
		},

		amber: {
			card: "border-amber-500/20 bg-gradient-to-br from-[#1a1620] to-[#0d1220]",
			iconWrap: "bg-amber-500/10 border border-amber-500/20 text-amber-400",
			line: "stroke-amber-400/70",
			value: "text-yellow-400",
		},
	};

	const s = styles[accent];

	return (
		<div
			className={`relative min-w-0 overflow-hidden rounded-xl border p-3 shadow-lg sm:rounded-2xl sm:p-5 ${s.card}`}
		>
			{/* glow */}
			<div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.03),transparent_40%)]" />

			{/* wave line */}
			<svg
				viewBox="0 0 220 60"
				className="absolute bottom-0 right-0 hidden h-16 w-40 opacity-70 sm:block"
				fill="none"
				preserveAspectRatio="none"
			>
				<path
					d="M0 48 C25 48, 25 18, 50 18 S75 52, 100 52 S125 20, 150 20 S175 48, 220 30"
					className={s.line}
					strokeWidth="2.5"
					strokeLinecap="round"
				/>
			</svg>

			<div className="relative z-10 flex min-w-0 items-start justify-between gap-1 sm:gap-4">
				<div className="min-w-0">
					<p className="min-h-6 text-[9px] font-medium uppercase leading-3 tracking-normal text-slate-400 sm:min-h-0 sm:text-[14px] sm:leading-normal sm:tracking-wide">
						{title}
					</p>

					<div className="mt-1 flex min-w-0 items-end gap-1 sm:gap-1.5">
						<p className={`text-xl font-semibold leading-none sm:text-2xl ${s.value}`}>
							{value}
						</p>

						<p className="truncate pb-px text-[9px] font-medium text-slate-400 sm:pb-[2px] sm:text-[12px]">
							từ
						</p>
					</div>
				</div>

				<div
					className={`hidden h-12 w-12 shrink-0 items-center justify-center rounded-full sm:flex ${s.iconWrap}`}
				>
					{icon}
				</div>
			</div>
		</div>
	);
}

export default StatCard;
