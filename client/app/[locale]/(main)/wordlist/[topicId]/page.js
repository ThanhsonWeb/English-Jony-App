"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import {
	Search,
	Filter,
	ArrowLeft,
	RotateCcw,
	LayoutList,
	LayoutGrid,
	BookPlus,
	Tag,
	Languages,
	NotebookText,
	Sparkles,
	X,
} from "lucide-react";
import Word from "@/app/_components/Word.jsx";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import Loading from "@/app/_components/loading";

export default function WordPage() {
	// state
	const [viewMode, setViewMode] = useState("list");
	const [wordList, setWordList] = useState([]);
	const [suggestions, setSuggestions] = useState([]);
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
	const now = new Date();

	const isReviewDue = (word) =>
		(word.reviewCount || 0) > 0 &&
		word.nextReview &&
		new Date(word.nextReview) <= now;
	const getWordPriority = (word) => {
		if (isReviewDue(word)) return 2;
		if ((word.reviewCount || 0) === 0) return 1;
		return 0;
	};

	const filteredWords = words
		.filter((word) => {
			const matchesSearch = word.english
				.toLowerCase()
				.includes(search.toLowerCase());

			const matchesStatus =
				status === "all" ||
				(status === "new" && (word.reviewCount || 0) === 0) ||
				(status === "learning" &&
					(word.reviewCount || 0) > 0 &&
					!isReviewDue(word)) ||
				(status === "review" && isReviewDue(word));

			return matchesSearch && matchesStatus;
		})
		.sort((a, b) => {
			const priorityDifference = getWordPriority(b) - getWordPriority(a);

			if (priorityDifference !== 0) return priorityDifference;

			return 0;
		});

	// pagination
	const [currentPage, setCurrentPage] = useState(1);
	const wordsPerPage = 5;
	const indexOfLastWord = currentPage * wordsPerPage;
	const indexOfFirstWord = indexOfLastWord - wordsPerPage;
	const currentWords = filteredWords.slice(indexOfFirstWord, indexOfLastWord);
	const totalPages = Math.max(
		1,
		Math.ceil(filteredWords.length / wordsPerPage),
	);
	const newWordCount = words.filter((word) => (word.reviewCount || 0) === 0).length;
	const reviewWordCount = words.filter(isReviewDue).length;
	const learningWordCount = words.length - newWordCount - reviewWordCount;

	function handleViewModeChange(mode) {
		setViewMode(mode);
		localStorage.setItem("studyjony-word-view", mode);
	}

	useEffect(() => {
		const savedViewMode = localStorage.getItem("studyjony-word-view");

		if (savedViewMode !== "list" && savedViewMode !== "card") return;

		const timer = setTimeout(() => setViewMode(savedViewMode), 0);
		return () => clearTimeout(timer);
	}, []);

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
	// load english_words.json once
	useEffect(() => {
		async function loadWordList() {
			try {
				const res = await fetch("/data/english_words.json");
				const data = await res.json();

				setWordList(data);
			} catch (err) {
				console.error(err);
			}
		}

		loadWordList();
	}, []);
	// create suggestions locally
	function handleEnglishChange(e) {
		const value = e.target.value;

		setEnglish(value);

		const search = value.trim().toLowerCase();

		if (search.length < 2) {
			setSuggestions([]);
			return;
		}

		const matches = wordList
			.filter((word) => word.startsWith(search))
			.slice(0, 6);

		setSuggestions(matches);
	}

	//  Get translation
	async function handleTranslateWord(word) {
		try {
			const res = await fetch(
				`/api/v1/dictionary/${encodeURIComponent(word)}`,
				{
					credentials: "include",
				},
			);

			if (!res.ok) return;

			const data = await res.json();

			setVietnamese(data.data.vietnamese || "");
			setExample(data.data.example || "");
			setPronunciation(data.data.pronunciation || "");
		} catch (err) {
			console.error(err);
		}
	}

	async function handleSelectWord(word) {
		setEnglish(word);
		setSuggestions([]);

		await handleTranslateWord(word);
	}

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
					pronunciation,
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
		<div className="min-h-screen px-4 py-6 font-sans text-slate-100 sm:px-8 sm:py-10">
			<div className="mx-auto w-full max-w-6xl space-y-6">
				<section className="relative overflow-hidden rounded-3xl border border-slate-700/70 bg-[#0c1525] p-6 shadow-[0_28px_80px_rgba(0,0,0,0.32)] sm:p-8">
					<div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#101b30] via-[#0b1726] to-[#07191d]" />
					<div className="pointer-events-none absolute -right-20 -top-28 h-80 w-80 rounded-full bg-emerald-400/10 blur-[100px]" />
					<div className="pointer-events-none absolute bottom-0 right-0 h-[72%] w-[75%] bg-[#0b1a2b]/75 [clip-path:polygon(0_100%,18%_58%,29%_73%,43%_34%,58%_67%,73%_18%,100%_65%,100%_100%)] sm:w-[62%]" />
					<div className="pointer-events-none absolute bottom-0 right-0 h-[58%] w-[82%] bg-[#081322]/90 [clip-path:polygon(0_100%,17%_53%,31%_76%,48%_40%,61%_68%,77%_28%,100%_63%,100%_100%)] sm:w-[68%]" />
					<div className="pointer-events-none absolute bottom-0 right-0 h-[38%] w-full bg-[#050c18] [clip-path:polygon(0_100%,0_80%,13%_48%,27%_72%,42%_34%,58%_69%,72%_38%,86%_61%,100%_30%,100%_100%)] sm:w-[78%]" />
					<div className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-emerald-400 via-emerald-500/60 to-transparent" />
					<div className="pointer-events-none absolute inset-x-10 bottom-0 h-px bg-gradient-to-r from-transparent via-emerald-400/35 to-transparent" />
					<div className="relative">
						<Link
							href="/wordlist"
							aria-label="Quay lại danh sách chủ đề"
							title="Quay lại"
							className="absolute right-0 top-0 grid h-11 w-11 place-items-center rounded-xl border border-slate-700/70 bg-slate-950/25 text-slate-400 transition hover:border-emerald-400/40 hover:bg-emerald-500/10 hover:text-emerald-300 sm:right-44"
						>
							<ArrowLeft size={18} />
						</Link>
						<p className="pr-14 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400 sm:pr-0">
							Bộ từ vựng của bạn
						</p>
						<h1 className="mt-2 pr-14 text-3xl font-bold tracking-tight text-white sm:pr-0 sm:text-4xl">
							Danh sách từ vựng
						</h1>
						<p className="mt-3 max-w-xl text-sm leading-6 text-slate-400 sm:text-base">
							Tìm từ, theo dõi tiến độ và bắt đầu ôn tập khi bạn sẵn sàng.
						</p>
						<button
							onClick={() => router.push(`/wordlist/${topicId}/learn`)}
							disabled={words.length === 0}
							className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-500 px-4 text-sm font-semibold text-emerald-950 shadow-[0_10px_30px_rgba(16,185,129,0.18)] transition hover:-translate-y-0.5 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40 sm:absolute sm:right-0 sm:top-0 sm:mt-0"
						>
							<RotateCcw size={18} />
							Bắt đầu học
						</button>

						<div className="mt-7 grid max-w-2xl grid-cols-2 gap-y-5 border-t border-slate-700/60 pt-5 sm:grid-cols-4 sm:gap-y-0">
							<div className="px-1 sm:pr-6">
								<p className="text-xl font-bold text-white">{words.length}</p>
								<p className="mt-0.5 text-xs text-slate-500">Tổng số từ</p>
							</div>
							<div className="border-l border-slate-700/60 pl-5 sm:px-6">
								<p className="text-xl font-bold text-emerald-300">{newWordCount}</p>
								<p className="mt-0.5 text-xs text-slate-500">Từ mới</p>
							</div>
							<div className="px-1 sm:border-l sm:border-slate-700/60 sm:px-6">
								<p className="text-xl font-bold text-sky-300">{learningWordCount}</p>
								<p className="mt-0.5 text-xs text-slate-500">Đang học</p>
							</div>
							<div className="border-l border-slate-700/60 pl-5 sm:px-6">
								<p className="text-xl font-bold text-amber-300">{reviewWordCount}</p>
								<p className="mt-0.5 text-xs text-slate-500">Cần ôn</p>
							</div>
						</div>
					</div>
				</section>

				{/* Search & Actions */}
				<div className="flex flex-col gap-3 rounded-2xl border border-slate-800/80 bg-[#0d1525]/80 p-3 shadow-lg sm:flex-row sm:items-center sm:justify-between sm:gap-4">
					{/* Search */}
					<div className="relative w-full sm:max-w-md sm:flex-1">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />

						<input
							type="text"
							value={search}
							onChange={(e) => {
								const params = new URLSearchParams(searchParams.toString());

								params.set("search", e.target.value);
								setCurrentPage(1);

								router.push(`?${params.toString()}`);
							}}
							placeholder="Tìm kiếm từ vựng..."
							className="w-full rounded-xl border border-slate-700/70 bg-[#080f1d] py-3 pl-10 pr-4 text-sm text-slate-200 outline-none transition placeholder:text-slate-600 focus:border-emerald-500/70 focus:ring-4 focus:ring-emerald-500/10"
						/>
					</div>

					<div className="flex w-full flex-wrap items-center gap-3 sm:w-auto sm:flex-nowrap">
						{/* Filter */}
						<div className="relative flex-1 sm:flex-none">
							<select
								value={status}
								onChange={(e) => {
									const params = new URLSearchParams(searchParams.toString());

									params.set("status", e.target.value);
									setCurrentPage(1);

									router.push(`?${params.toString()}`);
								}}
								className="w-full appearance-none rounded-xl border border-slate-700/70 bg-[#080f1d] py-3 pl-9 pr-8 text-sm text-slate-300 outline-none focus:border-emerald-500/70"
							>
								<option value="all">Tất cả</option>
								<option value="new">Mới</option>
								<option value="learning">Đang học</option>
								<option value="review">Cần ôn</option>
							</select>

							<Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
						</div>

						<div className="flex shrink-0 items-center rounded-xl border border-slate-700/70 bg-[#080f1d] p-1">
							<button
								type="button"
								onClick={() => handleViewModeChange("list")}
								aria-label="Hiển thị dạng danh sách"
								title="Danh sách"
								className={`rounded-lg p-2 transition-colors ${
									viewMode === "list"
										? "bg-emerald-500 text-emerald-950"
										: "text-slate-500 hover:bg-slate-800 hover:text-slate-200"
								}`}
							>
								<LayoutList className="h-4 w-4" />
							</button>

							<button
								type="button"
								onClick={() => handleViewModeChange("card")}
								aria-label="Hiển thị dạng thẻ"
								title="Thẻ"
								className={`rounded-lg p-2 transition-colors ${
									viewMode === "card"
										? "bg-emerald-500 text-emerald-950"
										: "text-slate-500 hover:bg-slate-800 hover:text-slate-200"
								}`}
							>
								<LayoutGrid className="h-4 w-4" />
							</button>
						</div>

						<div className="flex-1 sm:flex-none">
							<button
								onClick={() => setIsOpen(!isOpen)}
								className="min-h-11 flex-1 cursor-pointer whitespace-nowrap rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 text-sm font-semibold text-emerald-300 transition hover:border-emerald-400/50 hover:bg-emerald-500/15 hover:text-emerald-200 active:scale-[0.98] sm:flex-none"
							>
								+ Thêm từ mới
							</button>
						</div>

						{/* Form Modal */}
						{isOpen && (
							<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
								<form
									onSubmit={handleSubmit}
									className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl border border-violet-500/35 bg-[#0b1022] "
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
										<div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-violet-400/30 bg-violet-500/15 text-violet-300 ">
											<BookPlus className="h-6 w-6" />
										</div>
										<div className="mt-4 text-center">
											<h2 className="text-xl font-bold text-white sm:text-2xl">
												Thêm từ mới
											</h2>
											<p className="mt-1 text-sm text-slate-400">
												Bổ sung một từ mới vào danh sách của bạn.
											</p>
										</div>

										{/* nhập từ */}
										<div className="relative mt-6 flex flex-col gap-2">
											<label className="text-sm font-medium text-slate-300">
												Từ
											</label>
											<div className="relative">
												<Tag className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-violet-400" />
												<input
													type="text"
													name="word"
													value={english}
													onChange={handleEnglishChange}
													placeholder="Nhập từ bằng tiếng Anh"
													required
													autoComplete="off"
													className="w-full rounded-xl border border-slate-700/80 bg-[#080d1c] py-3 pl-10 pr-4 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10"
												/>
											</div>

											{suggestions.length > 0 && (
												<div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-violet-500/30 bg-[#11162a] shadow-xl shadow-violet-950/40">
													{suggestions.map((word) => (
														<button
															key={word}
															type="button"
															onClick={() => handleSelectWord(word)}
															className="block w-full px-4 py-2.5 text-left text-sm text-slate-300 transition hover:bg-violet-500/10 hover:text-white"
														>
															{word}
														</button>
													))}
												</div>
											)}
										</div>

										{/* nhập nghĩa */}
										<div className="mt-4 flex flex-col gap-2">
											<label className="text-sm font-medium text-slate-300">
												Bản dịch
											</label>
											<div className="relative">
												<Languages className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-violet-400" />
												<input
													type="text"
													name="translation"
													value={vietnamese}
													onChange={(e) => setVietnamese(e.target.value)}
													placeholder="Nhập bản dịch"
													required
													className="w-full rounded-xl border border-slate-700/80 bg-[#080d1c] py-3 pl-10 pr-4 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10"
												/>
											</div>
										</div>

										{/* nhập câu ví dụ */}
										<div className="mt-4 flex flex-col gap-2">
											<label className="text-sm font-medium text-slate-300">
												Câu ví dụ
											</label>
											<div className="relative">
												<NotebookText className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-violet-400" />
												<textarea
													name="example"
													value={example}
													onChange={(e) => setExample(e.target.value)}
													rows={3}
													placeholder="Nhập câu ví dụ (tùy chọn)"
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
											Thêm từ
										</button>
									</div>
								</form>
							</div>
						)}
					</div>
				</div>

				{/* Main Table Container */}
				<div
					className={
						viewMode === "list"
							? "overflow-hidden rounded-2xl border border-slate-800/80 bg-[#0b1220]/70 p-3 shadow-[0_20px_60px_rgba(0,0,0,0.18)] sm:p-4"
							: ""
					}
				>
					{/* table Header */}
					{viewMode === "list" && (
						<div className="hidden grid-cols-12 items-center border-b border-slate-800/70 px-5 pb-4 pt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 md:grid">
							<div className="col-span-2">Từ</div>
							<div className="col-span-2">IPA</div>
							<div className="col-span-2">Nghĩa</div>
							<div className="col-span-3">Ví dụ</div>
							<div className="col-span-2">Trạng thái</div>
							<div className="col-span-1 text-right">Thao tác</div>
						</div>
					)}

					{/* Word */}
					{words.length === 0 ? (
						<div className="py-16 text-center">
							<div className="mb-4 text-4xl">📚</div>

							<h3 className="text-xl font-semibold text-white">
								Chưa có từ nào
							</h3>

							<p className="mt-2 text-md text-slate-400">
								Thêm từ đầu tiên để bắt đầu học.
							</p>
						</div>
					) : filteredWords.length === 0 ? (
						<div className="py-16 text-center">
							<div className="mb-4 text-4xl">🔎</div>

							<h3 className="text-xl font-semibold text-white">
								Không tìm thấy từ phù hợp
							</h3>

							<p className="mt-2 text-md text-slate-400">
								Thử chọn bộ lọc khác hoặc thay đổi từ khóa tìm kiếm.
							</p>
						</div>
					) : (
						<div
							className={
								viewMode === "list"
									? "mt-3 space-y-3 md:space-y-2"
									: "grid grid-cols-1 gap-4 md:grid-cols-2"
							}
						>
							{currentWords.map((word) => (
								<Word
									key={word._id}
									word={word}
									onDelete={handleDelete}
									onFix={handleFix}
									variant={viewMode}
								/>
							))}
						</div>
					)}
					{/* Pagination */}
					<div className="mt-5 flex items-center justify-between border-t border-slate-800/60 px-1 pt-4 text-xs text-slate-400 md:px-2">
						<span>
							{filteredWords.length} từ · Trang {currentPage}/{totalPages}
						</span>

						<div className="flex gap-2">
							<button
								onClick={() => setCurrentPage((page) => page - 1)}
								disabled={currentPage === 1}
								className="px-3 py-2 rounded-lg border border-slate-700 bg-slate-900 text-slate-300 transition-all hover:bg-slate-800 hover:text-white hover:border-slate-600 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-slate-900 disabled:hover:text-slate-300"
							>
								Trước
							</button>

							<button
								onClick={() => setCurrentPage((page) => page + 1)}
								disabled={currentPage === totalPages}
								className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-emerald-300 transition hover:border-emerald-400 hover:bg-emerald-500 hover:text-emerald-950 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-emerald-500/25 disabled:hover:bg-emerald-500/10 disabled:hover:text-emerald-300"
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
