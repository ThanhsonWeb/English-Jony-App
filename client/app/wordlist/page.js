"use client";
import { useState, useEffect } from "react";
import Topic from "../_components/Topic";
import Button from "../_components/Button";
import { BookOpen, Layers, CheckCircle2 } from "lucide-react";

function Page() {
	const [isOpen, setIsOpen] = useState(false);
	const [topics, setTopics] = useState([]);
	const [newTopic, setNewTopic] = useState("");
	const [description, setDescription] = useState("");
	const [words, setWords] = useState([]);
	const wordsToLearn = words.filter((word) => word.status !== true);

	useEffect(() => {
		async function fetchWords() {
			try {
				const res = await fetch("/api/v1/vocab", {
					credentials: "include",
				});

				if (!res.ok) return;

				const data = await res.json();
				setWords(data.data.vocabularies);
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
					console.error("User is not authenticated");
					return;
				}
				const data = await res.json();
				setTopics(data.data.topics);
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

	return (
		<div className="min-h-[calc(100vh-80px)] bg-[#030616] px-4 sm:px-8 py-10 relative overflow-hidden">
			<div className="max-w-5xl mx-auto relative z-10">
				{/* Header */}
				<div className="relative z-10 mb-10 rounded-xl p-6 sm:p-8 shadow-[0_0_60px_-10px_rgba(30,58,138,0.4)] overflow-hidden">
					{/* Radial Glow Layer */}
					<div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.15)_0%,rgba(13,27,62,0)_70%)] pointer-events-none" />

					<div className="relative z-10 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
						<div>
							<p className="text-sm text-blue-400 font-medium mb-1">
								Không gian học từ vựng của bạn 😊
							</p>

							<h1 className="flex items-center gap-2 text-3xl sm:text-4xl font-bold text-white tracking-tight">
								Tiếp tục xây dựng vốn từ vựng 🚀
							</h1>

							<p className="mt-2 text-slate-400">
								Tạo danh sách từ, sắp xếp từ vựng và học mỗi ngày. 🍀
							</p>
						</div>

						<Button
							onClick={() => setIsOpen(true)}
							size="md"
							className="bg-gradient-to-r hfont-semibold shadow-[0_0_20px_rgba(37,99,235,0.4)] border border-blue-400/30 transition-all duration-300  "
						>
							+ Tạo danh sách từ
						</Button>
					</div>
				</div>

				{/* Stats Cards Grid */}
				<div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
					{/* Card 1*/}
					<div className="flex items-center justify-between rounded-md border border-[#1a2d59] bg-[#0d1b3e]/80 p-5 shadow-lg backdrop-blur-sm">
						<div>
							<p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
								Danh sách từ
							</p>
							<p className="text-3xl font-bold text-white">{topics.length}</p>
						</div>
						<div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
							<BookOpen className="w-6 h-6" />
						</div>
					</div>

					{/* Card 2 */}
					<div className="flex items-center justify-between rounded-md border border-[#1a2d59] bg-[#0d1b3e]/80 p-5 shadow-lg backdrop-blur-sm">
						<div>
							<p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
								Tổng số từ
							</p>
							<p className="text-3xl font-bold text-white">{words.length}</p>
						</div>
						<div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
							<Layers className="w-6 h-6" />
						</div>
					</div>

					{/* Card 3*/}
					<div className="flex items-center justify-between rounded-md border border-[#1a2d59] bg-[#0d1b3e]/80 p-5 shadow-lg backdrop-blur-sm">
						<div>
							<p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
								Từ cần học
							</p>
							<p className="text-3xl font-bold text-emerald-400">
								{wordsToLearn.length}
							</p>
						</div>
						<div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
							<CheckCircle2 className="w-6 h-6" />
						</div>
					</div>
				</div>

				{/* form */}
				{isOpen && (
					<div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
						<form
							onSubmit={handleSubmit}
							className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-8 flex flex-col gap-4"
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
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-10">
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
					<p className="mt-10 text-center text-slate-400">
						Bạn chưa có danh sách từ nào. Hãy tạo danh sách từ đầu tiên để bắt
						đầu học 📚
					</p>
				)}
			</div>
		</div>
	);
}

export default Page;
