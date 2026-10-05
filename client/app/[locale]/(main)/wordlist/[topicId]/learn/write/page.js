"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { fetchVocabulary, selectReviewWords } from "@/app/_lib/vocabulary.mjs";
import { isReviewCompletionReady } from "@/app/_lib/reviewSaveController.mjs";
import { createMistakeReviewSession } from "@/app/_lib/mistakeReviewSession.mjs";
import { createReviewQuestionState, reviewQuestionReducer } from "@/app/_lib/reviewQuestionState.mjs";
import { submitQuizletReviewAnswer } from "@/app/_lib/quizletReviewAction.mjs";
import { useBackgroundReviewSave } from "@/app/_lib/useBackgroundReviewSave.mjs";
import {
	CheckCircle2,
	PenLine,
	XCircle,
} from "lucide-react";

import Loading from "@/app/_components/loading";
import { ReviewPendingCompletion, ReviewSaveNotice } from "@/app/_components/review/BackgroundReviewSave";
import {
	ReviewCompletion,
	ReviewShell,
	ReviewStatus,
} from "@/app/_components/review/ReviewLayout";

function normalizeAnswer(value) {
	return value.trim().toLowerCase();
}

export default function WriteReviewPage() {
	const t = useTranslations("WordlistReview");
	const { topicId } = useParams();
	const searchParams = useSearchParams();
	const dueOnly = searchParams.get("reviewMode") === "due";
	const router = useRouter();
	const inputRef = useRef(null);
	const sessionRef = useRef(null);
	const [words, setWords] = useState([]);
	const [questionState, dispatchQuestionState] = useReducer(reviewQuestionReducer, null, createReviewQuestionState);
	const sessionState = questionState.sessionState;
	const answer = questionState.answer;
	const lastFeedback = questionState.feedback;
	const [results, setResults] = useState({ correct: 0, wrong: 0 });
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const reviewSave = useBackgroundReviewSave();
	const { resetAnswers, pending, failed } = reviewSave;
	const [sessionFinished, setSessionFinished] = useState(false);
	const [practiceMode, setPracticeMode] = useState(false);

	const currentIndex = sessionState?.currentIndex ?? 0;
	const waitingForContinue = sessionState?.waitingForContinue ?? false;
	const currentWord = words[currentIndex];

	useEffect(() => {
		let cancelled = false;

		async function fetchWords() {
			try {
				const vocabulary = await fetchVocabulary(topicId);
				const reviewWords = selectReviewWords(vocabulary, { global: !topicId, dueOnly });

				if (!cancelled) {
					sessionRef.current = createMistakeReviewSession(reviewWords.length);
					dispatchQuestionState({ type: "session-changed", sessionState: sessionRef.current.getSnapshot() });
					setWords(reviewWords);
				}
			} catch (fetchError) {
				if (!cancelled) {
					setError(fetchError.message === "unauthorized" ? "signInError" : "loadError");
				}
			} finally {
				if (!cancelled) setLoading(false);
			}
		}

		fetchWords();

		return () => {
			cancelled = true;
		};
	}, [topicId, dueOnly]);

	useEffect(() => {
		if (navigator.maxTouchPoints > 0 || window.matchMedia("(max-width: 767px), (any-pointer: coarse)").matches) return;
		if (!loading && !sessionFinished && !waitingForContinue) {
			inputRef.current?.focus();
		}
	}, [currentIndex, loading, sessionFinished, waitingForContinue]);

	function checkAnswer() {
		if (!currentWord || !answer.trim() || sessionRef.current?.getSnapshot().waitingForContinue) return;
		const submittedAnswer = answer;
		const isCorrect =
			normalizeAnswer(submittedAnswer) === normalizeAnswer(currentWord.english);
		const step = submitQuizletReviewAnswer({
			reviewSave, session: sessionRef.current, index: currentIndex,
			wordId: currentWord._id, mode: "writing", answer: submittedAnswer,
			correctAnswer: currentWord.english,
			practice: practiceMode, correct: isCorrect,
		});
		if (!step.accepted) return;
		if (step.firstAttempt) {
			setResults((previous) => ({
				...previous,
				[isCorrect ? "correct" : "wrong"]:
					previous[isCorrect ? "correct" : "wrong"] + 1,
			}));
		}
		if (!isCorrect) {
			dispatchQuestionState({ type: "feedback", value: { ...step.feedback, example: currentWord.example, pronunciation: currentWord.pronunciation } });
			dispatchQuestionState({ type: "session-changed", sessionState: step.state });
			return;
		}
		dispatchQuestionState({ type: "feedback", value: { ...step.feedback, example: currentWord.example } });
		dispatchQuestionState({ type: "session-changed", sessionState: step.state });
		if (step.state.finished) setSessionFinished(true);
	}

	function continueAfterWrong() {
		const nextSession = sessionRef.current?.continueAfterWrong();
		if (!nextSession?.accepted) return;
		dispatchQuestionState({ type: "session-changed", sessionState: nextSession.state });
		if (nextSession.state.finished) setSessionFinished(true);
	}

	function handleSubmit(event) {
		event.preventDefault();
		if (waitingForContinue) continueAfterWrong();
		else checkAnswer();
	}

	function restartReview() {
		resetAnswers();
		sessionRef.current = createMistakeReviewSession(words.length);
		dispatchQuestionState({ type: "reset" });
		dispatchQuestionState({ type: "session-changed", sessionState: sessionRef.current.getSnapshot() });
		setPracticeMode(true);
		setResults({ correct: 0, wrong: 0 });
		setSessionFinished(false);
	}

	if (loading) return <Loading />;

	if (error) {
		return (
			<ReviewStatus
				icon={<XCircle className="h-12 w-12 text-red-400" />}
				title={t("common.openError")}
				message={t(`common.${error}`)}
				onBack={() => router.push(topicId ? `/wordlist/${topicId}` : "/wordlist")}
			/>
		);
	}

	if (sessionFinished && !isReviewCompletionReady(sessionFinished, pending)) {
		return <ReviewPendingCompletion pending={pending} failed={failed} onBack={() => router.push(topicId ? `/wordlist/${topicId}` : "/wordlist")} />;
	}

	if (sessionFinished) {
		const total = results.correct + results.wrong;
		const accuracy = total > 0 ? Math.round((results.correct / total) * 100) : 0;

		return <>
			<ReviewCompletion
				message={t("writing.completion", { count: total })}
				stats={[
					{ label: t("common.correctStat"), value: results.correct, tone: "emerald" },
					{ label: t("common.wrongStat"), value: results.wrong, tone: "red" },
					{ label: t("common.accuracy"), value: `${accuracy}%`, tone: "blue" },
				]}
				onRestart={restartReview}
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
				message={t("common.emptyMessage")}
				onBack={() => router.push(topicId ? `/wordlist/${topicId}` : "/wordlist")}
			/>
		);
	}

	return (
		<>
		<ReviewShell
			title={sessionState?.phase === "mistakes" ? t("common.mistakesTitle") : t("writing.title")}
			description={sessionState?.phase === "mistakes" ? t("common.mistakesDescription") : t("writing.description")}
			icon={<PenLine size={21} />}
			practiceMode={practiceMode}
			current={sessionState?.current ?? 1}
			total={sessionState?.total ?? words.length}
			onBack={() => router.push(topicId ? `/wordlist/${topicId}` : "/wordlist")}
		>

			<form onSubmit={handleSubmit}>
				<div className="relative overflow-hidden rounded-[28px] border border-primary/30 bg-gradient-to-br from-surface via-surface-muted to-surface p-6 sm:p-10">
						<div className="relative">
							{lastFeedback && (
								<p aria-live="polite" className={`mb-5 rounded-xl px-3 py-2 text-sm ${lastFeedback.type === "correct" ? "bg-emerald-500/10 text-emerald-300" : "bg-red-500/10 text-red-300"}`}>
									{lastFeedback.type === "correct" ? t("common.correct") : t("common.incorrect", { answer: lastFeedback.answer })}
									{lastFeedback.type === "wrong" && lastFeedback.pronunciation && <span className="mt-1 block font-mono text-slate-300">{lastFeedback.pronunciation}</span>}
									{lastFeedback.example && <span className="mt-1 block text-slate-300">“{lastFeedback.example}”</span>}
								</p>
							)}
							<p className="text-sm font-semibold text-brand-text">
								{t("writing.vietnameseMeaning")}
							</p>
							<h2 className="mt-4 max-w-2xl break-words text-4xl font-bold leading-tight tracking-tight sm:text-6xl">
								{currentWord.vietnamese}
							</h2>

							<label htmlFor="write-answer" className="mt-9 block text-sm font-medium text-slate-400">
								{t("writing.answerLabel")}
							</label>
							<input
								ref={inputRef}
								id="write-answer"
								type="text"
								value={answer}
								onChange={(event) => dispatchQuestionState({ type: "answer", value: event.target.value })}
								disabled={waitingForContinue}
								autoComplete="off"
								spellCheck="false"
								placeholder={t("writing.placeholder")}
								className={`mt-2 w-full rounded-2xl border bg-input px-5 py-4 text-xl font-semibold text-main outline-none transition placeholder:font-normal placeholder:text-muted focus:ring-4 sm:px-6 sm:py-5 sm:text-2xl ${waitingForContinue ? "border-red-500/60" : "border-app focus:border-primary focus:ring-primary/15"}`}
							/>

							<button
								type="submit"
								disabled={!waitingForContinue && !answer.trim()}
								className="mt-6 w-full rounded-xl bg-primary px-6 py-4 text-lg font-semibold text-white transition hover:bg-primary-hover active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
							>
								{waitingForContinue ? t("common.continue") : t("common.check")}
							</button>
						</div>
				</div>
			</form>
		</ReviewShell>
		<ReviewSaveNotice pending={pending} failed={failed} />
		</>
	);
}
