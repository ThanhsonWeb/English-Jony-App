"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, RotateCcw } from "lucide-react";
import Loading from "@/app/_components/loading";

function Page() {
	const { topicId } = useParams();
	const router = useRouter();
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
		// just for safe
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

		if (currentIndex === words.length - 1) {
			setSessionFinished(true);
			return;
		}

		setCurrentIndex((cur) => cur + 1);
		setShowAnswer(false);
	}
	if (loading) return <Loading />;
	if (sessionFinished) {
		return (
			<div className="min-h-screen bg-[#030616] flex items-center justify-center px-4 text-white">
				<div className="w-full max-w-xl rounded-3xl border border-slate-800 bg-[#0d1427] p-8 shadow-2xl text-center">
					<div className="text-5xl mb-4">🎉</div>

					<h2 className="text-4xl font-bold">Hoàn thành buổi ôn</h2>

					<p className="mt-3 text-slate-400">
						Tốt lắm! Các từ sẽ xuất hiện lại đúng thời điểm cần ôn.
					</p>

					<div className="grid grid-cols-2 gap-4 mt-8">
						<div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
							<p className="text-sm text-red-300">😵 Quên</p>
							<p className="text-3xl font-bold text-red-400 mt-1">
								{results.forgot}
							</p>
						</div>

						<div className="rounded-2xl border border-orange-500/20 bg-orange-500/10 p-4">
							<p className="text-sm text-orange-300">😓 Khó</p>
							<p className="text-3xl font-bold text-orange-400 mt-1">
								{results.hard}
							</p>
						</div>

						<div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 p-4">
							<p className="text-sm text-blue-300">🙂 Khá nhớ</p>
							<p className="text-3xl font-bold text-blue-400 mt-1">
								{results.medium}
							</p>
						</div>

						<div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
							<p className="text-sm text-emerald-300">✅ Dễ</p>
							<p className="text-3xl font-bold text-emerald-400 mt-1">
								{results.easy}
							</p>
						</div>
					</div>

					<button
						onClick={() => router.back()}
						className="mt-8 w-full rounded-xl bg-blue-600 py-3 font-semibold hover:bg-blue-500 transition"
					>
						Quay lại
					</button>
				</div>
			</div>
		);
	}

	if (!currentWord) {
		return (
			<div className="min-h-screen bg-[#030616] flex flex-col items-center justify-center text-center text-white px-4">
				<h2 className="text-3xl font-bold">Chưa có từ nào cần ôn lúc này 🎉</h2>

				<p className="mt-3 text-slate-400">
					Hãy quay lại sau khi đến thời gian ôn tập tiếp theo.
				</p>

				<button
					onClick={() => router.back()}
					className="mt-6 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 transition-colors"
				>
					Quay lại
				</button>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-[#030616] text-white px-4 py-6 sm:py-10">
			<div className="max-w-3xl mx-auto">
				<button
					onClick={() => router.back()}
					className="flex items-center gap-2 text-slate-400 hover:text-white mb-6 sm:mb-8"
				>
					<ArrowLeft size={18} />
					Quay lại
				</button>

				{/* Header */}
				<div className="flex items-center justify-between gap-4 mb-5 sm:mb-6">
					<div>
						<h1 className="text-2xl sm:text-4xl font-bold mt-1">Ôn từ vựng</h1>
					</div>

					<p className="shrink-0 text-sm sm:text-lg text-slate-400">
						{currentIndex + 1} / {words.length}
					</p>
				</div>

				{/* Progress */}
				<div className="h-2 sm:h-4 bg-slate-800 rounded-full overflow-hidden mb-6 sm:mb-8">
					<div
						className="h-full bg-blue-400 transition-all"
						style={{
							width: `${((currentIndex + 1) / words.length) * 100}%`,
						}}
					/>
				</div>

				{/* card */}
				<div
					onClick={() => setShowAnswer((cur) => !cur)}
					className="min-h-[280px] sm:min-h-[340px] rounded-2xl sm:rounded-3xl border border-slate-800 bg-[#0d1427] px-5 py-8 sm:p-10 flex flex-col items-center justify-center text-center cursor-pointer shadow-2xl hover:border-blue-500/40 transition select-none"
				>
					{!showAnswer ? (
						<>
							<p className="text-xs sm:text-sm text-slate-500 mb-3 sm:mb-4">
								Nhấn vào thẻ để xem nghĩa
							</p>

							<h2 className="text-4xl sm:text-5xl font-bold text-white break-words max-w-full">
								{currentWord.english}
							</h2>

							{currentWord.pronunciation && (
								<p className="mt-3 sm:mt-4 text-base sm:text-lg text-blue-300 font-mono break-words">
									{currentWord.pronunciation}
								</p>
							)}
						</>
					) : (
						<>
							<p className="text-xs sm:text-sm text-slate-500 mb-3 sm:mb-4">
								Nghĩa
							</p>

							<h2 className="text-3xl sm:text-4xl font-bold text-emerald-400 break-words max-w-full">
								{currentWord.vietnamese}
							</h2>

							{currentWord.example && (
								<p className="mt-5 sm:mt-6 text-sm sm:text-base text-slate-300 italic break-words max-w-full">
									“{currentWord.example}”
								</p>
							)}
						</>
					)}
				</div>

				{/* action */}
				<div className="mt-5 sm:mt-6">
					<button
						onClick={() => setShowAnswer((prev) => !prev)}
						className="hidden md:flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 cursor-pointer mb-5"
					>
						<RotateCcw size={17} />
						Lật thẻ
					</button>

					<div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
						<button
							onClick={() => handleAnswer(0)}
							className="flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl border border-red-500/30 bg-red-500/10 px-2 sm:px-5 py-3 text-red-400 transition hover:bg-red-500/20"
						>
							<span className="text-sm sm:text-base">😵 Quên rồi</span>
							<span className="text-[10px] sm:text-xs opacity-60">
								{getReviewLabel(0)}
							</span>
						</button>

						<button
							onClick={() => handleAnswer(1)}
							className="flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl border border-orange-500/30 bg-orange-500/10 px-2 sm:px-5 py-3 text-orange-400 transition hover:bg-orange-500/20"
						>
							<span className="text-sm sm:text-base">😓 Khó</span>
							<span className="text-[10px] sm:text-xs opacity-60">
								{getReviewLabel(1)}
							</span>
						</button>

						<button
							onClick={() => handleAnswer(2)}
							className="flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl border border-blue-500/30 bg-blue-500/10 px-2 sm:px-5 py-3 text-blue-400 transition hover:bg-blue-500/20"
						>
							<span className="text-sm sm:text-base">🙂 Khá nhớ</span>
							<span className="text-[10px] sm:text-xs opacity-60">
								{getReviewLabel(2)}
							</span>
						</button>

						<button
							onClick={() => handleAnswer(3)}
							className="flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-2 sm:px-5 py-3 text-emerald-400 transition hover:bg-emerald-500/20"
						>
							<span className="text-sm sm:text-base">✅ Dễ</span>
							<span className="text-[10px] sm:text-xs opacity-60">
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
