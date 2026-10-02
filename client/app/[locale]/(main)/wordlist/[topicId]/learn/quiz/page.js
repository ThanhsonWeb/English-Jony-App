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
	Brain,
	CheckCircle2,
	XCircle,
} from "lucide-react";

import Loading from "@/app/_components/loading";
import { ReviewPendingCompletion, ReviewSaveNotice } from "@/app/_components/review/BackgroundReviewSave";
import {
	ReviewCompletion,
	ReviewShell,
	ReviewStatus,
} from "@/app/_components/review/ReviewLayout";

function normalizeText(value) {
	return String(value || "").trim().toLowerCase();
}

function shuffle(items) {
	const shuffled = [...items];

	for (let index = shuffled.length - 1; index > 0; index -= 1) {
		const randomIndex = Math.floor(Math.random() * (index + 1));
		[shuffled[index], shuffled[randomIndex]] = [
			shuffled[randomIndex],
			shuffled[index],
		];
	}

	return shuffled;
}

function getUniqueTranslations(words) {
	const translations = new Map();

	for (const word of words) {
		const normalized = normalizeText(word.vietnamese);
		if (normalized && !translations.has(normalized)) {
			translations.set(normalized, word.vietnamese.trim());
		}
	}

	return [...translations.values()];
}

function buildQuestions(reviewWords, vocabularyPool) {
	const translations = getUniqueTranslations(vocabularyPool);

	if (translations.length < 4) return [];

	return reviewWords.map((word) => {
		const correctAnswer = word.vietnamese.trim();
		const distractors = shuffle(
			translations.filter(
				(translation) =>
					normalizeText(translation) !== normalizeText(correctAnswer),
			),
		).slice(0, 3);

		return {
			word,
			correctAnswer,
			choices: shuffle([correctAnswer, ...distractors]),
		};
	});
}

