"use client";

import { useEffect, useReducer, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import styles from "./flashcard.module.css";
import { fetchVocabulary, selectReviewWords } from "@/app/_lib/vocabulary.mjs";
import { isReviewCompletionReady } from "@/app/_lib/reviewSaveController.mjs";
import { getFlashcardFaceContent } from "@/app/_lib/flashcardFace.mjs";
import { createReviewQuestionState, reviewQuestionReducer } from "@/app/_lib/reviewQuestionState.mjs";
import { CheckCircle2, Layers3 } from "lucide-react";
import Loading from "@/app/_components/loading";
import { ReviewPendingCompletion, ReviewSaveNotice, useBackgroundReviewSave } from "@/app/_components/review/BackgroundReviewSave";
import {
	ReviewCompletion,
	ReviewShell,
	ReviewStatus,
} from "@/app/_components/review/ReviewLayout";

function Page() {
	const t = useTranslations("WordlistReview");
	const { topicId } = useParams();
	const searchParams = useSearchParams();
	const dueOnly = searchParams.get("reviewMode") === "due";
	const router = useRouter();
	const [practiceMode, setPracticeMode] = useState(false);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [words, setWords] = useState([]);
	const [questionState, dispatchQuestionState] = useReducer(
		reviewQuestionReducer,
		{ currentIndex: 0 },
		createReviewQuestionState,
	);
	const currentIndex = questionState.sessionState.currentIndex;
	const showAnswer = questionState.revealed;
	const [sessionFinished, setSessionFinished] = useState(false);
	const [results, setResults] = useState({
		forgot: 0,
		hard: 0,
		medium: 0,
		easy: 0,
	});

	const currentWord = words[currentIndex];
	const frontContent = currentWord ? getFlashcardFaceContent(currentWord, "front") : null;
	const backContent = currentWord ? getFlashcardFaceContent(currentWord, "back") : null;
	const { submitAnswer, resetAnswers, pending, failed } = useBackgroundReviewSave();
	// get all word of that topic
	useEffect(() => {
		const controller = new AbortController();
		async function fetchWords() {
			try {
				const vocabulary = await fetchVocabulary(topicId, controller.signal);
				if (!controller.signal.aborted) {
					setWords(selectReviewWords(vocabulary, { global: !topicId, dueOnly }));
				}
			} catch {
				if (!controller.signal.aborted) setError("loadError");
			} finally {
				if (!controller.signal.aborted) setLoading(false);
			}
		}

		fetchWords();
		return () => controller.abort();
	}, [topicId, dueOnly]);

	function handleAnswer(level) {
		if (!currentWord) return;
		const word = words[currentIndex];
		if (!submitAnswer(currentIndex, word._id, { mode: "flashcard", rating: ["again", "hard", "medium", "easy"][level], practice: practiceMode })) return;
		const outcome = ["forgot", "hard", "medium", "easy"][level];
		setResults(previous => ({ ...previous, [outcome]: previous[outcome] + 1 }));
		if (currentIndex === words.length - 1) setSessionFinished(true);
		else dispatchQuestionState({ type: "question-changed", index: currentIndex + 1 });
	}

	if (loading) return <Loading />;
	if (error) return <ReviewStatus title={t("common.openError")} message={t(`flashcard.${error}`)} onBack={() => router.push(topicId ? `/wordlist/${topicId}` : "/wordlist")} />;
	if (sessionFinished && !isReviewCompletionReady(sessionFinished, pending)) {
		return <ReviewPendingCompletion pending={pending} failed={failed} onBack={() => router.push(topicId ? `/wordlist/${topicId}` : "/wordlist")} />;
	}
	if (sessionFinished) {
		const total = results.forgot + results.hard + results.medium + results.easy;

		return <>
			<ReviewCompletion
				message={t("flashcard.completion", { count: total })}
				stats={[
					{ label: t("flashcard.forgot"), value: results.forgot, tone: "red" },
					{ label: t("flashcard.hard"), value: results.hard, tone: "orange" },
					{ label: t("flashcard.remembered"), value: results.medium, tone: "blue" },
					{ label: t("flashcard.easy"), value: results.easy, tone: "emerald" },
				]}
				note={t("flashcard.note")}
				onRestart={() => {
					resetAnswers();
					setPracticeMode(true);
					dispatchQuestionState({ type: "question-changed", index: 0 });
					setSessionFinished(false);
					setResults({ forgot: 0, hard: 0, medium: 0, easy: 0 });
				}}
				onBack={() => router.push(topicId ? `/wordlist/${topicId}` : "/wordlist")}
			/>
			<ReviewSaveNotice pending={pending} failed={failed} />
		</>;
	}

	if (!currentWord) {
		return (
			<ReviewStatus
				icon={<CheckCircle2 className="h-14 w-14 text-emerald-400" />}
				title={t("common.emptyTitle")}
				message={t("flashcard.emptyMessage")}
				onBack={() => router.push(topicId ? `/wordlist/${topicId}` : "/wordlist")}
			/>
		);
	}
	return (
		<>
		<ReviewShell
			title={t("flashcard.title")}
			description={t("flashcard.description")}
			icon={<Layers3 size={21} />}
			practiceMode={practiceMode}
			current={currentIndex + 1}
			total={words.length}
			onBack={() => router.back()}
		>

				{/* ================= FLASHCARD ================= */}
				<div className={styles.scene}>
					<button
						type="button"
						aria-pressed={showAnswer}
						aria-label={t(showAnswer ? "flashcard.flipBack" : "flashcard.reveal")}
						onClick={() => dispatchQuestionState({ type: "reveal", value: !showAnswer })}
		className={`${styles.card} ${showAnswer ? styles.flipped : ""} relative w-full select-none overflow-hidden rounded-[28px] border border-primary/30 bg-gradient-to-br from-surface via-surface-muted to-surface text-center shadow-md shadow-primary/10 transition-colors hover:border-primary/50 hover:shadow-lg hover:shadow-primary/15`}
					>
			<span className={`${styles.flipper} ${showAnswer ? styles.flipperFlipped : ""}`} data-visible-face={showAnswer ? "back" : "front"}>
			<span className={`${styles.face} ${styles.front} px-5 py-8 sm:px-10 sm:py-10`} aria-hidden={showAnswer}>
							<span className="absolute left-6 top-6 h-2 w-2 rounded-full bg-primary/40" />
							<span className="absolute right-8 top-8 h-1.5 w-1.5 rounded-full bg-primary/30" />
							<span className="flex w-full flex-col items-center justify-center">
								<span className="max-w-full break-words text-5xl font-bold tracking-tight text-main sm:text-6xl">
									{frontContent.primary}
								</span>
								{frontContent.pronunciation && (
									<span className="mt-3 break-words font-mono text-sm text-brand-text sm:text-base">
										{frontContent.pronunciation}
									</span>
								)}
								<span className="mt-8 flex items-center gap-3 text-sm text-secondary">
									<span aria-hidden="true" className="text-brand-text">↻</span>
									{t("flashcard.reveal")}
								</span>
							</span>
			</span>

			<span className={`${styles.face} ${styles.back} px-5 py-8 sm:px-10 sm:py-10`} aria-hidden={!showAnswer}>
							<span className="absolute left-6 top-6 h-2 w-2 rounded-full bg-primary/40" />
							<span className="absolute right-8 top-8 h-1.5 w-1.5 rounded-full bg-primary/30" />
							<span className="flex w-full flex-col items-center justify-center">
								<span className="mb-3 text-sm font-medium text-brand-text">{backContent.context}</span>
								<span className="max-w-full break-words text-4xl font-bold tracking-tight text-main sm:text-5xl">
									{backContent.primary}
								</span>
								{backContent.example && (
									<span className="mt-6 max-w-xl border-t border-primary/20 px-4 pt-5 text-sm italic leading-relaxed text-secondary">
										“{backContent.example}”
									</span>
								)}
								<span className="mt-6 text-xs text-secondary">{t("flashcard.flipBack")}</span>
							</span>
			</span>
			</span>
					</button>
				</div>
				{/* ================= ANSWER SECTION ================= */}
				<div className="mt-4">
					<div className="mb-2 flex items-center justify-between">
						<p className="text-sm font-medium text-secondary">
							{t("flashcard.recallQuestion")}
						</p>

						<p className="hidden text-xs text-muted sm:block">
							{t("flashcard.chooseLevel")}
						</p>
					</div>

					<div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
						{/* Forgot */}
						<button
							onClick={() => handleAnswer(0)}
							className="
							flex min-w-0 flex-col items-center justify-center
							rounded-xl border border-red-500/20
							bg-red-500/5
							px-2 py-3
							text-red-400
							transition-all duration-200
							hover:-translate-y-0.5
							hover:border-red-500/40
							hover:bg-red-500/10
							active:scale-[0.97]
						"
						>
							<span className="text-sm font-medium sm:text-base">
								😵 {t("flashcard.forgot")}
							</span>

						</button>

						{/* Hard */}
						<button
							onClick={() => handleAnswer(1)}
							className="
							flex min-w-0 flex-col items-center justify-center
							rounded-xl border border-orange-500/20
							bg-orange-500/5
							px-2 py-3
							text-orange-400
							transition-all duration-200
							hover:-translate-y-0.5
							hover:border-orange-500/40
							hover:bg-orange-500/10
							active:scale-[0.97]
						"
						>
							<span className="text-sm font-medium sm:text-base">😓 {t("flashcard.hard")}</span>

						</button>

						{/* Medium */}
						<button
							onClick={() => handleAnswer(2)}
							className="
							flex min-w-0 flex-col items-center justify-center
							rounded-xl border border-primary/20
							bg-primary-soft
							px-2 py-3
							text-brand-text
							transition-all duration-200
							hover:-translate-y-0.5
							hover:border-primary/50
							hover:bg-primary/15
							active:scale-[0.97]
						"
						>
							<span className="text-sm font-medium sm:text-base">
								🙂 {t("flashcard.remembered")}
							</span>

						</button>

						{/* Easy */}
						<button
							onClick={() => handleAnswer(3)}
							className="
							flex min-w-0 flex-col items-center justify-center
							rounded-xl border border-emerald-500/20
							bg-emerald-500/5
							px-2 py-3
							text-emerald-400
							transition-all duration-200
							hover:-translate-y-0.5
							hover:border-emerald-500/40
							hover:bg-emerald-500/10
							active:scale-[0.97]
						"
						>
							<span className="text-sm font-medium sm:text-base">✅ {t("flashcard.easy")}</span>

						</button>
					</div>
				</div>
		</ReviewShell>
		<ReviewSaveNotice pending={pending} failed={failed} />
		</>
	);
}

export default Page;
