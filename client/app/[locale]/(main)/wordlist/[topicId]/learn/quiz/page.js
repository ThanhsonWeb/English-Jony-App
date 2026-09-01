"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
	ArrowLeft,
	Brain,
	CheckCircle2,
	RotateCcw,
	XCircle,
} from "lucide-react";

import Loading from "@/app/_components/loading";

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

	return shuffle(reviewWords).map((word) => {
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
	const router = useRouter();
	const reviewWordsRef = useRef([]);
	const vocabularyPoolRef = useRef([]);
	const hasSubmittedRef = useRef(false);
	const formRef = useRef(null);
	const [questions, setQuestions] = useState([]);
	const [currentIndex, setCurrentIndex] = useState(0);
	const [selectedChoice, setSelectedChoice] = useState("");
	const [result, setResult] = useState(null);
	const [results, setResults] = useState({ correct: 0, wrong: 0 });
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [progressError, setProgressError] = useState("");
	const [isSaving, setIsSaving] = useState(false);
	const [sessionFinished, setSessionFinished] = useState(false);
	const [practiceMode, setPracticeMode] = useState(false);
	const [notEnoughChoices, setNotEnoughChoices] = useState(false);

	const currentQuestion = questions[currentIndex];

	useEffect(() => {
		let cancelled = false;

		async function fetchVocabulary() {
			try {
				const topicResponse = await fetch(`/api/v1/vocab?topic=${topicId}`, {
					credentials: "include",
				});

				if (!topicResponse.ok) throw new Error("Không thể tải danh sách từ.");

				const topicData = await topicResponse.json();
				const topicWords = (topicData.data?.vocabularies || []).filter(
					(word) => word.english?.trim() && word.vietnamese?.trim(),
				);
				const now = new Date();
				const reviewWords = topicWords.filter(
					(word) => word.nextReview && new Date(word.nextReview) <= now,
				);
				let vocabularyPool = topicWords;

				if (reviewWords.length > 0 && getUniqueTranslations(topicWords).length < 4) {
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
					setQuestions(buildQuestions(reviewWords, vocabularyPool));
				}
			} catch (fetchError) {
				if (!cancelled) {
					setError(fetchError.message || "Không thể tải danh sách từ.");
				}
			} finally {
				if (!cancelled) setLoading(false);
			}
		}

		fetchVocabulary();

		return () => {
			cancelled = true;
		};
	}, [topicId]);

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
		if (
			!currentQuestion ||
			!selectedChoice ||
			result ||
			isSaving ||
			hasSubmittedRef.current
		) {
			return;
		}

		hasSubmittedRef.current = true;
		const isCorrect =
			normalizeText(selectedChoice) ===
			normalizeText(currentQuestion.correctAnswer);

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
			await saveReviewProgress(currentQuestion.word, isCorrect);
		} catch (saveError) {
			setProgressError(saveError.message || "Không thể lưu tiến độ ôn tập.");
		} finally {
			setIsSaving(false);
		}
	}

	function continueQuiz() {
		if (!result || isSaving) return;

		if (currentIndex === questions.length - 1) {
			setSessionFinished(true);
			return;
		}

		hasSubmittedRef.current = false;
		setCurrentIndex((index) => index + 1);
		setSelectedChoice("");
		setResult(null);
		setProgressError("");
	}

	function handleSubmit(event) {
		event.preventDefault();
		if (result) continueQuiz();
		else checkAnswer();
	}

	function restartQuiz() {
		const nextQuestions = buildQuestions(
			reviewWordsRef.current,
			vocabularyPoolRef.current,
		);

		hasSubmittedRef.current = false;
		setQuestions(nextQuestions);
		setCurrentIndex(0);
		setSelectedChoice("");
		setResult(null);
		setResults({ correct: 0, wrong: 0 });
		setProgressError("");
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

			if (!currentQuestion || isSaving) return;

			if (["1", "2", "3", "4"].includes(event.key) && !result) {
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
	}, [currentQuestion, isSaving, result]);

	if (loading) return <Loading />;

	if (error) {
		return (
			<StatusScreen
				icon={<XCircle className="h-12 w-12 text-red-400" />}
				title="Không thể mở bài ôn"
				message={error}
				onBack={() => router.push(`/wordlist/${topicId}`)}
			/>
		);
	}

	if (notEnoughChoices) {
		return (
			<StatusScreen
				icon={<Brain className="h-12 w-12 text-cyan-400" />}
				title="Chưa đủ từ để tạo câu hỏi"
				message="Bạn cần ít nhất 4 nghĩa tiếng Việt khác nhau trong sổ tay để dùng chế độ Trắc nghiệm."
				onBack={() => router.push(`/wordlist/${topicId}`)}
			/>
		);
	}

	if (sessionFinished) {
		const total = results.correct + results.wrong;
		const accuracy = total > 0 ? Math.round((results.correct / total) * 100) : 0;

		return (
			<main className="flex min-h-[calc(100vh-80px)] items-center justify-center bg-[#030616] px-4 py-10 text-white">
				<div className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-800 bg-[#0b1224] p-6 shadow-2xl sm:p-10">
					<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.15),transparent_55%)]" />
					<div className="relative text-center">
						<div className="text-5xl">🎉</div>
						<h1 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">
							Hoàn thành!
						</h1>

						<div className="mt-8 grid grid-cols-3 gap-3">
							<ResultStat label="Đúng" value={results.correct} color="emerald" />
							<ResultStat label="Sai" value={results.wrong} color="red" />
							<ResultStat label="Chính xác" value={`${accuracy}%`} color="blue" />
						</div>

						<div className="mt-8 grid gap-3 sm:grid-cols-2">
							<button
								type="button"
								onClick={restartQuiz}
								className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-5 py-3.5 font-semibold text-cyan-300 transition hover:bg-cyan-500/20"
							>
								<RotateCcw size={18} /> Học lại
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

	if (!currentQuestion) {
		return (
			<StatusScreen
				icon={<CheckCircle2 className="h-14 w-14 text-emerald-400" />}
				title="Bạn đã ôn hết rồi!"
				message="Hiện tại không có từ nào trong danh sách này cần ôn."
				onBack={() => router.push(`/wordlist/${topicId}`)}
			/>
		);
	}

	const progress = ((currentIndex + 1) / questions.length) * 100;

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
						{currentIndex + 1} / {questions.length}
					</p>
				</div>

				<div className="mb-4 flex items-center justify-between">
					<div>
						<h1 className="inline-flex items-center gap-2 text-xl font-bold sm:text-2xl">
							<Brain className="h-5 w-5 text-cyan-400" /> Trắc nghiệm
						</h1>
						<p className="mt-1 text-sm text-slate-500">
							Chọn nghĩa tiếng Việt đúng của từ.
						</p>
					</div>
					{practiceMode && (
						<span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-300">
							Học lại
						</span>
					)}
				</div>

				<form ref={formRef} onSubmit={handleSubmit}>
					<div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-[#101a31] via-[#0d1427] to-[#080f20] p-5 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.9)] sm:p-8">
						<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.12),transparent_50%)]" />
						<div className="relative">
							<p className="text-center text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">
								Chọn nghĩa đúng của từ
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
										result={result}
										onSelect={setSelectedChoice}
									/>
								))}
							</div>

							{result && (
								<QuizFeedback result={result} question={currentQuestion} />
							)}

							{progressError && (
								<p className="mt-3 text-sm text-amber-300">⚠️ {progressError}</p>
							)}

							<button
								type="submit"
								disabled={(!result && !selectedChoice) || isSaving}
								className="mt-6 w-full rounded-xl bg-blue-600 px-6 py-4 text-lg font-semibold shadow-lg shadow-blue-600/20 transition hover:bg-blue-500 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
							>
								{isSaving ? "Đang lưu..." : result ? "Tiếp tục" : "Kiểm tra"}
							</button>
							<p className="mt-3 text-center text-xs text-slate-600">
								Phím 1–4 để chọn · Enter để kiểm tra hoặc tiếp tục
							</p>
						</div>
					</div>
				</form>
			</div>
		</main>
	);
}

