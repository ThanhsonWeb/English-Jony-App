"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, RotateCcw } from "lucide-react";

function Page() {
	const { topicId } = useParams();
	const router = useRouter();

	const [words, setWords] = useState([]);
	const [currentIndex, setCurrentIndex] = useState(0);
	const [showAnswer, setShowAnswer] = useState(false);
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
		}

		fetchWords();
	}, [topicId]);

	async function handleAnswer(level) {
		const word = words[currentIndex];

		const nextReview = new Date();
		const easyIntervals = [7, 14, 30, 60];
		const mediumIntervals = [3, 7, 14, 30];
		const hardIntervals = [1, 3, 7, 14];
		const reviewCount = word.reviewCount || 0;
		const getInterval = (intervals) =>
			intervals[Math.min(reviewCount, intervals.length - 1)];

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

		setCurrentIndex((cur) => cur + 1);
		setShowAnswer(false);
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
		<div className="min-h-screen bg-[#030616] text-white px-4 py-10">
			<div className="max-w-3xl mx-auto">
				<button
					onClick={() => router.back()}
					className="flex items-center gap-2 text-slate-400 hover:text-white mb-8"
				>
					<ArrowLeft size={18} />
					Quay lại
				</button>
				{/* Header */}
				<div className="flex items-center justify-between mb-6">
					<div>
						<h1 className="text-4xl font-bold mt-1">Ôn từ vựng</h1>
					</div>

					<p className="text-lg text-slate-400">
						{currentIndex + 1} / {words.length}
					</p>
				</div>
				{/* Progress */}
				<div className="h-4 bg-slate-800 rounded-full overflow-hidden mb-8">
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
					className="min-h-[340px] rounded-3xl border border-slate-800 bg-[#0d1427] p-10 flex flex-col items-center justify-center text-center cursor-pointer shadow-2xl hover:border-blue-500/40 transition select-none "
				>
					{!showAnswer ? (
						<>
							<p className="text-sm text-slate-500 mb-4">
								Nhấn vào thẻ để xem nghĩa
							</p>

							<h2 className="text-5xl font-bold text-white">
								{currentWord.english}
							</h2>

							{currentWord.pronunciation && (
								<p className="mt-4 text-lg text-blue-300 font-mono">
									{currentWord.pronunciation}
								</p>
							)}
						</>
					) : (
						<>
							<p className="text-sm text-slate-500 mb-4">Nghĩa</p>

							<h2 className="text-4xl font-bold text-emerald-400">
								{currentWord.vietnamese}
							</h2>

							{currentWord.example && (
								<p className="mt-6 text-slate-300 italic">
									“{currentWord.example}”
								</p>
							)}
						</>
					)}
				</div>

				{/* action */}

				<div className="flex items-center justify-between mt-6">
					<button
						onClick={() => setShowAnswer((prev) => !prev)}
						className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 cursor-pointer"
					>
						<RotateCcw size={17} />
						Lật thẻ
					</button>

					<div className="flex gap-3">
						<button
							onClick={() => handleAnswer(0)}
							className="px-5 py-2.5 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20"
						>
							😵 Quên rồi
						</button>

						<button
							onClick={() => handleAnswer(1)}
							className="px-5 py-2.5 rounded-xl border border-orange-500/30 bg-orange-500/10 text-orange-400 hover:bg-orange-500/20"
						>
							😓 Khó
						</button>

						<button
							onClick={() => handleAnswer(2)}
							className="px-5 py-2.5 rounded-xl border border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20"
						>
							🙂 Khá nhớ
						</button>

						<button
							onClick={() => handleAnswer(3)}
							className="px-5 py-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
						>
							✅ Dễ
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}

export default Page;
