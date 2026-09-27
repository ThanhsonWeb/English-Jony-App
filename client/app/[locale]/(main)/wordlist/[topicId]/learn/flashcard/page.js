"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { fetchVocabulary, selectReviewWords } from "@/app/_lib/vocabulary.mjs";
import { isReviewCompletionReady } from "@/app/_lib/reviewSaveController.mjs";
import { CheckCircle2, Layers3 } from "lucide-react";
import Loading from "@/app/_components/loading";
import { ReviewPendingCompletion, ReviewSaveNotice, useBackgroundReviewSave } from "@/app/_components/review/BackgroundReviewSave";
import {
	ReviewCompletion,
	ReviewShell,
	ReviewStatus,
} from "@/app/_components/review/ReviewLayout";

function Page() {
	const { topicId } = useParams();
	const searchParams = useSearchParams();
	const dueOnly = searchParams.get("reviewMode") === "due";
	const router = useRouter();
	const [practiceMode, setPracticeMode] = useState(false);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [words, setWords] = useState([]);
	const [currentIndex, setCurrentIndex] = useState(0);
	const [showAnswer, setShowAnswer] = useState(false);
	const [sessionFinished, setSessionFinished] = useState(false);
	const [results, setResults] = useState({
		forgot: 0,
		hard: 0,
		medium: 0,
		easy: 0,
	});

	const currentWord = words[currentIndex];
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
				if (!controller.signal.aborted) setError("Không thể tải từ vựng. Vui lòng thử lại.");
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
		else setCurrentIndex(index => index + 1);
		setShowAnswer(false);
	}

	if (loading) return <Loading />;
	if (error) return <ReviewStatus title="Không thể mở bài ôn" message={error} onBack={() => router.push(topicId ? `/wordlist/${topicId}` : "/wordlist")} />;
	if (sessionFinished && !isReviewCompletionReady(sessionFinished, pending)) {
		return <ReviewPendingCompletion pending={pending} failed={failed} onBack={() => router.push(topicId ? `/wordlist/${topicId}` : "/wordlist")} />;
	}
	if (sessionFinished) {
		const total = results.forgot + results.hard + results.medium + results.easy;

		return <>
			<ReviewCompletion
				message={`Bạn vừa ôn xong ${total} từ trong chế độ Flashcard.`}
				stats={[
					{ label: "Quên rồi", value: results.forgot, tone: "red" },
					{ label: "Còn mơ hồ", value: results.hard, tone: "orange" },
					{ label: "Nhớ được", value: results.medium, tone: "blue" },
					{ label: "Rất chắc", value: results.easy, tone: "emerald" },
				]}
				note="🌱 Từ khó sẽ quay lại sớm hơn, còn từ bạn nhớ tốt sẽ được giãn thời gian ôn."
				onRestart={() => {
					resetAnswers();
					setPracticeMode(true);
					setCurrentIndex(0);
					setSessionFinished(false);
					setShowAnswer(false);
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
				title="Bạn đã ôn hết rồi!"
				message="Hiện tại không còn từ nào cần ôn. Hãy quay lại khi đến lượt ôn tiếp theo nhé."
				onBack={() => router.push(topicId ? `/wordlist/${topicId}` : "/wordlist")}
			/>
		);
	}
	return (
		<>
		<ReviewShell
			title="Flashcard"
			description="Nhớ lại nghĩa trước khi lật thẻ"
			icon={<Layers3 size={21} />}
			practiceMode={practiceMode}
			current={currentIndex + 1}
			total={words.length}
			onBack={() => router.back()}
		>

				{/* ================= FLASHCARD ================= */}
				<div className="group relative">
					{/* Glow */}
					<div className="absolute -inset-1 rounded-[28px] bg-blue-500/10 opacity-0 blur-xl transition duration-500 group-hover:opacity-100" />

					<div
						onClick={() => setShowAnswer((cur) => !cur)}
						className="
						relative
						flex min-h-[300px] sm:min-h-[360px]
						cursor-pointer select-none
						overflow-hidden
						rounded-[28px]
						border border-blue-500/30
						bg-gradient-to-br from-[#101c38] via-[#0b152b] to-[#070e1e]
						px-5 py-8 sm:px-10 sm:py-10
						text-center
						shadow-[0_28px_80px_-42px_rgba(37,99,235,0.65)]
						transition-all duration-300
						hover:-translate-y-0.5
						hover:border-blue-500/40
					"
					>
						{/* Glow inside card */}
						<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.13),transparent_50%)]" />

						{/* Decoration */}
						<div className="absolute left-6 top-6 h-2 w-2 rounded-full bg-blue-400/40" />
						<div className="absolute right-8 top-8 h-1.5 w-1.5 rounded-full bg-cyan-400/30" />

						{/* Content */}
						<div
							key={`${currentIndex}-${showAnswer}`}
							className="relative z-10 flex w-full flex-col items-center justify-center animate-[fadeIn_.3s_ease-out]"
						>
							{!showAnswer ? (
								<>
									<h2 className="max-w-full break-words text-5xl font-bold tracking-tight text-white sm:text-6xl">
										{currentWord.english}
									</h2>

									{currentWord.pronunciation && (
										<p className="mt-3 break-words font-mono text-sm text-blue-300 sm:text-base">
										{currentWord.pronunciation}
									</p>
								)}

									<div className="mt-8 flex items-center gap-3 text-sm text-slate-400">
										<span className="h-px w-12 bg-slate-700" />
										<span className="text-blue-400">◉</span>
										<span>Nhấn để xem đáp án</span>
										<span className="h-px w-12 bg-slate-700" />
									</div>
								</>
							) : (
								<>
									<p className="mb-3 text-sm font-medium text-blue-300">
										{currentWord.english}
									</p>

									<h2 className="max-w-full break-words text-4xl font-bold tracking-tight text-white sm:text-5xl">
										{currentWord.vietnamese}
									</h2>

									{currentWord.pronunciation && (
										<p className="mt-3 font-mono text-sm text-blue-300 sm:text-base">
											{currentWord.pronunciation}
										</p>
									)}

									{currentWord.example && (
										<div className="mt-6 max-w-xl border-t border-slate-700/70 px-4 pt-5">
											<p className="break-words text-sm italic leading-relaxed text-slate-300">
												“{currentWord.example}”
											</p>
										</div>
									)}
								</>
							)}
						</div>
					</div>
				</div>

				{/* ================= ANSWER SECTION ================= */}
				<div className="mt-4">
					<div className="mb-2 flex items-center justify-between">
						<p className="text-sm font-medium text-slate-400">
							Bạn nhớ từ này thế nào?
						</p>

						<p className="hidden text-xs text-slate-600 sm:block">
							Chọn mức độ
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
								😵 Quên rồi
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
							<span className="text-sm font-medium sm:text-base">😓 Còn mơ hồ</span>

						</button>

						{/* Medium */}
						<button
							onClick={() => handleAnswer(2)}
							className="
							flex min-w-0 flex-col items-center justify-center
							rounded-xl border border-blue-500/20
							bg-blue-500/5
							px-2 py-3
							text-blue-400
							transition-all duration-200
							hover:-translate-y-0.5
							hover:border-blue-500/40
							hover:bg-blue-500/10
							active:scale-[0.97]
						"
						>
							<span className="text-sm font-medium sm:text-base">
								🙂 Nhớ được
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
							<span className="text-sm font-medium sm:text-base">✅ Rất chắc</span>

						</button>
					</div>
				</div>
		</ReviewShell>
		<ReviewSaveNotice pending={pending} failed={failed} />
		</>
	);
}

export default Page;
