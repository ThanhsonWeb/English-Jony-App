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
	const { topicId } = useParams();
	const searchParams = useSearchParams();
	const dueOnly = searchParams.get("reviewMode") === "due";
	const router = useRouter();
	const inputRef = useRef(null);
	const sessionRef = useRef(null);
	const [words, setWords] = useState([]);
	const [sessionState, setSessionState] = useState(null);
	const [answer, setAnswer] = useState("");
	const [lastFeedback, setLastFeedback] = useState(null);
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
					setSessionState(sessionRef.current.getSnapshot());
					setWords(reviewWords);
				}
			} catch (fetchError) {
				if (!cancelled) {
					setError(fetchError.message === "unauthorized" ? "Vui lòng đăng nhập để ôn tập." : "Không thể tải danh sách từ. Vui lòng thử lại.");
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
		setSessionState(step.state);

		if (step.firstAttempt) {
			setResults((previous) => ({
				...previous,
				[isCorrect ? "correct" : "wrong"]:
					previous[isCorrect ? "correct" : "wrong"] + 1,
			}));
		}
		if (!isCorrect) {
			setLastFeedback({ ...step.feedback, example: currentWord.example, pronunciation: currentWord.pronunciation });
			return;
		}
		setLastFeedback({ ...step.feedback, example: currentWord.example });
		setAnswer("");
		if (step.state.finished) setSessionFinished(true);
	}

	function continueAfterWrong() {
		const nextSession = sessionRef.current?.continueAfterWrong();
		if (!nextSession?.accepted) return;
		setSessionState(nextSession.state);
		setAnswer("");
		setLastFeedback(null);
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
		setSessionState(sessionRef.current.getSnapshot());
		setPracticeMode(true);
		setAnswer("");
		setLastFeedback(null);
		setResults({ correct: 0, wrong: 0 });
		setSessionFinished(false);
	}

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

	if (sessionFinished && !isReviewCompletionReady(sessionFinished, pending)) {
		return <ReviewPendingCompletion pending={pending} failed={failed} onBack={() => router.push(topicId ? `/wordlist/${topicId}` : "/wordlist")} />;
	}

	if (sessionFinished) {
		const total = results.correct + results.wrong;
		const accuracy = total > 0 ? Math.round((results.correct / total) * 100) : 0;

		return <>
			<ReviewCompletion
				message={`Bạn đã hoàn thành ${total} từ trong chế độ Viết từ.`}
				stats={[
					{ label: "Đúng", value: results.correct, tone: "emerald" },
					{ label: "Sai", value: results.wrong, tone: "red" },
					{ label: "Chính xác", value: `${accuracy}%`, tone: "blue" },
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
				title="Bạn đã ôn hết rồi!"
				message="Hiện tại không có từ nào trong danh sách này cần ôn."
				onBack={() => router.push(topicId ? `/wordlist/${topicId}` : "/wordlist")}
			/>
		);
	}

	return (
		<>
		<ReviewShell
			title={sessionState?.phase === "mistakes" ? "Ôn từ đã sai" : "Viết từ"}
			description={sessionState?.phase === "mistakes" ? "Thử lại những từ bạn đã bỏ lỡ" : "Gõ từ tiếng Anh phù hợp với nghĩa bên dưới"}
			icon={<PenLine size={21} />}
			practiceMode={practiceMode}
			current={sessionState?.current ?? 1}
			total={sessionState?.total ?? words.length}
			onBack={() => router.push(topicId ? `/wordlist/${topicId}` : "/wordlist")}
		>

			<form onSubmit={handleSubmit}>
				<div className="relative overflow-hidden rounded-[28px] border border-blue-500/25 bg-gradient-to-br from-[#101c38] via-[#0b152b] to-[#070e1e] p-6 shadow-[0_28px_80px_-42px_rgba(37,99,235,0.65)] sm:p-10">
					<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.13),transparent_52%)]" />
						<div className="relative">
							{lastFeedback && (
								<p aria-live="polite" className={`mb-5 rounded-xl px-3 py-2 text-sm ${lastFeedback.type === "correct" ? "bg-emerald-500/10 text-emerald-300" : "bg-red-500/10 text-red-300"}`}>
									{lastFeedback.type === "correct" ? "Chính xác!" : <>Chưa đúng. Đáp án đúng: <strong>{lastFeedback.answer}</strong></>}
									{lastFeedback.type === "wrong" && lastFeedback.pronunciation && <span className="mt-1 block font-mono text-slate-300">{lastFeedback.pronunciation}</span>}
									{lastFeedback.example && <span className="mt-1 block text-slate-300">“{lastFeedback.example}”</span>}
								</p>
							)}
							<p className="text-sm font-semibold text-blue-300">
								Nghĩa tiếng Việt
							</p>
							<h2 className="mt-4 max-w-2xl break-words text-4xl font-bold leading-tight tracking-tight sm:text-6xl">
								{currentWord.vietnamese}
							</h2>

							<label htmlFor="write-answer" className="mt-9 block text-sm font-medium text-slate-400">
								Nhập từ tiếng Anh tương ứng
							</label>
							<input
								ref={inputRef}
								id="write-answer"
								type="text"
								value={answer}
								onChange={(event) => setAnswer(event.target.value)}
								disabled={waitingForContinue}
								autoComplete="off"
								spellCheck="false"
								placeholder="Nhập từ tiếng Anh..."
								className={`mt-2 w-full rounded-2xl border bg-slate-950/60 px-5 py-4 text-xl font-semibold text-white outline-none transition placeholder:font-normal placeholder:text-slate-600 focus:ring-4 sm:px-6 sm:py-5 sm:text-2xl ${waitingForContinue ? "border-red-500/60" : "border-slate-700 focus:border-blue-500 focus:ring-blue-500/15"}`}
							/>

							<button
								type="submit"
								disabled={!waitingForContinue && !answer.trim()}
								className="mt-6 w-full rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-6 py-4 text-lg font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
							>
								{waitingForContinue ? "Tiếp tục" : "Kiểm tra"}
							</button>
						</div>
				</div>
			</form>
		</ReviewShell>
		<ReviewSaveNotice pending={pending} failed={failed} />
		</>
	);
}
