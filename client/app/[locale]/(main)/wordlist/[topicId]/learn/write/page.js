"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
	ArrowLeft,
	CheckCircle2,
	PenLine,
	RotateCcw,
	XCircle,
} from "lucide-react";

import Loading from "@/app/_components/loading";

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
			<main className="flex min-h-[calc(100vh-80px)] items-center justify-center bg-[#030616] px-4 text-white">
				<div className="w-full max-w-lg rounded-3xl border border-red-500/20 bg-[#0b1224] p-8 text-center shadow-2xl">
					<XCircle className="mx-auto h-12 w-12 text-red-400" />
					<h1 className="mt-5 text-2xl font-bold">Không thể mở bài ôn</h1>
					<p className="mt-3 text-slate-400">{error}</p>
					<button
						type="button"
						onClick={() => router.push(`/wordlist/${topicId}`)}
						className="mt-7 w-full rounded-xl bg-blue-600 px-5 py-3 font-semibold transition hover:bg-blue-500"
					>
						Quay lại danh sách từ
					</button>
				</div>
			</main>
		);
	}

	if (sessionFinished) {
		const total = results.correct + results.wrong;
		const accuracy = total > 0 ? Math.round((results.correct / total) * 100) : 0;

		return (
			<main className="flex min-h-[calc(100vh-80px)] items-center justify-center bg-[#030616] px-4 py-10 text-white">
				<div className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-800 bg-[#0b1224] p-6 shadow-2xl sm:p-10">
					<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.16),transparent_55%)]" />
					<div className="relative text-center">
						<div className="text-5xl">🎉</div>
						<h1 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">
							Hoàn thành buổi ôn!
						</h1>
						<p className="mt-3 text-slate-400">
							Bạn đã hoàn thành {total} từ trong chế độ Viết từ.
						</p>

						<div className="mt-8 grid grid-cols-3 gap-3">
							<ResultStat label="Đúng" value={results.correct} color="emerald" />
							<ResultStat label="Sai" value={results.wrong} color="red" />
							<ResultStat label="Chính xác" value={`${accuracy}%`} color="blue" />
						</div>

						<div className="mt-8 grid gap-3 sm:grid-cols-2">
							<button
								type="button"
								onClick={restartReview}
								className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-500/30 bg-blue-500/10 px-5 py-3.5 font-semibold text-blue-300 transition hover:bg-blue-500/20"
							>
								<RotateCcw size={18} />
								Học lại
							</button>
							<button
								type="button"
								onClick={() => router.push(`/wordlist/${topicId}`)}
								className="rounded-xl bg-blue-600 px-5 py-3.5 font-semibold transition hover:bg-blue-500 active:scale-[0.98]"
							>
								Quay lại danh sách từ
							</button>
						</div>
					</div>
				</div>
			</main>
		);
	}

	if (!currentWord) {
		return (
			<main className="flex min-h-[calc(100vh-80px)] items-center justify-center bg-[#030616] px-4 text-white">
				<div className="w-full max-w-lg rounded-3xl border border-slate-800 bg-[#0b1224] p-8 text-center shadow-2xl">
					<CheckCircle2 className="mx-auto h-14 w-14 text-emerald-400" />
					<h1 className="mt-5 text-2xl font-bold">Bạn đã ôn hết rồi!</h1>
					<p className="mt-3 leading-relaxed text-slate-400">
						Hiện tại không có từ nào trong danh sách này cần ôn.
					</p>
					<button
						type="button"
						onClick={() => router.push(`/wordlist/${topicId}`)}
						className="mt-7 w-full rounded-xl bg-blue-600 px-5 py-3 font-semibold transition hover:bg-blue-500"
					>
						Quay lại danh sách từ
					</button>
				</div>
			</main>
		);
	}

	const progress = ((currentIndex + 1) / words.length) * 100;
	const inputStateClass =
		result === "correct"
			? "border-emerald-500/60 bg-emerald-500/5 focus:border-emerald-400"
			: result === "wrong"
				? "border-red-500/60 bg-red-500/5 focus:border-red-400"
				: "border-slate-700 bg-slate-950/60 focus:border-blue-500 focus:ring-blue-500/15";

	return (
		<main className="min-h-[calc(100vh-80px)] bg-[#030616] px-4 py-6 text-white sm:px-6 sm:py-8">
			<div className="mx-auto w-full max-w-3xl">
				<div className="mb-6 flex items-center gap-3 sm:gap-4">
					<button
						type="button"
						onClick={() => router.push(`/wordlist/${topicId}`)}
						aria-label="Quay lại danh sách từ"
						className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-800 hover:text-white"
					>
						<ArrowLeft size={21} />
					</button>

					<div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-800">
						<div
							className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-400 transition-all duration-500"
							style={{ width: `${progress}%` }}
						/>
					</div>

					<p className="shrink-0 text-sm font-semibold text-slate-400">
						{currentIndex + 1} / {words.length}
					</p>
				</div>

				<div className="mb-4 flex items-center justify-between">
					<div>
						<h1 className="inline-flex items-center gap-2 text-xl font-bold sm:text-2xl">
							<PenLine className="h-5 w-5 text-purple-400" /> Viết từ
						</h1>
						<p className="mt-1 text-sm text-slate-500">
							Nhập từ tiếng Anh phù hợp với nghĩa bên dưới.
						</p>
					</div>
					{practiceMode && (
						<span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-300">
							Học lại
						</span>
					)}
				</div>

				<form onSubmit={handleSubmit}>
					<div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-[#101a31] via-[#0d1427] to-[#080f20] p-6 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.9)] sm:p-10">
						<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(139,92,246,0.13),transparent_52%)]" />
						<div className="relative">
							<p className="text-center text-xs font-semibold uppercase tracking-[0.18em] text-purple-300">
								Nghĩa tiếng Việt
							</p>
							<h2 className="mx-auto mt-5 max-w-2xl break-words text-center text-3xl font-bold leading-tight tracking-tight sm:text-5xl">
								{currentWord.vietnamese}
							</h2>

							<label htmlFor="write-answer" className="mt-9 block text-sm font-medium text-slate-300">
								Từ tiếng Anh
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
								className="mt-6 w-full rounded-xl bg-blue-600 px-6 py-4 text-lg font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-500 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
							>
								{isSaving ? "Đang lưu..." : result ? "Tiếp tục" : "Kiểm tra"}
							</button>
						</div>
					</div>
				</form>
			</div>
		</main>
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

function ResultStat({ label, value, color }) {
	const colors = {
		emerald: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
		red: "border-red-500/20 bg-red-500/10 text-red-400",
		blue: "border-blue-500/20 bg-blue-500/10 text-blue-400",
	};

	return (
		<div className={`rounded-2xl border p-3 sm:p-4 ${colors[color]}`}>
			<p className="text-xs font-medium opacity-80">{label}</p>
			<p className="mt-1 text-2xl font-bold sm:text-3xl">{value}</p>
		</div>
	);
}
