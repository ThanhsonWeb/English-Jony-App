"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
	CheckCircle2,
	PenLine,
	XCircle,
} from "lucide-react";

import Loading from "@/app/_components/loading";
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
	const router = useRouter();
	const inputRef = useRef(null);
	const [words, setWords] = useState([]);
	const [currentIndex, setCurrentIndex] = useState(0);
	const [answer, setAnswer] = useState("");
	const [result, setResult] = useState(null);
	const [results, setResults] = useState({ correct: 0, wrong: 0 });
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [progressError, setProgressError] = useState("");
	const [isSaving, setIsSaving] = useState(false);
	const [sessionFinished, setSessionFinished] = useState(false);
	const [practiceMode, setPracticeMode] = useState(false);

	const currentWord = words[currentIndex];

	useEffect(() => {
		let cancelled = false;

		async function fetchWords() {
			try {
				const response = await fetch(`/api/v1/vocab?topic=${topicId}`, {
					credentials: "include",
				});

				if (!response.ok) throw new Error("Không thể tải danh sách từ.");

				const data = await response.json();
				const now = new Date();
				const reviewWords = (data.data?.vocabularies || []).filter(
					(word) => word.nextReview && new Date(word.nextReview) <= now,
				);

				if (!cancelled) setWords(reviewWords);
			} catch (fetchError) {
				if (!cancelled) {
					setError(fetchError.message || "Không thể tải danh sách từ.");
				}
			} finally {
				if (!cancelled) setLoading(false);
			}
		}

		fetchWords();

		return () => {
			cancelled = true;
		};
	}, [topicId]);

	useEffect(() => {
		if (!loading && !sessionFinished && !result) {
			inputRef.current?.focus();
		}
	}, [currentIndex, loading, result, sessionFinished]);

	async function saveReviewProgress(word, isCorrect) {
		if (practiceMode) return;

		const nextReview = new Date();
		const reviewCount = word.reviewCount || 0;
		let learningLevel = 0;
		let newReviewCount = 0;

		if (isCorrect) {
			const mediumIntervals = [3, 7, 14, 30];
			const days =
				mediumIntervals[Math.min(reviewCount, mediumIntervals.length - 1)];
			nextReview.setDate(nextReview.getDate() + days);
			learningLevel = 2;
			newReviewCount = reviewCount + 1;
		} else {
			nextReview.setHours(nextReview.getHours() + 1);
		}

		const response = await fetch(`/api/v1/vocab/${word._id}`, {
			method: "PATCH",
			credentials: "include",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				learningLevel,
				nextReview,
				reviewCount: newReviewCount,
			}),
		});

		if (!response.ok) throw new Error("Không thể lưu tiến độ ôn tập.");

		await fetch("/api/v1/study-activities", {
			method: "POST",
			credentials: "include",
		});
	}

	async function checkAnswer() {
		if (!currentWord || !answer.trim() || result || isSaving) return;

		const isCorrect =
			normalizeAnswer(answer) === normalizeAnswer(currentWord.english);

		setResult(isCorrect ? "correct" : "wrong");
		setResults((previous) => ({
			...previous,
			[isCorrect ? "correct" : "wrong"]:
				previous[isCorrect ? "correct" : "wrong"] + 1,
		}));
		setProgressError("");

		if (practiceMode) return;

		setIsSaving(true);
		try {
			await saveReviewProgress(currentWord, isCorrect);
		} catch (saveError) {
			setProgressError(saveError.message || "Không thể lưu tiến độ ôn tập.");
		} finally {
			setIsSaving(false);
		}
	}

	function continueReview() {
		if (!result || isSaving) return;

		if (currentIndex === words.length - 1) {
			setSessionFinished(true);
			return;
		}

		setCurrentIndex((index) => index + 1);
		setAnswer("");
		setResult(null);
		setProgressError("");
	}

	function handleSubmit(event) {
		event.preventDefault();
		if (result) continueReview();
		else checkAnswer();
	}

	function restartReview() {
		setPracticeMode(true);
		setCurrentIndex(0);
		setAnswer("");
		setResult(null);
		setResults({ correct: 0, wrong: 0 });
		setProgressError("");
		setSessionFinished(false);
	}

	if (loading) return <Loading />;

	if (error) {
		return (
			<ReviewStatus
				icon={<XCircle className="h-12 w-12 text-red-400" />}
				title="Không thể mở bài ôn"
				message={error}
				onBack={() => router.push(`/wordlist/${topicId}`)}
			/>
		);
	}

	if (sessionFinished) {
		const total = results.correct + results.wrong;
		const accuracy = total > 0 ? Math.round((results.correct / total) * 100) : 0;

		return (
			<ReviewCompletion
				message={`Bạn đã hoàn thành ${total} từ trong chế độ Viết từ.`}
				stats={[
					{ label: "Đúng", value: results.correct, tone: "emerald" },
					{ label: "Sai", value: results.wrong, tone: "red" },
					{ label: "Chính xác", value: `${accuracy}%`, tone: "blue" },
				]}
				onRestart={restartReview}
				onBack={() => router.push(`/wordlist/${topicId}`)}
			/>
		);
	}

	if (!currentWord) {
		return (
			<ReviewStatus
				icon={<CheckCircle2 className="h-14 w-14 text-emerald-400" />}
				title="Bạn đã ôn hết rồi!"
				message="Hiện tại không có từ nào trong danh sách này cần ôn."
				onBack={() => router.push(`/wordlist/${topicId}`)}
			/>
		);
	}

	const inputStateClass =
		result === "correct"
			? "border-emerald-500/60 bg-emerald-500/5 focus:border-emerald-400"
			: result === "wrong"
				? "border-red-500/60 bg-red-500/5 focus:border-red-400"
				: "border-slate-700 bg-slate-950/60 focus:border-blue-500 focus:ring-blue-500/15";

	return (
		<ReviewShell
			title="Viết từ"
			description="Gõ từ tiếng Anh phù hợp với nghĩa bên dưới"
			icon={<PenLine size={21} />}
			practiceMode={practiceMode}
			current={currentIndex + 1}
			total={words.length}
			onBack={() => router.push(`/wordlist/${topicId}`)}
		>

			<form onSubmit={handleSubmit}>
				<div className="relative overflow-hidden rounded-[28px] border border-blue-500/25 bg-gradient-to-br from-[#101c38] via-[#0b152b] to-[#070e1e] p-6 shadow-[0_28px_80px_-42px_rgba(37,99,235,0.65)] sm:p-10">
					<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.13),transparent_52%)]" />
						<div className="relative">
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
								onChange={(event) => {
									if (!result) setAnswer(event.target.value);
								}}
								disabled={Boolean(result)}
								autoComplete="off"
								spellCheck="false"
								placeholder="Nhập từ tiếng Anh..."
								className={`mt-2 w-full rounded-2xl border px-5 py-4 text-xl font-semibold text-white outline-none transition placeholder:font-normal placeholder:text-slate-600 focus:ring-4 disabled:cursor-default sm:px-6 sm:py-5 sm:text-2xl ${inputStateClass}`}
							/>

							{result && <AnswerFeedback result={result} word={currentWord} />}

							{progressError && (
								<p className="mt-3 text-sm text-amber-300">⚠️ {progressError}</p>
							)}

							<button
								type="submit"
								disabled={(!result && !answer.trim()) || isSaving}
								className="mt-6 w-full rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-6 py-4 text-lg font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
							>
								{isSaving ? "Đang lưu..." : result ? "Tiếp tục" : "Kiểm tra"}
							</button>
						</div>
				</div>
			</form>
		</ReviewShell>
	);
}

function AnswerFeedback({ result, word }) {
	const isCorrect = result === "correct";

	return (
		<div
			className={`mt-5 rounded-2xl border p-5 ${
				isCorrect
					? "border-emerald-500/25 bg-emerald-500/10"
					: "border-red-500/25 bg-red-500/10"
			}`}
		>
			<div className="flex items-start gap-3">
				{isCorrect ? (
					<CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-400" />
				) : (
					<XCircle className="mt-0.5 h-6 w-6 shrink-0 text-red-400" />
				)}
				<div>
					<p className={`font-semibold ${isCorrect ? "text-emerald-300" : "text-red-300"}`}>
						{isCorrect ? "Chính xác!" : "Chưa chính xác."}
					</p>
					<p className="mt-1 text-slate-200">
						Đáp án đúng: <strong className="text-white">{word.english}</strong>
					</p>
					{word.pronunciation && (
						<p className="mt-1 font-mono text-sm text-blue-300">{word.pronunciation}</p>
					)}
				</div>
			</div>

			{word.example && (
				<p className="mt-4 border-t border-white/10 pt-4 text-sm italic leading-relaxed text-slate-300">
					“{word.example}”
				</p>
			)}
		</div>
	);
}
