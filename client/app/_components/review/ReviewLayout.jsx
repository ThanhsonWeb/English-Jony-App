"use client";

import { ArrowLeft, CheckCircle2, RotateCcw } from "lucide-react";

const STAT_TONES = {
	red: "border-red-500/20 bg-red-500/10 text-red-300",
	orange: "border-amber-500/20 bg-amber-500/10 text-amber-300",
	blue: "border-blue-500/20 bg-blue-500/10 text-blue-300",
	emerald: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
};

export function ReviewShell({
	title,
	description,
	icon,
	practiceMode,
	current,
	total,
	onBack,
	children,
}) {
	const progress = total > 0 ? (current / total) * 100 : 0;

	return (
		<main className="min-h-[calc(100vh-80px)] bg-[#030616] px-4 py-6 text-white sm:px-6 sm:py-9">
			<div className="mx-auto w-full max-w-4xl">
				<header className="mb-7">
					<div className="flex items-center gap-3 sm:gap-4">
						<button
							type="button"
							onClick={onBack}
							aria-label="Quay lại danh sách từ"
							className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-700/80 bg-[#0b1428] text-slate-300 transition hover:border-blue-500/50 hover:bg-blue-500/10 hover:text-white"
						>
							<ArrowLeft size={21} />
						</button>

						<div className="flex min-w-0 flex-1 items-center gap-3">
							<div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-blue-500/25 bg-gradient-to-br from-blue-600/30 to-violet-500/20 text-blue-300 shadow-[0_10px_30px_-14px_rgba(59,130,246,0.8)]">
								{icon}
							</div>
							<div className="min-w-0">
								<h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">
									{title}
								</h1>
								<p className="mt-0.5 hidden truncate text-sm text-slate-400 sm:block">
									{description}
								</p>
							</div>
						</div>

						<div className="flex shrink-0 flex-col items-end gap-1.5">
							{practiceMode && (
								<span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 sm:text-xs">
									Luyện tập
								</span>
							)}
							<p className="text-sm font-semibold text-slate-300 sm:text-base">
								{current} / {total}
							</p>
						</div>
					</div>

					<p className="mt-3 text-sm text-slate-400 sm:hidden">{description}</p>

					<div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-800/80">
						<div
							className="h-full rounded-full bg-gradient-to-r from-blue-500 via-blue-500 to-violet-500 shadow-[0_0_18px_rgba(59,130,246,0.55)] transition-all duration-500"
							style={{ width: `${progress}%` }}
						/>
					</div>
				</header>

				{children}
			</div>
		</main>
	);
}

export function ReviewCompletion({
	title = "Hoàn thành buổi ôn!",
	message,
	stats,
	note,
	onRestart,
	onBack,
}) {
	return (
		<main className="flex min-h-[calc(100vh-80px)] items-center justify-center bg-[#030616] px-4 py-10 text-white">
			<section className="relative w-full max-w-2xl overflow-hidden rounded-[28px] border border-slate-800 bg-[#0a1224] p-6 shadow-[0_30px_90px_-45px_rgba(37,99,235,0.65)] sm:p-10">
				<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.17),transparent_52%)]" />
				<div className="relative text-center">
					<div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-500/25 bg-emerald-500/10 text-emerald-300">
						<CheckCircle2 size={34} />
					</div>
					<h1 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">
						{title}
					</h1>
					{message && <p className="mt-3 text-slate-400">{message}</p>}

					<div
						className={`mt-8 grid grid-cols-2 gap-3 ${stats.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-4"}`}
					>
						{stats.map((stat, index) => (
							<div
								key={stat.label}
								className={`rounded-2xl border p-4 ${STAT_TONES[stat.tone]} ${stats.length === 3 && index === 2 ? "col-span-2 sm:col-span-1" : ""}`}
							>
								<p className="text-xs font-semibold opacity-80">{stat.label}</p>
								<p className="mt-1 text-2xl font-bold sm:text-3xl">{stat.value}</p>
							</div>
						))}
					</div>

					{note && (
						<p className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/35 px-4 py-3 text-sm leading-relaxed text-slate-400">
							{note}
						</p>
					)}

					<div className="mt-7 grid gap-3 sm:grid-cols-2">
						<button
							type="button"
							onClick={onRestart}
							className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-500/30 bg-blue-500/10 px-5 py-3.5 font-semibold text-blue-200 transition hover:bg-blue-500/20"
						>
							<RotateCcw size={18} /> Học lại
						</button>
						<button
							type="button"
							onClick={onBack}
							className="rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-5 py-3.5 font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:brightness-110 active:scale-[0.98]"
						>
							Quay lại danh sách từ
						</button>
					</div>
				</div>
			</section>
		</main>
	);
}

export function ReviewStatus({ icon, title, message, onBack }) {
	return (
		<main className="flex min-h-[calc(100vh-80px)] items-center justify-center bg-[#030616] px-4 py-10 text-white">
			<section className="relative w-full max-w-lg overflow-hidden rounded-[28px] border border-slate-800 bg-[#0a1224] p-8 text-center shadow-2xl">
				<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.14),transparent_52%)]" />
				<div className="relative">
					<div className="flex justify-center">{icon}</div>
					<h1 className="mt-5 text-2xl font-bold tracking-tight">{title}</h1>
					<p className="mt-3 leading-relaxed text-slate-400">{message}</p>
					<button
						type="button"
						onClick={onBack}
						className="mt-7 w-full rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-5 py-3.5 font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:brightness-110 active:scale-[0.98]"
					>
						Quay lại danh sách từ
					</button>
				</div>
			</section>
		</main>
	);
}
