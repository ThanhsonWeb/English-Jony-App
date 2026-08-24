"use client";
import { useState, useEffect, useRef } from "react";
import Topic from "@/app/_components/Topic";
import Loading from "@/app/_components/loading";
import {
	BookOpen,
	Layers,
	CheckCircle2,
	Flame,
	Tag,
	NotebookText,
	Sparkles,
	X,
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/app/_contexts/AuthContext";
import StatCard from "@/app/_components/StatCard";

const quotes = [
	{
		text: "🚀 Khi điều gì đó đủ quan trọng, bạn sẽ làm nó ngay cả khi cơ hội không đứng về phía bạn.",
		author: "Elon Musk",
	},
	{
		text: "🍎 Hãy cứ khát khao. Hãy cứ dại khờ.",
		author: "Steve Jobs",
	},
	{
		text: "💡 Trí tưởng tượng quan trọng hơn kiến thức.",
		author: "Albert Einstein",
	},
	{
		text: "👣 Hành trình vạn dặm bắt đầu từ một bước chân.",
		author: "Lão Tử",
	},
	{
		text: "⏳ Tương lai phụ thuộc vào những gì bạn làm hôm nay.",
		author: "Mahatma Gandhi",
	},
	{
		text: "🥊 Đừng đếm ngày, hãy khiến từng ngày trở nên đáng giá.",
		author: "Muhammad Ali",
	},
];

function Page() {
	const { user } = useAuth();
	const [loading, setLoading] = useState(true);
	const [isOpen, setIsOpen] = useState(false);
	const [topics, setTopics] = useState([]);
	const [newTopic, setNewTopic] = useState("");
	const [description, setDescription] = useState("");
	const [words, setWords] = useState([]);
	const [quote, setQuote] = useState("");
	const [activities, setActivities] = useState([]);
	const wordListRef = useRef(null);
	const wordsToReview = words.filter(
		(word) => word.nextReview && new Date(word.nextReview) <= new Date(),
	);
	const learnedWords = words.filter((word) => (word.reviewCount || 0) > 0);
	const activeDates = new Set(
		activities
			.filter((activity) => activity.count > 0)
			.map((activity) => activity.date),
	);
	const formatLocalDate = (date) => {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, "0");
		const day = String(date.getDate()).padStart(2, "0");
		return `${year}-${month}-${day}`;
	};
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	let currentStreak = 0;
	const streakDate = new Date(today);
	while (activeDates.has(formatLocalDate(streakDate))) {
		currentStreak += 1;
		streakDate.setDate(streakDate.getDate() - 1);
	}
	const monday = new Date(today);
	const dayFromMonday = (today.getDay() + 6) % 7;
	monday.setDate(today.getDate() - dayFromMonday);
	const weekDays = Array.from({ length: 7 }, (_, index) => {
		const date = new Date(monday);
		date.setDate(monday.getDate() + index);
		return {
			label: ["T2", "T3", "T4", "T5", "T6", "T7", "CN"][index],
			date: formatLocalDate(date),
			active: activeDates.has(formatLocalDate(date)),
			isToday: formatLocalDate(date) === formatLocalDate(today),
		};
	});
	console.table(
		wordsToReview.map((word) => ({
			english: word.english,
			nextReview: word.nextReview,
			status: word.status,
			reviewCount: word.reviewCount,
		})),
	);
	// Random quote
	useEffect(() => {
		const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
		const timer = setTimeout(() => setQuote(randomQuote), 0);
		return () => clearTimeout(timer);
	}, []);

	useEffect(() => {
		async function fetchWords() {
			try {
				const res = await fetch("/api/v1/vocab", {
					credentials: "include",
				});

				if (!res.ok) return;

				const data = await res.json();
				setWords(data.data.vocabularies);
				setLoading(false);
			} catch (error) {
				console.log(error);
			}
		}

		fetchWords();
	}, []);

	useEffect(() => {
		async function initializeActivity() {
			try {
				// Record today
				await fetch("/api/v1/study-activities", {
					method: "POST",
					credentials: "include",
				});

				// Get all activities
				const res = await fetch("/api/v1/study-activities", {
					credentials: "include",
				});

				if (!res.ok) return;

				const data = await res.json();
				setActivities(data.data.activities || []);
			} catch (error) {
				console.log(error);
			}
		}

		initializeActivity();
	}, []);
	// getAllTopics
	useEffect(() => {
		const fetchTopics = async () => {
			try {
				const res = await fetch("/api/v1/topics", {
					method: "GET",
					credentials: "include", // send cookie automatically
				});
				if (res.status === 401) {
					setLoading(false);
					return;
				}
				const data = await res.json();
				setTopics(data.data.topics);
				setLoading(false);
			} catch (error) {
				console.log(error);
			}
		};
		fetchTopics();
	}, []);

	async function handleSubmit(e) {
		e.preventDefault();
		try {
			const res = await fetch("/api/v1/topics", {
				method: "POST",
				credentials: "include",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ name: newTopic, description }),
			});
			const data = await res.json();

			if (data.status === "success") {
				setTopics((prev) => [...prev, data.data.topic]);
				setNewTopic("");
				setDescription("");
				setIsOpen(false);
			}
		} catch (error) {
			console.log(error);
		}
	}

	async function handleDelete(id) {
		if (!confirm("Are you sure you want to delete this topic?")) return;

		try {
			const res = await fetch(`/api/v1/topics/${id}`, {
				method: "DELETE",
				credentials: "include",
			});
			if (res.ok) {
				setTopics((prev) => prev.filter((topic) => topic._id !== id));
			}
		} catch (error) {
			console.log(error);
		}
	}

	async function handleFix(id, updatedName, updatedDescription) {
		try {
			const res = await fetch(`/api/v1/topics/${id}`, {
				method: "PATCH",
				credentials: "include",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					name: updatedName,
					description: updatedDescription,
				}),
			});
			//update the UI instantly
			if (res.ok) {
				setTopics((prev) =>
					prev.map((topic) =>
						topic._id === id
							? { ...topic, name: updatedName, description: updatedDescription }
							: topic,
					),
				);
			}
		} catch (error) {
			console.log(error);
		}
	}

	if (loading) return <Loading />;

	return (
		<div className="min-h-[calc(100vh-80px)] bg-[#030616] px-4 sm:px-7 py-6 sm:py-8">
			<div className="max-w-6xl mx-auto">
				{/* ================= HERO ================= */}
				<div className="grid grid-cols-1 lg:grid-cols-[2.2fr_1fr] gap-4 mb-5">
					{/* Weekly streak banner */}
					<div className="relative overflow-hidden rounded-2xl border border-orange-500/20 bg-gradient-to-br from-[#251407] via-[#1b1020] to-[#0d1730] p-5 sm:p-7">
						<div className="pointer-events-none absolute -right-12 -top-14 h-44 w-44 rounded-full bg-orange-500/15 blur-3xl" />
						<div className="relative z-10 flex h-full flex-col justify-between gap-6">
							<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
								<div className="flex items-center gap-4">
									<div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-orange-500/15 text-orange-400 ring-1 ring-orange-400/20">
										<Flame className="h-8 w-8 fill-orange-500/30" />
									</div>
									<div>
										<p className="text-sm font-medium text-orange-300">
											Chuỗi học tập hiện tại
										</p>
										<h1 className="mt-1 text-3xl font-bold tracking-tight text-white sm:text-4xl">
											{currentStreak} ngày
										</h1>
									</div>
								</div>
							</div>

							<div>
								<p className="mb-3 text-sm text-slate-400">
									Hoạt động tuần này
								</p>
								<div className="grid grid-cols-7 gap-1.5 sm:gap-3">
									{weekDays.map((day) => (
										<div
											key={day.date}
											className="flex min-w-0 flex-col items-center gap-2"
										>
											<div
												className={`flex h-9 w-9 items-center justify-center rounded-full border text-sm font-bold transition sm:h-11 sm:w-11 ${day.active ? "border-orange-400 bg-orange-500 text-slate-950 shadow-[0_0_18px_rgba(249,115,22,0.25)]" : day.isToday ? "border-orange-400/60 bg-orange-500/10 text-orange-300" : "border-slate-700 bg-slate-900/70 text-slate-600"}`}
											>
												{day.active ? "✓" : day.date.slice(-2)}
											</div>
											<span
												className={`text-[11px] font-medium sm:text-xs ${day.isToday ? "text-orange-300" : "text-slate-500"}`}
											>
												{day.label}
											</span>
										</div>
									))}
								</div>
							</div>
						</div>
					</div>

					{/* Quote */}
					<div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-[#0b1730] p-6 sm:p-7 min-h-[230px]">
						{/* glow */}
						<div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.18),transparent_55%)]" />

						{/* back mountain */}
						<div
							className="absolute bottom-0 right-0 h-[45%] w-[85%] bg-[#0a1329]/80"
							style={{
								clipPath:
									"polygon(0 100%, 20% 65%, 35% 78%, 55% 38%, 68% 62%, 82% 25%, 100% 55%, 100% 100%)",
							}}
						/>

						{/* front mountain */}
						<div
							className="absolute bottom-0 right-0 h-[32%] w-full bg-[#060d1d]"
							style={{
								clipPath:
									"polygon(0 100%, 18% 70%, 32% 82%, 48% 55%, 62% 75%, 78% 45%, 100% 72%, 100% 100%)",
							}}
						/>

						{/* Quote */}
						<div className="relative z-10 max-w-[85%]">
							<span className="text-4xl text-slate-500">“</span>

							<h3 className="mt-2 text-lg sm:text-xl font-semibold italic leading-relaxed text-white">
								{quote.text}
							</h3>

							<p className="mt-5 text-sm font-medium text-blue-300">
								— {quote.author}
							</p>
						</div>
					</div>
				</div>

				{/* ================= STATS ================= */}
				<div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-8">
					<StatCard
						title="Tổng số từ"
						value={words.length}
						icon={<Layers className="h-6 w-6" />}
						accent="violet"
					/>

					<StatCard
						title="Đã học"
						value={learnedWords.length}
						icon={<BookOpen className="h-6 w-6" />}
						accent="emerald"
					/>

					<StatCard
						title="Cần ôn hôm nay"
						value={wordsToReview.length}
						icon={<CheckCircle2 className="h-6 w-6" />}
						accent="amber"
					/>
				</div>

				{/* ================= LIST HEADER ================= */}
				<div
					ref={wordListRef}
					className="mb-4 flex scroll-mt-24 items-center justify-between gap-4"
				>
					<div>
						<h2 className="text-lg sm:text-xl font-semibold text-white">
							Danh sách từ vựng
						</h2>

						<p className="mt-1 text-xs sm:text-sm text-slate-500">
							{topics.length} danh sách · {words.length} từ
						</p>
					</div>
					{user && (
						<button
							onClick={() => setIsOpen(true)}
							className="shrink-0 rounded-xl border border-blue-500/40 bg-blue-500/5 px-4 py-2.5 text-xs sm:text-sm font-semibold text-blue-300 transition hover:bg-blue-500/10 hover:border-blue-400"
						>
							+ Tạo danh sách mới
						</button>
					)}
				</div>

				{/* ================= TOPICS ================= */}
				{topics.length > 0 ? (
					<div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-2">
						{topics.map((topic) => {
							const topicWords = words.filter(
								(word) => word.topic === topic._id,
							);

							return (
								<Topic
									key={topic._id}
									topic={topic}
									words={topicWords}
									onDelete={handleDelete}
									onFix={handleFix}
								/>
							);
						})}
					</div>
				) : user ? (
					<div className="rounded-2xl border border-dashed border-slate-800 bg-[#081123]/50 px-6 py-14 text-center">
						<div className="mb-4 text-4xl">📚</div>

						<h3 className="text-lg font-semibold text-white">
							Chưa có danh sách từ nào
						</h3>

						<p className="mt-2 text-sm text-slate-400">
							Tạo danh sách đầu tiên để bắt đầu xây dựng vốn từ vựng.
						</p>

						<button
							onClick={() => setIsOpen(true)}
							className="mt-5 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500"
						>
							+ Tạo danh sách
						</button>
					</div>
				) : (
					<div className="relative overflow-hidden rounded-2xl border border-blue-500/20 bg-gradient-to-br from-[#0b1730] via-[#081225] to-[#06101f] px-6 py-12 text-center shadow-[0_20px_60px_-30px_rgba(37,99,235,0.45)]">
						{/* background glow */}
						<div className="pointer-events-none absolute -top-20 left-1/2 h-52 w-52 -translate-x-1/2 rounded-full bg-blue-500/10 blur-3xl" />

						<div className="relative z-10 mx-auto flex max-w-md flex-col items-center">
							{/* icon */}
							<div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10 text-3xl shadow-[0_0_30px_rgba(59,130,246,0.12)]">
								👋
							</div>

							<h3 className="text-xl sm:text-2xl font-bold text-white">
								Sẵn sàng bắt đầu học chưa?
							</h3>

							<p className="mt-3 text-sm sm:text-base leading-relaxed text-slate-400">
								Đăng nhập để tạo danh sách từ, lưu tiến độ và tiếp tục học mỗi
								ngày.
							</p>

							<div className="mt-6 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
								<Link
									href="/login"
									className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 active:scale-[0.98]"
								>
									Đăng nhập
								</Link>

								<Link
									href="/signup"
									className="rounded-xl border border-slate-700 bg-slate-900/50 px-6 py-3 text-sm font-semibold text-slate-200 transition hover:border-blue-500/40 hover:bg-slate-800"
								>
									Tạo tài khoản miễn phí
								</Link>
							</div>

							<p className="mt-5 text-xs text-slate-500">
								✨ Lưu từ vựng • Theo dõi tiến độ • Ôn tập thông minh
							</p>
						</div>
					</div>
				)}

				{/* ================= MODAL ================= */}
				{isOpen && (
					<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
						<form
							onSubmit={handleSubmit}
							className="relative w-full max-w-md overflow-hidden rounded-3xl border border-violet-500/35 bg-[#0b1022] "
						>
							<div className="pointer-events-none absolute inset-x-0 top-0 h-32 overflow-hidden">
								<div className="absolute -left-16 -top-20 h-36 w-[130%] rotate-[-7deg] rounded-[50%] bg-gradient-to-r from-violet-500/20 via-purple-500/10 to-transparent blur-xl" />
								<div className="absolute left-1/2 top-4 h-20 w-40 -translate-x-1/2 rounded-full bg-violet-500/15 blur-3xl" />
							</div>

							<button
								type="button"
								onClick={() => setIsOpen(false)}
								aria-label="Đóng"
								className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-slate-700/80 bg-slate-900/70 text-slate-500 transition hover:border-violet-400/50 hover:bg-violet-500/10 hover:text-white active:scale-95"
							>
								<X className="h-4 w-4" />
							</button>

							<div className="relative px-6 pb-6 pt-5 sm:px-8">
								<div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-violet-400/30 bg-violet-500/15 text-violet-300 shadow-[0_0_28px_rgba(139,92,246,0.35)]">
									<BookOpen className="h-6 w-6" />
								</div>

								<div className="mt-4 text-center">
									<h4 className="text-xl font-bold text-white sm:text-2xl">
										Tạo danh sách mới
									</h4>
									<p className="mt-1 text-sm text-slate-400">
										Thêm một chủ đề bạn muốn học.
									</p>
								</div>

								<div className="mt-6 flex flex-col gap-2">
									<label className="text-sm font-medium text-slate-300">
										Tiêu đề
									</label>
									<div className="relative">
										<Tag className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-violet-400" />
										<input
											type="text"
											placeholder="Ví dụ: Travel, Food..."
											value={newTopic}
											onChange={(e) => setNewTopic(e.target.value)}
											className="w-full rounded-xl border border-slate-700/80 bg-[#080d1c] py-3 pl-10 pr-4 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10"
											required
										/>
									</div>
								</div>

								<div className="mt-4 flex flex-col gap-2">
									<label className="text-sm font-medium text-slate-300">
										Ghi chú
									</label>
									<div className="relative">
										<NotebookText className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-violet-400" />
										<textarea
											placeholder="Mô tả ngắn về danh sách..."
											value={description}
											onChange={(e) => setDescription(e.target.value)}
											rows={3}
											className="w-full resize-none rounded-xl border border-slate-700/80 bg-[#080d1c] py-3 pl-10 pr-4 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10"
										/>
									</div>
								</div>
							</div>

							<div className="flex gap-3 border-t border-violet-500/15 bg-[#090e1d]/80 px-6 py-4 sm:px-8">
								<button
									type="button"
									onClick={() => setIsOpen(false)}
									className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-3 text-sm font-semibold text-slate-300 transition hover:border-slate-600 hover:bg-slate-800 hover:text-white active:scale-[0.98]"
								>
									<X className="h-4 w-4 text-violet-400" />
									Hủy
								</button>

								<button
									type="submit"
									className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-500 px-3 py-3 text-sm font-semibold text-white shadow-[0_10px_28px_-12px_rgba(139,92,246,0.9)] transition hover:from-blue-500 hover:to-violet-400 active:scale-[0.98]"
								>
									<Sparkles className="h-4 w-4" />
									Tạo danh sách
								</button>
							</div>
						</form>
					</div>
				)}
			</div>
		</div>
	);
}

export default Page;
