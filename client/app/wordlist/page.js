"use client";
import { useState, useEffect } from "react";
import Topic from "../_components/Topic";
import Button from "../_components/Button";
import { BookOpen, Layers, CheckCircle2 } from "lucide-react";
import Loading from "../_components/loading";
import Link from "next/link";
import { useAuth } from "../_contexts/AuthContext";

function Page() {
	const { user } = useAuth();
	const [loading, setLoading] = useState(true);
	const [isOpen, setIsOpen] = useState(false);
	const [topics, setTopics] = useState([]);
	const [newTopic, setNewTopic] = useState("");
	const [description, setDescription] = useState("");
	const [words, setWords] = useState([]);
	const wordsToReview = words.filter(
		(word) => word.nextReview && new Date(word.nextReview) <= new Date(),
	);

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
		<div className="min-h-[calc(100vh-80px)] bg-[#030616] px-4 sm:px-8 py-6 sm:py-10 relative overflow-hidden">
			<div className="max-w-5xl mx-auto relative z-10">
				{/* Header */}
				<div className="relative z-10 mb-7 sm:mb-10 rounded-2xl border border-slate-900/80 bg-[#071022]/70 p-5 sm:p-8 shadow-[0_0_50px_-20px_rgba(37,99,235,0.45)] overflow-hidden">
					{/* Radial Glow Layer */}
					<div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.16)_0%,rgba(13,27,62,0)_65%)] pointer-events-none" />

					<div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
						<div className="max-w-2xl">
							<p className="text-xs sm:text-sm text-blue-400 font-medium mb-2">
								Không gian học từ vựng của bạn 😊
							</p>

							<h1 className="text-2xl sm:text-4xl font-bold text-white tracking-tight leading-tight">
								Tiếp tục xây dựng vốn từ vựng 🚀
							</h1>

							<p className="mt-2 text-sm sm:text-base text-slate-400 leading-relaxed">
								Tạo danh sách từ, sắp xếp từ vựng và học mỗi ngày. 🍀
							</p>
						</div>

						<button
							onClick={() => setIsOpen(true)}
							className="w-full sm:w-auto rounded-xl bg-slate-100 px-5 py-3 text-sm sm:text-base font-semibold text-slate-900 shadow-[0_0_20px_rgba(59,130,246,0.18)] transition-all hover:bg-white active:scale-[0.98] cursor-pointer"
						>
							+ Tạo danh sách từ
						</button>
					</div>
				</div>

				{/* Stats Cards Grid */}
				<div className="grid grid-cols-3 gap-2 sm:gap-4 mb-8 sm:mb-10">
					<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-[#1a2d59] bg-[#0d1b3e]/50 p-3 sm:p-5 shadow-lg backdrop-blur-sm">
						<div>
							<p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 sm:text-slate-400 mb-1">
								Danh sách
							</p>

							<p className="text-2xl sm:text-3xl font-bold text-white">
								{topics.length}
							</p>
						</div>

						<div className="hidden sm:flex p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
							<BookOpen className="w-6 h-6" />
						</div>
					</div>

					<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-[#1a2d59] bg-[#0d1b3e]/50 p-3 sm:p-5 shadow-lg backdrop-blur-sm">
						<div>
							<p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 sm:text-slate-400 mb-1">
								Tổng số từ
							</p>

							<p className="text-2xl sm:text-3xl font-bold text-white">
								{words.length}
							</p>
						</div>

						<div className="hidden sm:flex p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
							<Layers className="w-6 h-6" />
						</div>
					</div>

					<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-[#1a2d59] bg-[#0d1b3e]/50 p-3 sm:p-5 shadow-lg backdrop-blur-sm">
						<div>
							<p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 sm:text-slate-400 mb-1">
								Cần ôn
							</p>

							<p className="text-2xl sm:text-3xl font-bold text-emerald-400">
								{wordsToReview.length}
							</p>
						</div>

						<div className="hidden sm:flex p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
							<CheckCircle2 className="w-6 h-6" />
						</div>
					</div>
				</div>

				{/* form */}
				{isOpen && (
					<div className="fixed inset-0 backdrop-blur-sm bg-black/60 flex items-center justify-center z-50 p-4">
						<form
							onSubmit={handleSubmit}
							className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 sm:p-8 flex flex-col gap-4 shadow-2xl"
						>
							<div className="flex items-center justify-between">
								<h4 className="text-xl font-bold text-slate-100">
									Tạo danh sách từ mới 🌴
								</h4>

								<button
									type="button"
									onClick={() => setIsOpen(false)}
									className="text-slate-400 hover:text-white text-2xl cursor-pointer"
								>
									&times;
								</button>
							</div>

							<div className="flex flex-col gap-1">
								<label className="text-sm font-medium text-slate-300">
									Tiêu đề
								</label>

								<input
									type="text"
									placeholder="Nhập tiêu đề danh sách từ..."
									value={newTopic}
									onChange={(e) => setNewTopic(e.target.value)}
									className="border border-slate-700/80 bg-slate-950/50 p-3 rounded-xl text-slate-100 focus:outline-none focus:border-blue-500"
									required
								/>
							</div>

							<div className="flex flex-col gap-1">
								<label className="text-sm font-medium text-slate-300">
									Ghi chú
								</label>

								<textarea
									placeholder="Nhập ghi chú hoặc mô tả..."
									value={description}
									onChange={(e) => setDescription(e.target.value)}
									rows={3}
									className="border border-slate-700/80 bg-slate-950/50 p-3 rounded-xl text-slate-100 focus:outline-none focus:border-blue-500"
								/>
							</div>

							<div className="flex gap-3 mt-2">
								<button
									type="button"
									onClick={() => setIsOpen(false)}
									className="flex-1 p-3 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors"
								>
									Hủy
								</button>

								<Button type="submit">Tạo</Button>
							</div>
						</form>
					</div>
				)}

				{/* Topics */}
				{topics.length > 0 ? (
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mt-7 sm:mt-10">
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
					<div className="mt-10 rounded-2xl border border-dashed border-slate-800 px-6 py-12 text-center">
						<div className="text-4xl mb-4">📚</div>

						<h3 className="text-lg font-semibold text-white">
							Chưa có danh sách từ nào
						</h3>

						<p className="mt-2 text-sm text-slate-400">
							Tạo danh sách đầu tiên để bắt đầu xây dựng vốn từ vựng của bạn.
						</p>
					</div>
				)}
			</div>
		</div>
	);
}

export default Page;