export default function QuizReviewPage() {
	const t = useTranslations("WordlistReview");
	const { topicId } = useParams();
	const searchParams = useSearchParams();
	const dueOnly = searchParams.get("reviewMode") === "due";
	const router = useRouter();
	const reviewWordsRef = useRef([]);
	const vocabularyPoolRef = useRef([]);
	const formRef = useRef(null);
	const sessionRef = useRef(null);
	const [questions, setQuestions] = useState([]);
	const [questionState, dispatchQuestionState] = useReducer(reviewQuestionReducer, null, createReviewQuestionState);
	const sessionState = questionState.sessionState;
	const selectedChoice = questionState.selectedAnswer;
	const lastFeedback = questionState.feedback;
	const [results, setResults] = useState({ correct: 0, wrong: 0 });
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const reviewSave = useBackgroundReviewSave();
	const { resetAnswers, pending, failed } = reviewSave;
	const [sessionFinished, setSessionFinished] = useState(false);
	const [practiceMode, setPracticeMode] = useState(false);
	const [notEnoughChoices, setNotEnoughChoices] = useState(false);

	const currentIndex = sessionState?.currentIndex ?? 0;
	const waitingForContinue = sessionState?.waitingForContinue ?? false;
	const currentQuestion = questions[currentIndex];

	useEffect(() => {
		let cancelled = false;

		async function loadVocabulary() {
			try {
				const vocabulary = await fetchVocabulary(topicId);
				const topicWords = vocabulary.filter(
					(word) => word.english?.trim() && word.vietnamese?.trim(),
				);
				const reviewWords = selectReviewWords(topicWords, { global: !topicId, dueOnly });
				let vocabularyPool = topicWords;

				if (topicId && reviewWords.length > 0 && getUniqueTranslations(topicWords).length < 4) {
					const allWordsResponse = await fetch("/api/v1/vocab", {
						credentials: "include",
					});

					if (!allWordsResponse.ok) {
						throw new Error("choiceLoadError");
					}

					const allWordsData = await allWordsResponse.json();
					vocabularyPool = (allWordsData.data?.vocabularies || []).filter(
						(word) => word.vietnamese?.trim(),
					);
				}

				if (cancelled) return;

				reviewWordsRef.current = reviewWords;
				vocabularyPoolRef.current = vocabularyPool;

				if (reviewWords.length > 0 && getUniqueTranslations(vocabularyPool).length < 4) {
					setNotEnoughChoices(true);
				} else {
					const nextQuestions = buildQuestions(reviewWords, vocabularyPool);
					sessionRef.current = createMistakeReviewSession(nextQuestions.length);
					dispatchQuestionState({ type: "session-changed", sessionState: sessionRef.current.getSnapshot() });
					setQuestions(nextQuestions);
				}
			} catch (fetchError) {
				if (!cancelled) {
					setError(fetchError.message === "unauthorized" ? "signInError" : fetchError.message === "choiceLoadError" ? "choiceLoadError" : "loadError");
				}
			} finally {
				if (!cancelled) setLoading(false);
			}
		}

		loadVocabulary();

		return () => {
			cancelled = true;
		};
	}, [topicId, dueOnly]);

	function checkAnswer() {
		if (!currentQuestion || !selectedChoice || sessionRef.current?.getSnapshot().waitingForContinue) return;

		const answer = selectedChoice;
		const isCorrect =
			normalizeText(answer) ===
			normalizeText(currentQuestion.correctAnswer);
		const step = submitQuizletReviewAnswer({
			reviewSave, session: sessionRef.current, index: currentIndex,
			wordId: currentQuestion.word._id, mode: "quiz", answer,
			correctAnswer: currentQuestion.correctAnswer,
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
		dispatchQuestionState({ type: "feedback", value: { ...step.feedback, example: currentQuestion.word.example } });
		dispatchQuestionState({ type: "session-changed", sessionState: step.state });
		if (!isCorrect) return;
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

	function restartQuiz() {
		const nextQuestions = buildQuestions(
			reviewWordsRef.current,
			vocabularyPoolRef.current,
		);

		resetAnswers();
		sessionRef.current = createMistakeReviewSession(nextQuestions.length);
		dispatchQuestionState({ type: "reset" });
		dispatchQuestionState({ type: "session-changed", sessionState: sessionRef.current.getSnapshot() });
		setQuestions(nextQuestions);
		setResults({ correct: 0, wrong: 0 });
		setSessionFinished(false);
		setPracticeMode(true);
	}

	useEffect(() => {
		function handleKeyDown(event) {
			const target = event.target;
			if (
				target instanceof HTMLElement &&
				target.closest("input, textarea, select, button, [contenteditable='true']")
			) {
				return;
			}

			if (!currentQuestion) return;

			if (["1", "2", "3", "4"].includes(event.key) && !waitingForContinue) {
				const choice = currentQuestion.choices[Number(event.key) - 1];
				if (choice) {
					event.preventDefault();
					dispatchQuestionState({ type: "selected-answer", value: choice });
				}
			}

			if (event.key === "Enter") {
				event.preventDefault();
				formRef.current?.requestSubmit();
			}
		}

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [currentQuestion, waitingForContinue]);

	if (loading) return <Loading />;

	if (error) {
		return (
			<ReviewStatus
				icon={<XCircle className="h-12 w-12 text-red-400" />}
				title={t("common.openError")}
				message={error === "choiceLoadError" ? t("quiz.choiceLoadError") : t(`common.${error}`)}
				onBack={() => router.push(topicId ? `/wordlist/${topicId}` : "/wordlist")}
			/>
		);
	}

	if (notEnoughChoices) {
		return (
			<ReviewStatus
				icon={<Brain className="h-12 w-12 text-cyan-400" />}
				title={t("quiz.notEnoughTitle")}
				message={t("quiz.notEnoughMessage")}
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
				title={t("quiz.completionTitle")}
				message={t("quiz.completion", { count: total })}
				stats={[
					{ label: t("common.correctStat"), value: results.correct, tone: "emerald" },
					{ label: t("common.wrongStat"), value: results.wrong, tone: "red" },
					{ label: t("common.accuracy"), value: `${accuracy}%`, tone: "blue" },
				]}
				onRestart={restartQuiz}
				onBack={() => router.push(topicId ? `/wordlist/${topicId}` : "/wordlist")}
			/>
			<ReviewSaveNotice pending={pending} failed={failed} />
		</>;
	}

	if (!currentQuestion) {
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
			title={sessionState?.phase === "mistakes" ? t("common.mistakesTitle") : t("quiz.title")}
			description={sessionState?.phase === "mistakes" ? t("common.mistakesDescription") : t("quiz.description")}
			icon={<Brain size={21} />}
			practiceMode={practiceMode}
			current={sessionState?.current ?? 1}
			total={sessionState?.total ?? questions.length}
			onBack={() => router.push(topicId ? `/wordlist/${topicId}` : "/wordlist")}
		>

			<form ref={formRef} onSubmit={handleSubmit}>
				<div className="quiz-review-card relative overflow-hidden rounded-[28px] border border-primary/30 bg-gradient-to-br from-surface via-surface-muted to-surface p-5 sm:p-8">
						<div className="relative">
							<p className="text-center text-sm font-semibold text-brand-text">
								{t("quiz.englishWord")}
							</p>
							<h2 className="mt-4 break-words text-center text-4xl font-bold tracking-tight sm:text-5xl">
								{currentQuestion.word.english}
							</h2>
							{currentQuestion.word.pronunciation && (
								<p className="mt-3 text-center font-mono text-sm text-brand-text sm:text-base">
									{currentQuestion.word.pronunciation}
								</p>
							)}

							<div className="mt-8 grid gap-3 sm:grid-cols-2">
								{currentQuestion.choices.map((choice, index) => (
									<ChoiceButton
										key={normalizeText(choice)}
										choice={choice}
										index={index}
										selectedChoice={selectedChoice}
										correctAnswer={currentQuestion.correctAnswer}
									reveal={questionState.revealed}
									onSelect={(choice) => dispatchQuestionState({ type: "selected-answer", value: choice })}
									/>
								))}
							</div>

							{lastFeedback && (
								<p aria-live="polite" className={`mt-5 rounded-xl px-3 py-2 text-sm ${lastFeedback.type === "correct" ? "bg-emerald-500/10 text-emerald-300" : "bg-red-500/10 text-red-300"}`}>
									{lastFeedback.type === "correct" ? t("common.correct") : <>{t("common.incorrect", { answer: lastFeedback.answer })}</>}
									{lastFeedback.example && <span className="mt-1 block text-slate-300">“{lastFeedback.example}”</span>}
								</p>
							)}

							<button
								type="submit"
								disabled={!waitingForContinue && !selectedChoice}
								className="mt-6 w-full rounded-xl bg-primary px-6 py-4 text-lg font-semibold text-white transition hover:bg-primary-hover active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
							>
								{waitingForContinue ? t("common.continue") : t("common.check")}
							</button>
							<p className="mt-3 text-center text-xs text-slate-600">
								{waitingForContinue ? t("quiz.continueHint") : t("quiz.chooseHint")}
							</p>
						</div>
				</div>
			</form>
		</ReviewShell>
		<ReviewSaveNotice pending={pending} failed={failed} />
		</>
	);
}

function ChoiceButton({
	choice,
	index,
	selectedChoice,
	correctAnswer,
	reveal,
	onSelect,
}) {
	const isSelected = normalizeText(choice) === normalizeText(selectedChoice);
	const isCorrect = normalizeText(choice) === normalizeText(correctAnswer);
	let stateClass =
		"border-app bg-surface text-main hover:border-primary/50 hover:bg-primary-soft";

	if (reveal && isCorrect) {
		stateClass = "border-emerald-500 bg-emerald-500/15 text-emerald-100";
	} else if (reveal && isSelected) {
		stateClass = "border-red-500 bg-red-500/15 text-red-100";
	} else if (isSelected) {
		stateClass = "border-primary bg-primary-soft text-main ring-2 ring-primary/20";
	}

	return (
		<button
			type="button"
			onClick={() => onSelect(choice)}
			disabled={reveal}
			className={`flex min-h-16 items-center gap-3 rounded-2xl border px-4 py-4 text-left font-medium transition active:scale-[0.99] disabled:cursor-default ${stateClass}`}
		>
			<span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-current/20 bg-black/10 text-xs font-bold opacity-80">
				{index + 1}
			</span>
			<span className="break-words">{choice}</span>
		</button>
	);
}
