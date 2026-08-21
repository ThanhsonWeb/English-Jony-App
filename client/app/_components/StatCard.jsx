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
			className={`relative overflow-hidden rounded-2xl border p-5 shadow-lg ${s.card}`}
		>
			{/* glow */}
			<div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.03),transparent_40%)]" />

			{/* wave line */}
			<svg
				viewBox="0 0 220 60"
				className="absolute bottom-0 right-0 h-16 w-40 opacity-70"
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

			<div className="relative z-10 flex items-start justify-between gap-4">
				<div>
					<p className="text-[14px] font-medium uppercase tracking-wide text-slate-400">
						{title}
					</p>

					<div className="mt-1 flex items-end gap-1.5">
						<p className={`text-2xl font-semibold leading-none ${s.value}`}>
							{value}
						</p>

						<p className="pb-[2px] text-[12px] font-medium text-slate-400">
							từ
						</p>
					</div>
				</div>

				<div
					className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${s.iconWrap}`}
				>
					{icon}
				</div>
			</div>
		</div>
	);
}

export default StatCard;
