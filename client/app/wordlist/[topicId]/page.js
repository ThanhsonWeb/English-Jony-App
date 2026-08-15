"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Search, Filter } from "lucide-react";
import Word from "@/app/_components/Word.jsx";
import Link from "next/link";
import Button from "@/app/_components/Button";
import { useSearchParams, useRouter } from "next/navigation";
import Loading from "@/app/_components/loading";

export default function WordPage() {
	// state
	const [loading, setLoading] = useState(true);
	const [isOpen, setIsOpen] = useState(false);
	const { topicId } = useParams();
	const [words, setWords] = useState([]);
	const [english, setEnglish] = useState("");
	const [vietnamese, setVietnamese] = useState("");
	const [example, setExample] = useState("");
	const [pronunciation, setPronunciation] = useState("");
	// Searching
	const searchParams = useSearchParams();
	const router = useRouter();
	const search = searchParams.get("search") || "";
	const status = searchParams.get("status") || "all";
	const filteredWords = words.filter((word) => {
		const matchesSearch = word.english
			.toLowerCase()
			.includes(search.toLowerCase());

		const now = new Date();

		const matchesStatus =
			status === "all" ||
			(status === "new" && (word.reviewCount || 0) === 0) ||
			(status === "learning" &&
				(word.reviewCount || 0) > 0 &&
				new Date(word.nextReview) > now) ||
			(status === "review" &&
				(word.reviewCount || 0) > 0 &&
				new Date(word.nextReview) <= now);

		return matchesSearch && matchesStatus;
	});

	// pagination
	const [currentPage, setCurrentPage] = useState(1);
	const wordsPerPage = 5;
	const indexOfLastWord = currentPage * wordsPerPage;
	const indexOfFirstWord = indexOfLastWord - wordsPerPage;
	const currentWords = filteredWords.slice(indexOfFirstWord, indexOfLastWord);
	const totalPages = Math.ceil(filteredWords.length / wordsPerPage);
	//   Get all words
	useEffect(() => {
		async function fetchData() {
			try {
				const res = await fetch(`/api/v1/vocab?topic=${topicId}`, {
					method: "GET",
					credentials: "include",
				});
				const data = await res.json();
				setWords(data.data.vocabularies);
			} catch (err) {
				console.error(err);
			} finally {
				setLoading(false);
			}
		}

		fetchData();
	}, [topicId]);

	async function handleSubmit(e) {
		e.preventDefault();
		try {
			const res = await fetch(`/api/v1/vocab`, {
				method: "POST",
				credentials: "include",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					english,
					vietnamese,
					example,
					topic: topicId, // Crucial: link the word to the topic!
				}),
			});
			if (res.ok) {
				const data = await res.json();
				console.log(data);
				setWords((prev) => [...prev, data.data.newVocab]); // ✅ 2. Update UI instantly
				setEnglish("");
				setVietnamese("");
				setExample("");
				setIsOpen(false);
			}
		} catch (err) {
			console.error(err);
		}
	}

	async function handleDelete(id) {
		try {
			const res = await fetch(`/api/v1/vocab/${id}`, {
				method: "DELETE",
				credentials: "include",
			});
			if (res.ok) {
				setWords((prev) => prev.filter((word) => word._id !== id));
			}
		} catch (error) {
			console.log(error);
		}
	}
	async function handleFix(
		id,
		updatedEnglish,
		updatedVietnamese,
		updatedExample,
	) {
		try {
			const res = await fetch(`/api/v1/vocab/${id}`, {
				method: "PATCH",
				credentials: "include",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					english: updatedEnglish,
					vietnamese: updatedVietnamese,
					example: updatedExample,
				}),
			});
			if (res.ok) {
				setWords((prev) =>
					prev.map((word) =>
						word._id === id
							? {
									...word,
									english: updatedEnglish,
									vietnamese: updatedVietnamese,
									example: updatedExample,
								}
							: word,
					),
				);
			}
		} catch (error) {
			console.log(error);
		}
	}
	if (loading) return <Loading />;
	return (
		<div className="min-h-screen bg-[#0b0f19] text-slate-100 p-8 flex flex-col items-center font-sans">
			<div className="w-full max-w-5xl space-y-6">
				<div className=" flex justify-around items-center">
					<Link href={"/wordlist"}>
						<p className="italic my-4 text-blue-200"> Back to Topics</p>
					</Link>
					<button
						onClick={(e) => {
							router.push(`/wordlist/${topicId}/learn`);
						}}
						className="bg-gray-600 hover:bg-blue-500 text-white text-sm py-1.5 px-4 rounded-lg font-medium transition-colors"
					>
						Học từ vựng
					</button>
				</div>

				<h1 className="text-3xl font-bold tracking-tight text-white">
					Vocabulary List
				</h1>
				{/* Search & Actions */}
				<div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
					{/* Search */}
					<div className="relative w-full sm:w-80">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
						<input
							type="text"
							value={search}
							onChange={(e) => {
								// create new URL
								const params = new URLSearchParams(searchParams.toString());

								params.set("search", e.target.value);
								setCurrentPage(1);

								router.push(`?${params.toString()}`);
							}}
							placeholder="Search vocabulary..."
							className="w-full pl-10 pr-4 py-2.5 bg-[#131927] border border-slate-800 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
						/>
					</div>

					<div className="flex items-center gap-3 w-full sm:w-auto justify-end">
						{/* Filter */}
						<div className="relative">
							<select
								value={status}
								onChange={(e) => {
									// change URL
									const params = new URLSearchParams(searchParams.toString());

									params.set("status", e.target.value);
									setCurrentPage(1);

									router.push(`?${params.toString()}`);
								}}
								className="appearance-none bg-[#131927] border border-slate-800 text-slate-300 text-sm py-2.5 pl-9 pr-8 rounded-lg"
							>
								<option value="all">Tất cả</option>
								<option value="new">Mới</option>
								<option value="learning">Đang học</option>
								<option value="review">Cần ôn</option>
							</select>
							<Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
						</div>

						<Button onClick={() => setIsOpen(!isOpen)}>+ Thêm từ mới</Button>

						{/* Form Modal */}
						{isOpen && (
							<div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
								<form
									onSubmit={handleSubmit}
									className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 flex flex-col gap-4 shadow-xl"
								>
									<h2 className="text-xl font-semibold text-white mb-2">
										Thêm từ mới 🍀
									</h2>
									{/* nhập từ */}
									<div className="flex flex-col gap-1.5">
										<label className="text-sm font-medium text-slate-300">
											Từ
										</label>
										<input
											type="text"
											name="word"
											value={english}
											onChange={(e) => setEnglish(e.target.value)}
											placeholder="Nhập từ bằng tiếng Anh"
											required
											className="w-full px-3.5 py-2.5 bg-[#131927] border border-slate-700/80 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
										/>
									</div>
									{/* nhập nghĩa */}
									<div className="flex flex-col gap-1.5">
										<label className="text-sm font-medium text-slate-300">
											Bản dịch
										</label>
										<input
											type="text"
											name="translation"
											value={vietnamese}
											onChange={(e) => setVietnamese(e.target.value)}
											placeholder="Nhập bản dịch"
											required
											className="w-full px-3.5 py-2.5 bg-[#131927] border border-slate-700/80 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
										/>
									</div>
									{/* nhập câu ví dụ */}
									<div className="flex flex-col gap-1.5">
										<label className="text-sm font-medium text-slate-300">
											Câu ví dụ
										</label>
										<textarea
											name="example"
											value={example}
											onChange={(e) => setExample(e.target.value)}
											rows={3}
											placeholder="Nhập câu ví dụ (tùy chọn)"
											className="w-full px-3.5 py-2.5 bg-[#131927] border border-slate-700/80 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors resize-none"
										/>
									</div>

									<div className="flex gap-3 mt-4">
										<button
											type="button"
											onClick={() => setIsOpen(false)}
											className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors text-sm font-medium"
										>
											Hủy
										</button>
										<Button type="submit" className="flex-1">
											Thêm từ
										</Button>
									</div>
								</form>
							</div>
						)}
					</div>
				</div>

				{/* Main Table Container */}
				<div className="bg-[#111625]/60 border border-slate-800/80 rounded-xl p-4 backdrop-blur-sm shadow-2xl">
					{/* table Header */}
					<div className="grid grid-cols-12 items-center px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
						<div className="col-span-2">Từ</div>
						<div className="col-span-2">IPA</div>
						<div className="col-span-2">Nghĩa</div>
						<div className="col-span-3">Ví dụ</div>
						<div className="col-span-1">Status</div>
						<div className="col-span-2 text-right">Thao Tác</div>
					</div>
					{/* Word */}
					<div className="mt-3 space-y-2">
						{currentWords.map((word, index) => (
							<Word
								key={word._id || index}
								word={word}
								index={index}
								onDelete={handleDelete}
								onFix={handleFix}
							/>
						))}
					</div>
					{/* Pagination  */}
					<div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-800/60 text-xs text-slate-400 px-2">
						<span>
							Trang {currentPage} / {totalPages}
						</span>

						<div className="flex gap-2">
							<button
								onClick={() => setCurrentPage((page) => page - 1)}
								disabled={currentPage === 1}
								className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 text-slate-300 transition-all hover:bg-slate-800 hover:text-white hover:border-slate-600 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-slate-900 disabled:hover:text-slate-300"
							>
								Trước
							</button>

							<button
								onClick={() => setCurrentPage((page) => page + 1)}
								disabled={currentPage === totalPages}
								className="px-3 py-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 text-blue-400 transition-all hover:bg-blue-500 hover:text-white hover:border-blue-500 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-blue-500/10 disabled:hover:text-blue-400"
							>
								Sau
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
