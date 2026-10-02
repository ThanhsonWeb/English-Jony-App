"use client";

import { ArrowLeft, CheckCircle2, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";

const STAT_TONES = {
	red: "border-red-500/20 bg-red-500/10 text-red-300",
	orange: "border-amber-500/20 bg-amber-500/10 text-amber-300",
	blue: "border-primary/20 bg-primary-soft text-brand-text",
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
	const t = useTranslations("WordlistReview.common");
	const progress = total > 0 ? (current / total) * 100 : 0;

	return (
		<main className="min-h-[calc(100vh-80px)] bg-page px-4 py-6 text-main sm:px-6 sm:py-9">
			<div className="mx-auto w-full max-w-4xl">
				<header className="mb-7">
					<div className="flex items-center gap-3 sm:gap-4">
						<button
							type="button"
							onClick={onBack}
							aria-label={t("back")}
							className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-app bg-surface text-secondary transition hover:border-primary/50 hover:bg-primary-soft hover:text-brand-text"
						>
							<ArrowLeft size={21} />
						</button>

						<div className="flex min-w-0 flex-1 items-center gap-3">
							<div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary-soft text-brand-text">
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
								<span className="rounded-full border border-primary/25 bg-primary-soft px-2.5 py-1 text-[11px] font-semibold text-brand-text sm:text-xs">
									{t("practice")}
								</span>
							)}
							<p className="text-sm font-semibold text-secondary sm:text-base">
								{current} / {total}
							</p>
						</div>
					</div>

					<p className="mt-3 text-sm text-secondary sm:hidden">{description}</p>

					<div className="mt-4 h-2 overflow-hidden rounded-full bg-surface-muted">
						<div
							className="h-full rounded-full bg-primary transition-all duration-500"
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
	title,
	message,
	stats,
	note,
	onRestart,
	onBack,
}) {
	const t = useTranslations("WordlistReview.common");
	const completionTitle = title || t("completionTitle");

	return (
		<main className="flex min-h-[calc(100vh-80px)] items-center justify-center bg-page px-4 py-10 text-main">
			<section className="relative w-full max-w-2xl overflow-hidden rounded-[28px] border border-app bg-surface p-6 sm:p-10">
				<div className="relative text-center">
					<div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-500/25 bg-emerald-500/10 text-emerald-300">
						<CheckCircle2 size={34} />
					</div>
					<h1 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">
						{completionTitle}
					</h1>
					{message && <p className="mt-3 text-secondary">{message}</p>}

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
							className="inline-flex items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary-soft px-5 py-3.5 font-semibold text-brand-text transition hover:bg-primary/15"
						>
							<RotateCcw size={18} /> {t("restart")}
						</button>
						<button
							type="button"
							onClick={onBack}
							className="rounded-xl bg-primary px-5 py-3.5 font-semibold text-white transition hover:bg-primary-hover active:scale-[0.98]"
						>
							{t("back")}
						</button>
					</div>
				</div>
			</section>
		</main>
	);
}

export function ReviewStatus({ icon, title, message, onBack }) {
	const t = useTranslations("WordlistReview.common");

	return (
		<main className="flex min-h-[calc(100vh-80px)] items-center justify-center bg-page px-4 py-10 text-main">
			<section className="relative w-full max-w-lg overflow-hidden rounded-[28px] border border-app bg-surface p-8 text-center">
				<div className="relative">
					<div className="flex justify-center">{icon}</div>
					<h1 className="mt-5 text-2xl font-bold tracking-tight">{title}</h1>
					<p className="mt-3 leading-relaxed text-secondary">{message}</p>
					<button
						type="button"
						onClick={onBack}
						className="mt-7 w-full rounded-xl bg-primary px-5 py-3.5 font-semibold text-white transition hover:bg-primary-hover active:scale-[0.98]"
					>
						{t("back")}
					</button>
				</div>
			</section>
		</main>
	);
}
