"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { MessageSquare, X } from "lucide-react";

const initialForm = { type: "suggestion", message: "" };

export default function FeedbackWidget() {
	const t = useTranslations("Feedback");
	const pathname = usePathname();
	const routePath = pathname.replace(/^\/(en|vi)(?=\/|$)/, "") || "/";
	const isDialoguePractice =
		/^\/dialogue\/[^/]+\/[^/]+\/(?!useful-words(?:\/|$))[^/]+$/.test(routePath);
	const isDialogueLessonOverview = /^\/dialogue\/[^/]+$/.test(routePath);
	const isDialogueUsefulWords = /^\/dialogue\/[^/]+\/[^/]+\/useful-words(?:\/|$)/.test(routePath);
	const isSignup = routePath === "/signup";
	const keepsMobileContentClear = isDialoguePractice || isDialogueLessonOverview || isDialogueUsefulWords || isSignup;
	const [open, setOpen] = useState(false);
	const [form, setForm] = useState(initialForm);
	const [status, setStatus] = useState("idle");
	const [error, setError] = useState("");
	const dialogRef = useRef(null);
	const honeypotRef = useRef(null);

	useEffect(() => {
		if (!open) return undefined;
		const previousFocus = document.activeElement;
		dialogRef.current?.querySelector("select")?.focus();
		const onKeyDown = (event) => {
			if (event.key === "Escape") {
				setOpen(false);
				return;
			}
			if (event.key !== "Tab") return;

			const focusable = dialogRef.current?.querySelectorAll(
				'a[href], button:not([disabled]), input:not([disabled]):not([tabindex="-1"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
			);
			if (!focusable?.length) {
				event.preventDefault();
				return;
			}

			const first = focusable[0];
			const last = focusable[focusable.length - 1];
			if (event.shiftKey && (document.activeElement === first || !dialogRef.current?.contains(document.activeElement))) {
				event.preventDefault();
				last.focus();
			} else if (!event.shiftKey && (document.activeElement === last || !dialogRef.current?.contains(document.activeElement))) {
				event.preventDefault();
				first.focus();
			}
		};
		document.addEventListener("keydown", onKeyDown);
		return () => {
			document.removeEventListener("keydown", onKeyDown);
			if (previousFocus instanceof HTMLElement) previousFocus.focus();
		};
	}, [open]);

	function close() {
		setOpen(false);
		setStatus("idle");
		setError("");
	}

	async function submit(event) {
		event.preventDefault();
		setStatus("loading");
		setError("");
		try {
			const response = await fetch("/api/v1/feedback", {
				method: "POST",
				credentials: "same-origin",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ ...form, website: honeypotRef.current?.value || "" }),
			});
			if (!response.ok) {
				setStatus("error");
				setError(response.status === 429 ? t("rateLimited") : t("error"));
				return;
			}
			setStatus("success");
			setForm(initialForm);
			if (honeypotRef.current) honeypotRef.current.value = "";
		} catch {
			setStatus("error");
			setError(t("error"));
		}
	}

	return (
		<>
			<div className={keepsMobileContentClear ? "relative z-[90] flex justify-end px-4 pb-4 md:contents" : "contents"}>
				<button
					type="button"
					onClick={() => {
						setStatus("idle");
						setError("");
						setOpen(true);
					}}
					className={`${keepsMobileContentClear ? "relative md:fixed md:bottom-6 md:right-6" : "fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-4 sm:bottom-6 sm:right-6"} z-[90] inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-white shadow-lg transition hover:bg-primary-hover dark:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-page`}
					aria-haspopup="dialog"
					aria-expanded={open}
				>
					<MessageSquare size={17} aria-hidden="true" />
					{t("button")}
				</button>
			</div>

			{open && (
				<div
					className="fixed inset-0 z-[100] flex items-end justify-center bg-page/80 p-0 backdrop-blur-sm sm:items-center sm:p-4"
					onMouseDown={(event) => {
						if (event.target === event.currentTarget) close();
					}}
				>
					<section
						ref={dialogRef}
						role="dialog"
						aria-modal="true"
						aria-labelledby="feedback-title"
						className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-app bg-surface p-5 text-main shadow-2xl sm:rounded-3xl sm:p-7"
					>
						<header className="mb-5 flex items-start justify-between gap-4">
							<div>
								<h2 id="feedback-title" className="text-xl font-bold">{t("title")}</h2>
								<p className="mt-1 text-sm text-slate-600">{t("subtitle")}</p>
							</div>
							<button type="button" onClick={close} className="rounded-full p-2 text-secondary transition hover:bg-hover hover:text-main focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40" aria-label={t("close")}>
								<X size={19} aria-hidden="true" />
							</button>
						</header>

						{status === "success" ? (
							<div role="status" className="rounded-2xl bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
								{t("success")}
							</div>
						) : (
							<form onSubmit={submit} className="space-y-4">
								<label className="block text-sm font-semibold" htmlFor="feedback-type">{t("typeLabel")}
									<select id="feedback-type" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })} className="mt-1.5 min-h-11 w-full accent-primary rounded-xl border border-app bg-input px-3 text-main font-normal outline-none transition placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/20">
										<option className="bg-surface text-main checked:bg-primary-soft checked:text-brand-text focus:bg-primary-soft focus:text-brand-text" value="suggestion">{t("suggestion")}</option>
										<option className="bg-surface text-main checked:bg-primary-soft checked:text-brand-text focus:bg-primary-soft focus:text-brand-text" value="bug">{t("bug")}</option>
										<option className="bg-surface text-main checked:bg-primary-soft checked:text-brand-text focus:bg-primary-soft focus:text-brand-text" value="general">{t("general")}</option>
									</select>
								</label>
								<label className="block text-sm font-semibold" htmlFor="feedback-message">{t("messageLabel")}
									<textarea id="feedback-message" required minLength={10} maxLength={2000} rows={5} value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} placeholder={t("placeholder")} className="mt-1.5 w-full resize-y rounded-xl border border-app bg-input px-3 py-2.5 leading-6 text-main placeholder:text-muted outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20" />
								</label>
								<input ref={honeypotRef} name="website" type="text" defaultValue="" tabIndex={-1} autoComplete="off" aria-hidden="true" className="pointer-events-none absolute -left-[10000px] h-px w-px opacity-0" />
								<div className="flex items-center justify-between gap-3">
								<p className="min-h-5 text-sm" aria-live="polite">{status === "error" ? <span className="inline-block rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-red-700 dark:text-red-300">{error}</span> : ""}</p>
									<span className="text-xs text-slate-500">{form.message.length}/2000</span>
								</div>
									<button type="submit" disabled={status === "loading"} className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-primary px-4 font-semibold text-white transition hover:bg-primary-hover dark:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-wait disabled:bg-primary-hover disabled:opacity-100 disabled:text-white">
									{status === "loading" ? t("sending") : t("submit")}
								</button>
							</form>
						)}
					</section>
				</div>
			)}
		</>
	);
}