function ChoiceButton({
	choice,
	index,
	selectedChoice,
	correctAnswer,
	result,
	onSelect,
}) {
	const isSelected = normalizeText(choice) === normalizeText(selectedChoice);
	const isCorrect = normalizeText(choice) === normalizeText(correctAnswer);
	let stateClass =
		"border-slate-700 bg-slate-950/45 text-slate-200 hover:border-blue-500/50 hover:bg-blue-500/5";

	if (!result && isSelected) {
		stateClass = "border-blue-400 bg-blue-500/15 text-white ring-2 ring-blue-500/15";
	}
	if (result && isCorrect) {
		stateClass = "border-emerald-500 bg-emerald-500/15 text-emerald-100";
	}
	if (result === "wrong" && isSelected && !isCorrect) {
		stateClass = "border-red-500 bg-red-500/15 text-red-100";
	}

	return (
		<button
			type="button"
			onClick={() => onSelect(choice)}
			disabled={Boolean(result)}
			className={`flex min-h-16 items-center gap-3 rounded-2xl border px-4 py-4 text-left font-medium transition active:scale-[0.99] disabled:cursor-default ${stateClass}`}
		>
			<span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-current/20 bg-black/10 text-xs font-bold opacity-80">
				{index + 1}
			</span>
			<span className="break-words">{choice}</span>
		</button>
	);
}

function QuizFeedback({ result, question }) {
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
						{isCorrect ? "Chính xác! 🎉" : "Chưa đúng"}
					</p>
					{!isCorrect && (
						<p className="mt-1 text-slate-200">
							Đáp án đúng: <strong className="text-white">{question.correctAnswer}</strong>
						</p>
					)}
				</div>
			</div>

			{question.word.example && (
				<p className="mt-4 border-t border-white/10 pt-4 text-sm italic leading-relaxed text-slate-300">
					“{question.word.example}”
				</p>
			)}
		</div>
	);
}

function StatusScreen({ icon, title, message, onBack }) {
	return (
		<main className="flex min-h-[calc(100vh-80px)] items-center justify-center bg-[#030616] px-4 text-white">
			<div className="w-full max-w-lg rounded-3xl border border-slate-800 bg-[#0b1224] p-8 text-center shadow-2xl">
				<div className="flex justify-center">{icon}</div>
				<h1 className="mt-5 text-2xl font-bold">{title}</h1>
				<p className="mt-3 leading-relaxed text-slate-400">{message}</p>
				<button
					type="button"
					onClick={onBack}
					className="mt-7 w-full rounded-xl bg-blue-600 px-5 py-3 font-semibold transition hover:bg-blue-500"
				>
					Quay lại danh sách từ
				</button>
			</div>
		</main>
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
