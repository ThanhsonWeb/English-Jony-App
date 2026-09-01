"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
	AlertCircle,
	BookmarkPlus,
	Check,
	LoaderCircle,
	Search,
} from "lucide-react";
import { useAuth } from "@/app/_contexts/AuthContext";
import {
	vocabularyCategories,
	vocabularyData,
} from "./_data/vocabularyData";

const normalizeWord = (value = "") => value.trim().toLocaleLowerCase("en");

export default function VocabularyPage() {
	const { user, loading: authLoading } = useAuth();
	const [search, setSearch] = useState("");
	const [activeCategory, setActiveCategory] = useState("all");
	const [topics, setTopics] = useState([]);
	const [selectedTopicId, setSelectedTopicId] = useState("");
	const [savedWords, setSavedWords] = useState(() => new Set());
	const [savingWords, setSavingWords] = useState(() => new Set());
	const [libraryLoading, setLibraryLoading] = useState(true);
	const [saveMessage, setSaveMessage] = useState("");
	const [loadError, setLoadError] = useState("");

	useEffect(() => {
		let cancelled = false;

		async function loadLibraryData() {
			if (authLoading) return;

			if (!user) {
				setLibraryLoading(false);
				return;
			}

			setLibraryLoading(true);
			setLoadError("");

			try {
				const [topicsResponse, wordsResponse] = await Promise.all([
					fetch("/api/v1/topics", { credentials: "include" }),
					fetch("/api/v1/vocab", { credentials: "include" }),
				]);

				if (!topicsResponse.ok || !wordsResponse.ok) {
					throw new Error("Library request failed");
				}

				const [topicsData, wordsData] = await Promise.all([
					topicsResponse.json(),
					wordsResponse.json(),
				]);

				if (cancelled) return;

				const loadedTopics = topicsData.data?.topics || [];
				const loadedWords = wordsData.data?.vocabularies || [];

				setTopics(loadedTopics);
				setSelectedTopicId(
					(currentId) => currentId || loadedTopics[0]?._id || "",
				);
				setSavedWords(
					new Set(loadedWords.map((item) => normalizeWord(item.english))),
				);
			} catch {
				if (!cancelled) {
					setLoadError("Không thể tải sổ tay. Vui lòng thử lại sau.");
				}
			} finally {
				if (!cancelled) setLibraryLoading(false);
			}
		}

		loadLibraryData();

		return () => {
			cancelled = true;
		};
	}, [authLoading, user]);

	const filteredWords = useMemo(() => {
		const normalizedSearch = search.trim().toLocaleLowerCase("vi");

		return vocabularyData.filter((item) => {
			const matchesCategory =
				activeCategory === "all" || item.category === activeCategory;
			const matchesSearch =
				!normalizedSearch ||
				item.word.toLocaleLowerCase("en").includes(normalizedSearch) ||
				item.translation.toLocaleLowerCase("vi").includes(normalizedSearch);

			return matchesCategory && matchesSearch;
		});
	}, [activeCategory, search]);

	async function saveWord(item) {
		const wordKey = normalizeWord(item.word);

		if (!selectedTopicId || savedWords.has(wordKey) || savingWords.has(wordKey)) {
			return;
		}

		setSaveMessage("");
		setSavingWords((current) => new Set(current).add(wordKey));

		try {
			const response = await fetch("/api/v1/vocab", {
				method: "POST",
				credentials: "include",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					english: item.word,
					vietnamese: item.translation,
					pronunciation: item.pronunciation || "",
					example: item.example || "",
					topic: selectedTopicId,
				}),
			});

			if (!response.ok) throw new Error("Save request failed");

			setSavedWords((current) => new Set(current).add(wordKey));
			setSaveMessage(`Đã lưu “${item.word}” vào sổ tay.`);
		} catch {
			setSaveMessage(`Không thể lưu “${item.word}”. Vui lòng thử lại.`);
		} finally {
			setSavingWords((current) => {
				const next = new Set(current);
				next.delete(wordKey);
				return next;
			});
		}
	}

	return (
		<main className="min-h-[calc(100vh-80px)] bg-[#030616] px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
			<div className="mx-auto max-w-7xl">
				<section className="max-w-3xl">
					<p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-blue-400">
						Khám phá từ mới
					</p>
					<h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
						Từ vựng tiếng Anh
					</h1>
					<p className="mt-3 max-w-2xl text-base leading-7 text-slate-400">
						Học những từ vựng phổ biến theo chủ đề và lưu chúng vào sổ tay
						của bạn.
					</p>

					<label className="relative mt-6 block max-w-2xl">
						<span className="sr-only">Tìm kiếm từ vựng</span>
						<Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
						<input
							type="search"
							value={search}
							onChange={(event) => setSearch(event.target.value)}
							placeholder="Tìm kiếm từ vựng..."
							className="h-12 w-full rounded-xl border border-slate-700 bg-slate-900/70 pl-12 pr-4 text-base text-white outline-none transition placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
						/>
					</label>
				</section>

				<section className="mt-7" aria-label="Bộ lọc chủ đề">
					<div className="flex flex-wrap gap-2">
						{vocabularyCategories.map((category) => {
							const isActive = activeCategory === category.id;

							return (
								<button
									key={category.id}
									type="button"
									onClick={() => setActiveCategory(category.id)}
									aria-pressed={isActive}
									className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
										isActive
											? "border-blue-500 bg-blue-600 text-white shadow-[0_0_18px_rgba(59,130,246,0.25)]"
											: "border-slate-700 bg-slate-900/60 text-slate-300 hover:border-slate-600 hover:text-white"
									}`}
								>
									{category.label}
								</button>
							);
						})}
					</div>
				</section>

				<section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/40 p-4 sm:flex sm:items-center sm:justify-between sm:gap-5">
					<div>
						<p className="font-semibold text-white">Lưu vào sổ tay</p>
						<p className="mt-1 text-sm text-slate-400">
							Chọn danh sách bạn muốn dùng trước khi lưu từ.
						</p>
					</div>

					<div className="mt-3 sm:mt-0 sm:min-w-64">
						{authLoading || libraryLoading ? (
							<div className="flex h-11 items-center gap-2 text-sm text-slate-400">
								<LoaderCircle className="h-4 w-4 animate-spin" />
								Đang tải sổ tay...
							</div>
						) : !user ? (
							<Link
								href="/login"
								className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-500"
							>
								Đăng nhập để lưu từ
							</Link>
						) : topics.length > 0 ? (
							<label>
								<span className="sr-only">Chọn sổ tay</span>
								<select
									value={selectedTopicId}
									onChange={(event) => setSelectedTopicId(event.target.value)}
									className="h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none focus:border-blue-500"
								>
									{topics.map((topic) => (
										<option key={topic._id} value={topic._id}>
											{topic.name}
										</option>
									))}
								</select>
							</label>
						) : (
							<Link
								href="/wordlist"
								className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-blue-500/50 bg-blue-500/10 px-4 text-sm font-semibold text-blue-300 transition hover:bg-blue-500/20"
							>
								Tạo sổ tay trước
							</Link>
						)}
					</div>
				</section>

				{(loadError || saveMessage) && (
					<p
						role="status"
						className={`mt-4 flex items-center gap-2 text-sm ${
							loadError || saveMessage.startsWith("Không thể")
								? "text-red-300"
								: "text-emerald-300"
						}`}
					>
						{(loadError || saveMessage.startsWith("Không thể")) && (
							<AlertCircle className="h-4 w-4 shrink-0" />
						)}
						{loadError || saveMessage}
					</p>
				)}

				<div className="mt-6 flex items-center justify-between gap-4">
					<h2 className="text-xl font-bold text-white">Từ vựng phổ biến</h2>
					<p className="text-sm text-slate-500">{filteredWords.length} từ</p>
				</div>

				{filteredWords.length > 0 ? (
					<div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{filteredWords.map((item) => {
							const wordKey = normalizeWord(item.word);
							const isSaved = savedWords.has(wordKey);
							const isSaving = savingWords.has(wordKey);
							const canSave = Boolean(user && selectedTopicId && !libraryLoading);

							return (
								<article
									key={`${item.category}-${item.word}`}
									className="flex min-h-72 flex-col rounded-2xl border border-slate-800 bg-slate-900/55 p-5 transition hover:-translate-y-0.5 hover:border-slate-700 hover:bg-slate-900/80"
								>
									<div>
										<h3 className="text-2xl font-bold tracking-tight text-white">
											{item.word}
										</h3>
										{item.pronunciation && (
											<p className="mt-1 text-sm text-slate-400">
												{item.pronunciation}
											</p>
										)}
										<p className="mt-5 text-lg font-semibold text-blue-300">
											{item.translation}
										</p>
										{item.example && (
											<p className="mt-3 leading-6 text-slate-300">
												{item.example}
											</p>
										)}
									</div>

									<button
										type="button"
										onClick={() => saveWord(item)}
										disabled={!canSave || isSaved || isSaving}
										className={`mt-auto inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition ${
											isSaved
												? "border border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
												: "bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow-[0_8px_24px_rgba(79,70,229,0.22)] hover:from-blue-500 hover:to-violet-500 disabled:cursor-not-allowed disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 disabled:shadow-none"
										}`}
									>
										{isSaving ? (
											<LoaderCircle className="h-4 w-4 animate-spin" />
										) : isSaved ? (
											<Check className="h-4 w-4" />
										) : (
											<BookmarkPlus className="h-4 w-4" />
										)}
										{isSaving
											? "Đang lưu..."
											: isSaved
												? "Đã lưu"
												: "+ Lưu vào sổ tay"}
									</button>
								</article>
							);
						})}
					</div>
				) : (
					<div className="mt-4 rounded-2xl border border-dashed border-slate-700 bg-slate-900/35 px-6 py-14 text-center">
						<p className="text-lg font-semibold text-white">
							Không tìm thấy từ phù hợp.
						</p>
						<p className="mt-2 text-sm text-slate-400">
							Thử tìm kiếm bằng từ khác.
						</p>
					</div>
				)}
			</div>
		</main>
	);
}
