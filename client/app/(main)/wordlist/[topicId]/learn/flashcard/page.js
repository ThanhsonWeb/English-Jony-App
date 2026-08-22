"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, RotateCcw } from "lucide-react";
import Loading from "@/app/_components/loading";
import { X } from "lucide-react";

function Page() {
	const { topicId } = useParams();
	const router = useRouter();
	const [practiceMode, setPracticeMode] = useState(false);
	const [loading, setLoading] = useState(true);
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
	// get all word of that topic
	useEffect(() => {
		async function fetchWords() {
			const res = await fetch(`/api/v1/vocab?topic=${topicId}`, {
				credentials: "include",
			});

			const data = await res.json();

			const now = new Date();

			const reviewWords = data.data.vocabularies.filter(
				(word) => new Date(word.nextReview) <= now,
			);

			setWords(reviewWords);
			setLoading(false);
		}

		fetchWords();
	}, [topicId]);

	function getReviewLabel(level) {
		const reviewCount = currentWord.reviewCount || 0;

		const hardIntervals = [1, 3, 7, 14];
		const mediumIntervals = [3, 7, 14, 30];
		const easyIntervals = [7, 14, 30, 60];

		if (level === 0) return "1 giờ";

		if (level === 1) {
			const days =
				hardIntervals[Math.min(reviewCount, hardIntervals.length - 1)];
			return `${days} ngày`;
		}

		if (level === 2) {
			const days =
				mediumIntervals[Math.min(reviewCount, mediumIntervals.length - 1)];
			return `${days} ngày`;
		}

		if (level === 3) {
			const days =
				easyIntervals[Math.min(reviewCount, easyIntervals.length - 1)];
			return `${days} ngày`;
		}
	}

	async function handleAnswer(level) {
		const word = words[currentIndex];

		const nextReview = new Date();
		const easyIntervals = [7, 14, 30, 60];
		const mediumIntervals = [3, 7, 14, 30];
		const hardIntervals = [1, 3, 7, 14];
		const reviewCount = word.reviewCount || 0;
		const getInterval = (intervals) =>
			intervals[Math.min(reviewCount, intervals.length - 1)];

		setResults((prev) => {
			if (level === 0) return { ...prev, forgot: prev.forgot + 1 };
			if (level === 1) return { ...prev, hard: prev.hard + 1 };
			if (level === 2) return { ...prev, medium: prev.medium + 1 };
			if (level === 3) return { ...prev, easy: prev.easy + 1 };

			return prev;
		});

		if (level === 0) {
			nextReview.setHours(nextReview.getHours() + 1);
		}

		if (level === 1) {
			nextReview.setDate(nextReview.getDate() + getInterval(hardIntervals));
		}

		if (level === 2) {
			nextReview.setDate(nextReview.getDate() + getInterval(mediumIntervals));
		}
		if (level === 3) {
			nextReview.setDate(nextReview.getDate() + getInterval(easyIntervals));
		}

		const newReviewCount = level === 0 ? 0 : (word.reviewCount || 0) + 1;

		if (!practiceMode) {
			await fetch(`/api/v1/vocab/${word._id}`, {
				method: "PATCH",
				credentials: "include",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					learningLevel: level,
					nextReview,
					reviewCount: newReviewCount,
				}),
			});
		}
		// just for safe
		if (!practiceMode) {
			setWords((prev) =>
				prev.map((item) =>
					item._id === word._id
						? {
								...item,
								learningLevel: level,
								nextReview,
								reviewCount: newReviewCount,
							}
						: item,
				),
			);
		}

		if (currentIndex === words.length - 1) {
			setSessionFinished(true);
			return;
		}

		setCurrentIndex((cur) => cur + 1);
		setShowAnswer(false);
	}
	if (loading) return <Loading />;
	if (sessionFinished) {
		const total = results.forgot + results.hard + results.medium + results.easy;

		return (
			<div className="min-h-screen bg-[#030616] flex items-center justify-center px-4 py-10 text-white">
				<div className="w-full max-w-2xl">
					{/* Main card */}
					<div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-[#0b1224] p-6 sm:p-10 shadow-2xl">
						{/* glow */}
						<div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.15),transparent_55%)] pointer-events-none" />

						<div className="relative z-10 text-center">
							<div className="text-5xl sm:text-6xl mb-5">🎉</div>

							<h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
								Hoàn thành buổi ôn!
							</h2>

							<p className="mt-3 text-sm sm:text-base text-slate-400">
								Bạn vừa ôn xong{" "}
								<span className="text-white font-semibold">{total} từ</span>.
								Tiếp tục duy trì nhé 🔥
							</p>

							{/* Stats */}
							<div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8">
								<div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
									<div className="text-2xl">😵</div>
									<p className="mt-2 text-xs text-red-300">Quên</p>
									<p className="text-2xl font-bold text-red-400">
										{results.forgot}
									</p>
								</div>

								<div className="rounded-2xl border border-orange-500/20 bg-orange-500/10 p-4">
									<div className="text-2xl">😓</div>
									<p className="mt-2 text-xs text-orange-300">Khó</p>
									<p className="text-2xl font-bold text-orange-400">
										{results.hard}
									</p>
								</div>

								<div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4">
									<div className="text-2xl">🙂</div>
									<p className="mt-2 text-xs text-blue-300">Khá nhớ</p>
									<p className="text-2xl font-bold text-blue-400">
										{results.medium}
									</p>
								</div>

								<div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
									<div className="text-2xl">✅</div>
									<p className="mt-2 text-xs text-emerald-300">Dễ</p>
									<p className="text-2xl font-bold text-emerald-400">
										{results.easy}
									</p>
								</div>
							</div>

							{/* Progress message */}
							<div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
								<p className="text-sm text-slate-300">
									🌱 Những từ khó sẽ quay lại sớm hơn. Những từ dễ sẽ được giãn
									thời gian ôn.
								</p>
							</div>

							<div className="mt-7 grid grid-cols-1 sm:grid-cols-2 gap-3">
								<button
									onClick={() => {
										setPracticeMode(true);
										setCurrentIndex(0);
										setSessionFinished(false);
										setShowAnswer(false);

										setResults({
											forgot: 0,
											hard: 0,
											medium: 0,
											easy: 0,
										});
									}}
									className="flex items-center justify-center gap-2 rounded-xl border border-blue-500/30 bg-blue-500/10 py-3.5 font-semibold text-blue-300 transition hover:bg-blue-500/20"
								>
									<RotateCcw size={18} />
									Ôn lại
								</button>

								<button
									onClick={() => router.push(`/wordlist/${topicId}`)}
									className="
			rounded-xl bg-blue-600 py-3.5
			font-semibold text-white
			transition hover:bg-blue-500
			active:scale-[0.98]
		"
								>
									Về danh sách từ →
								</button>
							</div>
						</div>
					</div>
				</div>
			</div>
		);
	}

	if (!currentWord) {
		return (
			<div className="min-h-screen bg-[#030616] px-4 py-10 text-white flex items-center justify-center">
				<div className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-slate-800 bg-[#0b1224] p-8 sm:p-10 text-center shadow-2xl">
					{/* Glow */}
					<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.16),transparent_55%)]" />

					<div className="relative z-10">
						{/* Icon */}
						<div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-4xl">
							🎉
						</div>

						<h2 className="mt-6 text-2xl sm:text-3xl font-bold tracking-tight">
							Bạn đã ôn hết rồi!
						</h2>

						<p className="mx-auto mt-3 max-w-md text-sm sm:text-base leading-relaxed text-slate-400">
							Hiện tại không còn từ nào cần ôn. Hãy quay lại khi đến lượt ôn
							tiếp theo nhé.
						</p>

						{/* Status */}
						<div className="mt-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-4">
							<p className="text-sm text-emerald-300">
								✅ Không có từ nào đang chờ ôn
							</p>
						</div>

						{/* Button */}
						<button
							onClick={() => router.push(`/wordlist/${topicId}`)}
							className="mt-7 w-full rounded-xl bg-blue-600 py-3.5 font-semibold text-white transition hover:bg-blue-500 active:scale-[0.98]"
						>
							Về danh sách từ →
						</button>
					</div>
				</div>
			</div>
		);
	}
	return (
		<div className="min-h-screen bg-[#030616] px-4 py-5 text-white sm:py-7">
			<div className="mx-auto max-w-3xl">
				{/* ================= TOP BAR ================= */}
				<div className="mb-5 flex items-center gap-3 sm:gap-4">
					<button
						onClick={() => router.back()}
						className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-800 hover:text-white"
					>
						<X size={24} />
					</button>

					{/* Progress */}
					<div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-800">
						<div
							className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-400 transition-all duration-500 ease-out"
							style={{
								width: `${((currentIndex + 1) / words.length) * 100}%`,
							}}
						/>
					</div>

					<p className="shrink-0 text-sm font-medium text-slate-400">
						{currentIndex + 1}/{words.length}
					</p>
				</div>

				{/* ================= SMALL HEADER ================= */}
				<div className="mb-3 flex items-center justify-between">
					<div>
						<h1 className="text-lg font-semibold sm:text-xl">Ôn từ vựng</h1>

						<p className="mt-0.5 text-xs text-slate-500">
							Nhớ lại nghĩa trước khi lật thẻ
						</p>
					</div>

					{practiceMode && (
						<span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-300">
							Ôn lại
						</span>
					)}
				</div>

				{/* ================= FLASHCARD ================= */}
				<div className="group relative">
					{/* Glow */}
					<div className="absolute -inset-1 rounded-[28px] bg-blue-500/10 opacity-0 blur-xl transition duration-500 group-hover:opacity-100" />

					<div
						onClick={() => setShowAnswer((cur) => !cur)}
						className="
						relative
						flex min-h-[240px] sm:min-h-[285px]
						cursor-pointer select-none
						overflow-hidden
						rounded-3xl
						border border-slate-800
						bg-gradient-to-br from-[#101a31] via-[#0d1427] to-[#080f20]
						px-5 py-6 sm:px-8 sm:py-8
						text-center
						shadow-[0_20px_60px_-30px_rgba(0,0,0,0.9)]
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
									<span className="mb-4 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-[11px] font-medium text-blue-300 sm:text-xs">
										Nhấn để xem nghĩa
									</span>

									<h2 className="max-w-full break-words text-4xl font-bold tracking-tight text-white sm:text-5xl">
										{currentWord.english}
									</h2>

									{currentWord.pronunciation && (
										<p className="mt-3 break-words font-mono text-sm text-blue-300 sm:text-base">
											{currentWord.pronunciation}
										</p>
									)}
								</>
							) : (
								<>
									<span className="mb-4 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-300 sm:text-xs">
										Nghĩa tiếng Việt
									</span>

									<h2 className="max-w-full break-words text-3xl font-bold tracking-tight text-emerald-400 sm:text-4xl">
										{currentWord.vietnamese}
									</h2>

									{currentWord.example && (
										<div className="mt-5 max-w-xl rounded-xl border border-slate-800 bg-slate-950/30 px-4 py-3">
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

							<span className="mt-0.5 text-[10px] opacity-60 sm:text-xs">
								{getReviewLabel(0)}
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
							<span className="text-sm font-medium sm:text-base">😓 Khó</span>

							<span className="mt-0.5 text-[10px] opacity-60 sm:text-xs">
								{getReviewLabel(1)}
							</span>
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
								🙂 Khá nhớ
							</span>

							<span className="mt-0.5 text-[10px] opacity-60 sm:text-xs">
								{getReviewLabel(2)}
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
							<span className="text-sm font-medium sm:text-base">✅ Dễ</span>

							<span className="mt-0.5 text-[10px] opacity-60 sm:text-xs">
								{getReviewLabel(3)}
							</span>
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}

export default Page;
