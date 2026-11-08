"use client";

import { useMemo, useRef, useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import Image from "next/image";
import {
	AlertCircle,
	ArrowRight,
	BookmarkPlus,
	Check,
	LoaderCircle,
	LogIn,
	Volume2,
} from "lucide-react";

import { useAuth } from "@/app/_contexts/AuthContext";
import { cacheVocabularyChange } from "@/app/_lib/vocabulary.mjs";
import { useVocabularyResource } from "@/app/_lib/useStudyResources";

const normalizeWord = (value = "") => value.trim().toLocaleLowerCase("en");

function DialogueCompletionCard({ titleId, children }) {
	return (
		<section
			data-testid="dialogue-completion-card"
			aria-labelledby={titleId}
			className="overflow-hidden rounded-3xl border border-app bg-surface text-main shadow-xl"
		>
			<div className="grid md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
				<div
					aria-hidden="true"
					className="relative h-36 overflow-hidden bg-gradient-to-br from-primary-soft via-hero to-success-soft md:h-auto md:min-h-[260px]"
				>
					<Image
						src="/dialogue-completion-boy-cat.png"
						alt=""
						fill
						priority
						sizes="(max-width: 768px) 100vw, 360px"
						className="object-contain p-3 sm:p-5"
					/>
				</div>
				<div className="flex min-w-0 flex-col justify-center gap-4 p-5 sm:p-7 md:p-8">
					{children}
				</div>
			</div>
		</section>
	);
}

export default function DialogueUsefulWords({
	words: sourceWords,
	lessonId,
	dialogueId,
	dialogueTitle,
	completionMessage,
	nextDialogue,
}) {
	const router = useRouter();
	const t = useTranslations("DialogueFeature");
	const { user, loading: authLoading, captureSession, isCurrentSession } = useAuth();
	const userId = user?._id || user?.id;
	const isSubmittingRef = useRef(false);
	const words = useMemo(() => {
		const uniqueWords = new Map();

		for (const item of sourceWords || []) {
			const key = normalizeWord(item.word);
			if (key && !uniqueWords.has(key)) uniqueWords.set(key, item);
		}

		return [...uniqueWords.values()];
	}, [sourceWords]);
	const [selectedWords, setSelectedWords] = useState(
		() => new Set(words.map((item) => normalizeWord(item.word))),
	);
	const { data: libraryWords = [], loading: libraryLoading, error: libraryError } = useVocabularyResource(userId, undefined, !authLoading);
	const savedWords = useMemo(() => new Set(libraryWords.map(item => normalizeWord(item.english))), [libraryWords]);
	const [isSaving, setIsSaving] = useState(false);
	const [saveError, setError] = useState("");
	const error = saveError || (libraryError ? libraryError.message || t("notebookLoadError") : "");
	const [savedCount, setSavedCount] = useState(null);
	const lessonHref = `/dialogue/${lessonId}`;
	const nextDialogueAction = nextDialogue && (
		<Link
			href={nextDialogue.href}
		className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl px-4 py-2 text-center font-semibold text-brand-text transition hover:bg-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current lg:whitespace-nowrap"
		>
			{t("nextDialogue", { title: nextDialogue.title })} <ArrowRight size={18} aria-hidden="true" />
		</Link>
	);

	const selectableWords = words.filter(
		(item) => !savedWords.has(normalizeWord(item.word)),
	);
	const selectedUnsavedWords = selectableWords.filter((item) =>
		selectedWords.has(normalizeWord(item.word)),
	);
	const allWordsSaved =
		Boolean(user) && !libraryLoading && words.length > 0 && selectableWords.length === 0;

	function toggleWord(item) {
		const key = normalizeWord(item.word);
		if (savedWords.has(key) || isSaving) return;

		setSelectedWords((current) => {
			const next = new Set(current);
			if (next.has(key)) next.delete(key);
			else next.add(key);
			return next;
		});
	}

	function speakWord(word) {
		if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
		window.speechSynthesis.cancel();
		const utterance = new SpeechSynthesisUtterance(word);
		utterance.lang = "en-US";
		window.speechSynthesis.speak(utterance);
	}

	async function saveSelectedWords() {
		if (isSubmittingRef.current || isSaving) return;

		if (!user || selectedUnsavedWords.length === 0) {
			router.push(lessonHref);
			return;
		}

		isSubmittingRef.current = true;
		const session = captureSession();
		setIsSaving(true);
		setError("");

		try {
			const results = await Promise.allSettled(
				selectedUnsavedWords.map(async (item) => {
					const response = await fetch("/api/v1/vocab", {
						method: "POST",
						credentials: "include",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							english: item.word,
							vietnamese: item.translation || item.meaning,
							pronunciation: item.pronunciation || "",
							example: item.example || "",
							source: {
								type: "dialogue",
								lessonId,
								dialogueId,
								dialogueTitle,
							},
						}),
					});

						if (!response.ok) throw new Error(t("wordSaveError", { word: item.word }));
					const payload = await response.json();
					return { key: normalizeWord(item.word), word: payload.data?.newVocab };
				}),
			);

			if (!isCurrentSession(session)) return;
			const savedItems = results
				.filter((result) => result.status === "fulfilled")
				.map((result) => result.value);
			const savedKeys = savedItems.map(item => item.key);
			const failedCount = results.length - savedKeys.length;

			for (const item of savedItems) {
				if (item.word?._id) cacheVocabularyChange(userId, { word: item.word });
			}

			if (failedCount > 0) {
				setError(
					t("partialSaveError", { saved: savedKeys.length, failed: failedCount }),
				);
			} else {
				setSavedCount(savedKeys.length);
			}
		} finally {
			isSubmittingRef.current = false;
			setIsSaving(false);
		}
	}

	if (savedCount !== null) {
		return (
			<main className="flex min-h-[calc(100vh-80px)] items-center justify-center bg-page px-4 py-8 text-main sm:py-10">
				<div className="w-full max-w-4xl">
					<DialogueCompletionCard titleId="dialogue-completion-title">
						{completionMessage && (
							<div data-testid="dialogue-completion-message" role="status" aria-live="polite" aria-atomic="true">
								<h1 id="dialogue-completion-title" data-completion-title className="text-2xl font-bold sm:text-3xl">
									{t("dialogueCompletionTitle")}
								</h1>
								<p data-completion-description className="mt-3 leading-7 text-secondary">
									{completionMessage.type === "guest"
										? t("dialogueCompletionGuest")
										: t("dialogueCompletionSaved", { completed: completionMessage.completed, total: completionMessage.total })}
								</p>
							</div>
						)}
						<div className="flex items-start gap-3 rounded-2xl border border-success/25 bg-success-soft p-4">
							<Check size={20} aria-hidden="true" className="mt-0.5 shrink-0 text-success" />
							<div>
								<h2 id={completionMessage ? undefined : "dialogue-completion-title"} className="font-semibold">
									{t("savedWords", { count: savedCount })}
								</h2>
								<p className="mt-1 text-sm leading-6 text-secondary">{t("reviewWordsLater")}</p>
							</div>
						</div>
						<button
							type="button"
							onClick={() => router.push(lessonHref)}
							className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 font-semibold text-white transition hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-text"
						>
							{t("continue")} <ArrowRight size={18} aria-hidden="true" />
						</button>
						{nextDialogueAction && <div className="flex justify-center">{nextDialogueAction}</div>}
					</DialogueCompletionCard>
				</div>
			</main>
		);
	}

	return (
		<main data-testid="dialogue-vocabulary-selection" className="min-h-[calc(100vh-80px)] bg-page px-4 py-5 pb-[calc(100px+env(safe-area-inset-bottom))] text-main sm:px-6 sm:pt-5 sm:pb-8">
			<div className="mx-auto w-full max-w-6xl">
				<section className="grid items-center gap-2 md:mx-auto md:max-w-5xl md:grid-cols-[minmax(0,1.1fr)_minmax(260px,0.7fr)] md:gap-0">
					<div className="min-w-0 pb-2 md:pb-0">
						<p className="text-sm font-semibold text-brand-text sm:text-base">{dialogueTitle}</p>
						<h1 id="useful-words-heading" data-testid="useful-words-heading" className="mt-2 flex items-center gap-2 text-xl font-bold tracking-tight sm:text-2xl lg:text-3xl">
							<BookmarkPlus size={27} aria-hidden="true" className="shrink-0 text-success" />
							{t("usefulWordsTitle")}
						</h1>
						<p className="mt-3 max-w-2xl text-sm leading-6 text-secondary sm:text-base">
							{t("usefulWordsDescription")}
						</p>
					</div>
					<div data-testid="useful-words-illustration" className="relative mx-auto h-36 w-full max-w-sm md:mx-0 md:ml-0 md:h-36 md:max-w-xs lg:h-40">
						<Image
							src="/dialogue-completion-boy-cat.png"
							alt=""
							fill
							priority
							sizes="(max-width: 768px) 90vw, (max-width: 1280px) 42vw, 520px"
							className="object-contain object-bottom"
						/>
						<div data-testid="dialogue-selected-word-count" role="status" aria-live="polite" aria-atomic="true" className="absolute bottom-2 right-2 inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-success/20 bg-success-soft px-3 py-1.5 text-sm font-semibold text-success shadow-sm md:right-[-4rem]">
							<Check size={16} aria-hidden="true" />
							{t("selectedWordCount", { count: selectedUnsavedWords.length })}
						</div>
					</div>
				</section>
				{!authLoading && !user && (
					<div className="mt-3 flex flex-col gap-2 rounded-xl border border-app bg-surface-muted px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
						<p className="min-w-0 text-sm leading-5 text-secondary">
							<strong className="font-semibold text-main">{t("signInToSaveWords")}</strong>{" "}
							{t("canSkipWords")}
						</p>
						<Link
							href="/login"
							className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold text-brand-text transition hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
						>
							<LogIn size={16} aria-hidden="true" /> {t("signIn")}
						</Link>
					</div>
				)}

				{error && (
					<div role="alert" className="mt-5 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300">
						<AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
						<p>{error}</p>
					</div>
				)}

				<div className="mt-2 rounded-3xl border border-app bg-surface p-3 shadow-sm sm:p-4 md:mt-0">
					<div
						id="dialogue-useful-words-list"
						data-testid="dialogue-word-list"
						role="region"
						aria-labelledby="useful-words-heading"
						tabIndex={0}
						style={{ scrollbarWidth: "thin", scrollbarColor: "color-mix(in srgb, var(--sj-primary) 55%, transparent) transparent" }}
						className="h-[min(34vh,300px)] min-h-[220px] space-y-1.5 overflow-y-auto overscroll-contain pr-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 sm:h-[min(40vh,360px)] sm:min-h-[260px] sm:pr-2 md:h-[min(38vh,360px)] md:min-h-[280px]"
					>
						{words.map((item) => {
							const key = normalizeWord(item.word);
							const isSaved = savedWords.has(key);
							const isSelected = selectedWords.has(key);

							return (
								<div key={key} className="relative">
								<button
									type="button"
									onClick={() => toggleWord(item)}
									disabled={isSaved || isSaving}
									aria-pressed={isSaved || isSelected}
									className={`grid min-h-16 w-full cursor-pointer grid-cols-[24px_minmax(0,1fr)] items-center gap-x-3 gap-y-1 rounded-xl border px-3 py-2.5 pr-14 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 md:grid-cols-[28px_minmax(0,0.9fr)_minmax(110px,0.45fr)_minmax(0,1.1fr)] md:gap-x-4 md:px-5 md:pr-14 ${
										isSaved
											? "cursor-default border-success/20 bg-success-soft"
											: isSelected
												? "border-success/25 bg-success-soft"
												: "border-transparent bg-surface-muted/50 hover:bg-success-soft/50"
										}`}
								>
									<span
										aria-hidden="true"
										className={`row-span-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border md:row-span-1 ${
											isSaved || isSelected
												? "border-primary bg-primary text-white"
												: "border-border-strong bg-input text-main"
										}`}
									>
										{(isSaved || isSelected) && <Check size={15} aria-hidden="true" />}
									</span>
									<strong className="min-w-0 break-words text-base font-semibold text-main md:col-start-2 md:text-lg">
										{item.word}
										{isSaved && <span className="ml-2 text-xs font-semibold text-success">{t("saved")}</span>}
									</strong>
									{item.pronunciation ? (
										<span className="min-w-0 font-mono text-xs text-secondary md:text-sm">
											{item.pronunciation}
										</span>
									) : <span className="hidden md:block" aria-hidden="true" />}
									<span className="col-start-2 min-w-0 text-sm leading-5 text-secondary md:col-start-4 md:text-base">
										{item.translation || item.meaning}
									</span>
								</button>
								<button type="button" aria-label={`Read ${item.word}`} onClick={(event) => { event.stopPropagation(); speakWord(item.word); }} className="absolute right-3 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-brand-text transition hover:scale-110 hover:bg-success-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50">
									<Volume2 size={17} aria-hidden="true" />
								</button>
								</div>
							);
						})}
					</div>
				</div>

				{(authLoading || libraryLoading) && user && (
					<div className="mt-5 flex items-center justify-center gap-2 text-sm text-secondary">
						<LoaderCircle className="h-4 w-4 animate-spin" /> {t("checkingNotebook")}
					</div>
				)}

				{allWordsSaved && (
					<p role="status" className="mt-5 rounded-xl border border-success/20 bg-success-soft p-4 text-center text-sm text-success">
						✓ {t("allWordsSaved")}
					</p>
				)}

				<div data-testid="dialogue-selection-actions" className="mt-5 rounded-2xl border border-app bg-surface p-2 shadow-sm sm:p-4 lg:flex lg:items-center lg:justify-center lg:gap-12">
					<button
						type="button"
						onClick={saveSelectedWords}
						disabled={
							isSaving ||
							authLoading ||
							(Boolean(user) && libraryLoading)
						}
						className="mx-auto inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 font-semibold text-white shadow-sm transition hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-50 md:max-w-4xl lg:mx-0 lg:w-[28rem] lg:max-w-[40vw] lg:flex-none"
					>
						{isSaving ? (
							<>
								<LoaderCircle className="h-5 w-5 animate-spin" /> {t("saving")}
							</>
						) : selectedUnsavedWords.length > 0 && user ? (
							t("saveWords", { count: selectedUnsavedWords.length })
						) : (
							t("continueWithoutSaving")
						)}
					</button>
					<div className={`mt-1 grid items-center gap-1 ${nextDialogue ? "grid-cols-2 sm:flex sm:justify-center sm:gap-6" : ""} lg:mt-0 lg:flex lg:items-center lg:justify-center lg:gap-6`}>
						<button
							type="button"
							onClick={() => router.push(lessonHref)}
							disabled={isSaving}
							className="min-h-11 w-full cursor-pointer rounded-lg px-2 py-2.5 text-sm font-semibold text-secondary transition hover:bg-hover hover:text-main focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:opacity-40 sm:w-auto sm:px-4 lg:whitespace-nowrap"
						>
							{t("skip")}
						</button>
						{nextDialogueAction && <div className="flex justify-center">{nextDialogueAction}</div>}
					</div>
				</div>
			</div>
		</main>
	);
}
