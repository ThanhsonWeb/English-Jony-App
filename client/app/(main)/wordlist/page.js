"use client";
import { useState, useEffect } from "react";
import Topic from "@/app/_components/Topic";
import Loading from "@/app/_components/loading";
import { BookOpen, Layers, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/app/_contexts/AuthContext";
import Button from "@/app/_components/Button";
import StatCard from "@/app/_components/StatCard";

function Page() {
	const { user } = useAuth();
	const [loading, setLoading] = useState(true);
	const [isOpen, setIsOpen] = useState(false);
	const [topics, setTopics] = useState([]);
	const [newTopic, setNewTopic] = useState("");
	const [description, setDescription] = useState("");
	const [words, setWords] = useState([]);
	const [quote, setQuote] = useState("");
	const wordsToReview = words.filter(
		(word) => word.nextReview && new Date(word.nextReview) <= new Date(),
	);
	const learnedWords = words.filter((word) => (word.reviewCount || 0) > 0);
	console.table(
		wordsToReview.map((word) => ({
			english: word.english,
			nextReview: word.nextReview,
			status: word.status,
			reviewCount: word.reviewCount,
		})),
	);
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
			text: "🏀 Tôi đã thất bại hết lần này đến lần khác trong cuộc đời. Và đó là lý do tôi thành công.",
			author: "Michael Jordan",
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
	// Random quote
	useEffect(() => {
		const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
		setQuote(randomQuote);
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

	if (!loading && !user) {
		return (
			<div className="min-h-[calc(100vh-80px)] bg-slate-950 flex items-center justify-center px-4">
				<div className="text-center max-w-md">
					<div className="text-5xl mb-5">🔐</div>

					<h1 className="text-2xl font-bold text-slate-100 mb-3">
						Bạn chưa đăng nhập
					</h1>

					<p className="text-slate-400 mb-6">
						Đăng nhập hoặc tạo tài khoản để xem sổ tay và lưu từ vựng của bạn.
					</p>

					<div className="flex justify-center gap-3">
						<Link
							href="/login"
							className="px-5 py-3 rounded-xl border border-slate-700 text-slate-200 hover:bg-slate-900"
						>
							Đăng nhập
						</Link>

						<Link
							href="/signup"
							className="px-5 py-3 rounded-xl bg-blue-600 text-white hover:bg-blue-500"
						>
							Đăng ký
						</Link>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-[calc(100vh-80px)] bg-[#030616] px-4 sm:px-7 py-6 sm:py-8">
			<div className="max-w-6xl mx-auto">
				{/* ================= HERO ================= */}
				<div className="grid grid-cols-1 lg:grid-cols-[2.2fr_1fr] gap-4 mb-5">
					{/* Review Card */}
					<div className="relative overflow-hidden rounded-2xl border border-blue-500/20 bg-gradient-to-br from-[#102451] via-[#0c1c40] to-[#07142f] p-6 sm:p-8 ">
						<div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
							<div className="max-w-xl">
								<div className="flex items-center gap-3 text-blue-300 mb-5">
									<div className="flex h-11 w-11 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10">
										<BookOpen className="w-5 h-5" />
									</div>

									<p className="text-xs sm:text-sm font-semibold tracking-wide uppercase">
										Học tiếp hôm nay
									</p>
								</div>

								<h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
									{wordsToReview.length > 0 ? (
										<>
											Bạn có{" "}
											<span className="text-blue-400">
												{wordsToReview.length} từ
											</span>{" "}
											cần ôn tập
										</>
									) : (
										"Bạn đã hoàn thành hôm nay 🎉"
									)}
								</h1>

								<p className="mt-3 text-sm sm:text-base text-slate-400 leading-relaxed">
									{wordsToReview.length > 0
										? "Ôn tập đều đặn mỗi ngày giúp bạn ghi nhớ lâu hơn và tiến bộ nhanh hơn."
										: "Hiện tại không có từ nào đến hạn. Bạn có thể học thêm từ mới nhé."}
								</p>

								{wordsToReview.length > 0 && (
									<Link
										href="/wordlist/review"
										className="inline-flex mt-6 items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 active:scale-[0.98]"
									>
										Bắt đầu ôn tập
										<span>→</span>
									</Link>
								)}
							</div>

							{/* Right mini information */}
							<div className="lg:min-w-[190px] lg:border-l lg:border-white/10 lg:pl-8">
								<p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
									Hôm nay
								</p>

								<p className="mt-2 text-4xl font-bold text-blue-400">
									{wordsToReview.length}
								</p>

								<p className="mt-1 text-sm text-slate-400">từ cần ôn</p>

								<div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-slate-900">
									<div
										className="h-full rounded-full bg-blue-500 transition-all"
										style={{
											width:
												words.length > 0
													? `${Math.min(
															100,
															((words.length - wordsToReview.length) /
																words.length) *
																100,
														)}%`
													: "0%",
										}}
									/>
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
				<div className="mb-4 flex items-center justify-between gap-4">
					<div>
						<h2 className="text-lg sm:text-xl font-semibold text-white">
							Danh sách từ vựng
						</h2>

						<p className="mt-1 text-xs sm:text-sm text-slate-500">
							{topics.length} danh sách · {words.length} từ
						</p>
					</div>

					<button
						onClick={() => setIsOpen(true)}
						className="shrink-0 rounded-xl border border-blue-500/40 bg-blue-500/5 px-4 py-2.5 text-xs sm:text-sm font-semibold text-blue-300 transition hover:bg-blue-500/10 hover:border-blue-400"
					>
						+ Tạo danh sách mới
					</button>
				</div>

				{/* ================= TOPICS ================= */}
				{topics.length > 0 ? (
					<div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
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
				) : (
					<div className="rounded-2xl border border-dashed border-slate-800 bg-[#081123]/50 px-6 py-14 text-center">
						<div className="text-4xl mb-4">📚</div>

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
				)}

				{/* ================= MODAL ================= */}
				{isOpen && (
					<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
						<form
							onSubmit={handleSubmit}
							className="w-full max-w-md rounded-2xl border border-slate-800 bg-[#0c1426] p-6 sm:p-8 shadow-2xl"
						>
							<div className="flex items-center justify-between">
								<div>
									<h4 className="text-xl font-bold text-white">
										Tạo danh sách mới
									</h4>

									<p className="mt-1 text-sm text-slate-500">
										Thêm một chủ đề bạn muốn học.
									</p>
								</div>

								<button
									type="button"
									onClick={() => setIsOpen(false)}
									className="text-2xl text-slate-500 hover:text-white"
								>
									&times;
								</button>
							</div>

							<div className="mt-6 flex flex-col gap-2">
								<label className="text-sm font-medium text-slate-300">
									Tiêu đề
								</label>

								<input
									type="text"
									placeholder="Ví dụ: Travel, Food..."
									value={newTopic}
									onChange={(e) => setNewTopic(e.target.value)}
									className="rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-slate-100 outline-none transition focus:border-blue-500"
									required
								/>
							</div>

							<div className="mt-4 flex flex-col gap-2">
								<label className="text-sm font-medium text-slate-300">
									Ghi chú
								</label>

								<textarea
									placeholder="Mô tả ngắn về danh sách..."
									value={description}
									onChange={(e) => setDescription(e.target.value)}
									rows={3}
									className="resize-none rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-slate-100 outline-none transition focus:border-blue-500"
								/>
							</div>

							<div className="mt-6 flex gap-3">
								<button
									type="button"
									onClick={() => setIsOpen(false)}
									className="flex-1 rounded-xl border border-slate-700 py-3 text-sm font-medium text-slate-300 transition hover:bg-slate-800"
								>
									Hủy
								</button>

								<Button type="submit">Tạo danh sách</Button>
							</div>
						</form>
					</div>
				)}
			</div>
		</div>
	);
}

export default Page;
