"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { fetchVocabulary, selectReviewWords } from "@/app/_lib/vocabulary.mjs";
import { isReviewCompletionReady } from "@/app/_lib/reviewSaveController.mjs";
import { createMistakeReviewSession } from "@/app/_lib/mistakeReviewSession.mjs";
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
	const { topicId } = useParams();
	const searchParams = useSearchParams();
	const dueOnly = searchParams.get("reviewMode") === "due";
	const router = useRouter();
	const reviewWordsRef = useRef([]);
	const vocabularyPoolRef = useRef([]);
	const formRef = useRef(null);
	const sessionRef = useRef(null);
	const [questions, setQuestions] = useState([]);
	const [sessionState, setSessionState] = useState(null);
	const [selectedChoice, setSelectedChoice] = useState("");
	const [lastFeedback, setLastFeedback] = useState(null);
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
						throw new Error("Không thể tải từ để tạo đáp án.");
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
					setSessionState(sessionRef.current.getSnapshot());
					setQuestions(nextQuestions);
				}
			} catch (fetchError) {
				if (!cancelled) {
					setError(fetchError.message === "unauthorized" ? "Vui lòng đăng nhập để ôn tập." : "Không thể tải danh sách từ. Vui lòng thử lại.");
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
		setSessionState(step.state);

		if (step.firstAttempt) {
			setResults((previous) => ({
				...previous,
				[isCorrect ? "correct" : "wrong"]:
					previous[isCorrect ? "correct" : "wrong"] + 1,
			}));
		}
		if (!isCorrect) {
			setLastFeedback({ ...step.feedback, example: currentQuestion.word.example });
			return;
		}
		setLastFeedback({ ...step.feedback, example: currentQuestion.word.example });
		setSelectedChoice("");
		if (step.state.finished) setSessionFinished(true);
	}

	function continueAfterWrong() {
		const nextSession = sessionRef.current?.continueAfterWrong();
		if (!nextSession?.accepted) return;
		setSessionState(nextSession.state);
		setSelectedChoice("");
		setLastFeedback(null);
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
		setSessionState(sessionRef.current.getSnapshot());
		setQuestions(nextQuestions);
		setSelectedChoice("");
		setLastFeedback(null);
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
					setSelectedChoice(choice);
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
				title="Không thể mở bài ôn"
				message={error}
				onBack={() => router.push(topicId ? `/wordlist/${topicId}` : "/wordlist")}
			/>
		);
	}

	if (notEnoughChoices) {
		return (
			<ReviewStatus
				icon={<Brain className="h-12 w-12 text-cyan-400" />}
				title="Chưa đủ từ để tạo câu hỏi"
				message="Bạn cần ít nhất 4 nghĩa tiếng Việt khác nhau trong sổ tay để dùng chế độ Trắc nghiệm."
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
				title="Hoàn thành!"
				message={`Bạn đã hoàn thành ${total} câu hỏi Trắc nghiệm.`}
				stats={[
					{ label: "Đúng", value: results.correct, tone: "emerald" },
					{ label: "Sai", value: results.wrong, tone: "red" },
					{ label: "Chính xác", value: `${accuracy}%`, tone: "blue" },
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
				title="Bạn đã ôn hết rồi!"
				message="Hiện tại không có từ nào trong danh sách này cần ôn."
				onBack={() => router.push(topicId ? `/wordlist/${topicId}` : "/wordlist")}
			/>
		);
	}

	return (
		<>
		<ReviewShell
			title={sessionState?.phase === "mistakes" ? "Ôn từ đã sai" : "Trắc nghiệm"}
			description={sessionState?.phase === "mistakes" ? "Thử lại những từ bạn đã bỏ lỡ" : "Chọn nghĩa tiếng Việt đúng của từ"}
			icon={<Brain size={21} />}
			practiceMode={practiceMode}
			current={sessionState?.current ?? 1}
			total={sessionState?.total ?? questions.length}
			onBack={() => router.push(topicId ? `/wordlist/${topicId}` : "/wordlist")}
		>

			<form ref={formRef} onSubmit={handleSubmit}>
				<div className="relative overflow-hidden rounded-[28px] border border-blue-500/25 bg-gradient-to-br from-[#101c38] via-[#0b152b] to-[#070e1e] p-5 shadow-[0_28px_80px_-42px_rgba(37,99,235,0.65)] sm:p-8">
					<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.13),transparent_50%)]" />
						<div className="relative">
							{lastFeedback && (
								<p aria-live="polite" className={`mb-5 rounded-xl px-3 py-2 text-sm ${lastFeedback.type === "correct" ? "bg-emerald-500/10 text-emerald-300" : "bg-red-500/10 text-red-300"}`}>
									{lastFeedback.type === "correct" ? "Chính xác!" : <>Chưa đúng. Đáp án đúng: <strong>{lastFeedback.answer}</strong></>}
									{lastFeedback.example && <span className="mt-1 block text-slate-300">“{lastFeedback.example}”</span>}
								</p>
							)}
							<p className="text-center text-sm font-semibold text-blue-300">
								Từ tiếng Anh
							</p>
							<h2 className="mt-4 break-words text-center text-4xl font-bold tracking-tight sm:text-5xl">
								{currentQuestion.word.english}
							</h2>
							{currentQuestion.word.pronunciation && (
								<p className="mt-3 text-center font-mono text-sm text-blue-300 sm:text-base">
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
										reveal={waitingForContinue}
										onSelect={setSelectedChoice}
									/>
								))}
							</div>

							<button
								type="submit"
								disabled={!waitingForContinue && !selectedChoice}
								className="mt-6 w-full rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-6 py-4 text-lg font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
							>
								{waitingForContinue ? "Tiếp tục" : "Kiểm tra"}
							</button>
							<p className="mt-3 text-center text-xs text-slate-600">
								{waitingForContinue ? "Enter để tiếp tục" : "Phím 1–4 để chọn · Enter để kiểm tra"}
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
		"border-slate-700 bg-slate-950/45 text-slate-200 hover:border-blue-500/50 hover:bg-blue-500/5";

	if (reveal && isCorrect) {
		stateClass = "border-emerald-500 bg-emerald-500/15 text-emerald-100";
	} else if (reveal && isSelected) {
		stateClass = "border-red-500 bg-red-500/15 text-red-100";
	} else if (isSelected) {
		stateClass = "border-blue-400 bg-blue-500/15 text-white ring-2 ring-blue-500/15";
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
