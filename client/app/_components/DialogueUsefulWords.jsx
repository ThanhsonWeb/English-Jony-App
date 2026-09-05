"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
	AlertCircle,
	ArrowRight,
	BookmarkPlus,
	Check,
	LoaderCircle,
	LogIn,
} from "lucide-react";

import { useAuth } from "@/app/_contexts/AuthContext";

const normalizeWord = (value = "") => value.trim().toLocaleLowerCase("en");

export default function DialogueUsefulWords({
	words: sourceWords,
	lessonId,
	dialogueTitle,
}) {
	const router = useRouter();
	const { user, loading: authLoading } = useAuth();
	const isSubmittingRef = useRef(false);
	const words = useMemo(() => {
		const uniqueWords = new Map();

		for (const item of sourceWords || []) {
			const key = normalizeWord(item.word);
			if (key && !uniqueWords.has(key)) uniqueWords.set(key, item);
		}

		return [...uniqueWords.values()];
	}, [sourceWords]);
	const [selectedWords, setSelectedWords] = useState(
		() => new Set(words.map((item) => normalizeWord(item.word))),
	);
	const [savedWords, setSavedWords] = useState(() => new Set());
	const [topics, setTopics] = useState([]);
	const [selectedTopicId, setSelectedTopicId] = useState("");
	const [libraryLoading, setLibraryLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);
	const [error, setError] = useState("");
	const [savedCount, setSavedCount] = useState(null);
	const lessonHref = `/dialogue/${lessonId}`;

	useEffect(() => {
		let cancelled = false;

		async function loadLibrary() {
			if (authLoading) return;

			if (!user) {
				setLibraryLoading(false);
				return;
			}

			setLibraryLoading(true);
			setError("");

			try {
				const [topicsResponse, wordsResponse] = await Promise.all([
					fetch("/api/v1/topics", { credentials: "include" }),
					fetch("/api/v1/vocab", { credentials: "include" }),
				]);

				if (!topicsResponse.ok || !wordsResponse.ok) {
					throw new Error("Không thể tải Sổ tay.");
				}

				const [topicsData, wordsData] = await Promise.all([
					topicsResponse.json(),
					wordsResponse.json(),
				]);

				if (cancelled) return;

				const loadedTopics = topicsData.data?.topics || [];
				const loadedWords = wordsData.data?.vocabularies || [];

				setTopics(loadedTopics);
				setSelectedTopicId(loadedTopics[0]?._id || "");
				setSavedWords(
					new Set(loadedWords.map((item) => normalizeWord(item.english))),
				);
			} catch (loadError) {
				if (!cancelled) {
					setError(loadError.message || "Không thể tải Sổ tay.");
				}
			} finally {
				if (!cancelled) setLibraryLoading(false);
			}
		}

		loadLibrary();

		return () => {
			cancelled = true;
		};
	}, [authLoading, user]);

	const selectableWords = words.filter(
		(item) => !savedWords.has(normalizeWord(item.word)),
	);
	const selectedUnsavedWords = selectableWords.filter((item) =>
		selectedWords.has(normalizeWord(item.word)),
	);
	const allWordsSaved =
		Boolean(user) && !libraryLoading && words.length > 0 && selectableWords.length === 0;

	function toggleWord(item) {
		const key = normalizeWord(item.word);
		if (savedWords.has(key) || isSaving) return;

		setSelectedWords((current) => {
			const next = new Set(current);
			if (next.has(key)) next.delete(key);
			else next.add(key);
			return next;
		});
	}

	async function saveSelectedWords() {
		if (isSubmittingRef.current || isSaving) return;

		if (!user || selectedUnsavedWords.length === 0) {
			router.push(lessonHref);
			return;
		}

		if (!selectedTopicId) return;

		isSubmittingRef.current = true;
		setIsSaving(true);
		setError("");

		try {
			const results = await Promise.allSettled(
				selectedUnsavedWords.map(async (item) => {
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

					if (!response.ok) throw new Error(`Không thể lưu “${item.word}”.`);
					return normalizeWord(item.word);
				}),
			);

			const savedKeys = results
				.filter((result) => result.status === "fulfilled")
				.map((result) => result.value);
			const failedCount = results.length - savedKeys.length;

			setSavedWords((current) => new Set([...current, ...savedKeys]));

			if (failedCount > 0) {
				setError(
					`Đã lưu ${savedKeys.length} từ, nhưng ${failedCount} từ chưa lưu được. Bạn có thể thử lại.`,
				);
			} else {
				setSavedCount(savedKeys.length);
			}
		} finally {
			isSubmittingRef.current = false;
			setIsSaving(false);
		}
	}

	if (savedCount !== null) {
		return (
			<main className="flex min-h-[calc(100vh-80px)] items-center justify-center bg-[#030616] px-4 py-10 text-white">
				<section className="relative w-full max-w-xl overflow-hidden rounded-[28px] border border-slate-800 bg-[#0a1224] p-7 text-center shadow-2xl sm:p-10">
					<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.14),transparent_55%)]" />
					<div className="relative">
						<div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-500/25 bg-emerald-500/10 text-emerald-300">
							<Check size={32} />
						</div>
						<h1 className="mt-5 text-2xl font-bold sm:text-3xl">
							Đã lưu {savedCount} từ vào Sổ tay 🎉
						</h1>
						<p className="mt-3 text-slate-400">
							Bạn có thể ôn lại những từ này bất cứ lúc nào.
						</p>
						<button
							type="button"
							onClick={() => router.push(lessonHref)}
							className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-6 py-3.5 font-semibold text-white transition hover:brightness-110"
						>
							Tiếp tục <ArrowRight size={18} />
						</button>
					</div>
				</section>
			</main>
		);
	}

	return (
		<main className="min-h-[calc(100vh-80px)] bg-[#030616] px-4 py-8 text-white sm:px-6 sm:py-10">
			<div className="mx-auto w-full max-w-3xl">
				<header className="text-center">
					<div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-blue-500/25 bg-blue-500/10 text-blue-300">
						<BookmarkPlus size={24} />
					</div>
					<p className="mt-5 text-sm font-semibold text-blue-400">{dialogueTitle}</p>
					<h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
						Từ vựng trong bài
					</h1>
					<p className="mx-auto mt-3 max-w-xl leading-7 text-slate-400">
						Chọn những từ bạn muốn lưu vào Sổ tay để ôn tập sau.
					</p>
				</header>

				{!authLoading && !user && (
					<div className="mt-7 rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 sm:flex sm:items-center sm:justify-between sm:gap-4">
						<div>
							<p className="font-semibold text-white">Đăng nhập để lưu từ</p>
							<p className="mt-1 text-sm text-slate-400">
								Bạn vẫn có thể xem các từ và bỏ qua bước này.
							</p>
						</div>
						<Link
							href="/login"
							className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-blue-300 sm:mt-0"
						>
							<LogIn size={16} /> Đăng nhập
						</Link>
					</div>
				)}

				{user && !libraryLoading && topics.length > 0 && selectableWords.length > 0 && (
					<label className="mt-7 block rounded-2xl border border-slate-800 bg-[#081123] p-4 sm:flex sm:items-center sm:justify-between sm:gap-5">
						<div>
							<p className="font-semibold text-white">Lưu vào danh sách</p>
							<p className="mt-1 text-sm text-slate-400">
								Chọn Sổ tay bạn muốn dùng.
							</p>
						</div>
						<select
							value={selectedTopicId}
							onChange={(event) => setSelectedTopicId(event.target.value)}
							className="mt-3 h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-white outline-none focus:border-blue-500 sm:mt-0 sm:w-64"
						>
							{topics.map((topic) => (
								<option key={topic._id} value={topic._id}>
									{topic.name}
								</option>
							))}
						</select>
					</label>
				)}

				{user && !libraryLoading && topics.length === 0 && (
					<div className="mt-7 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-200">
						Bạn chưa có danh sách từ. Hãy{" "}
						<Link href="/wordlist" className="font-semibold underline">
							tạo một danh sách trong Sổ tay
						</Link>{" "}
						trước khi lưu.
					</div>
				)}

				{error && (
					<div className="mt-5 flex items-start gap-3 rounded-xl border border-red-500/25 bg-red-500/10 p-4 text-sm text-red-200">
						<AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
						<p>{error}</p>
					</div>
				)}

				<div className="mt-7 space-y-3">
					{words.map((item) => {
						const key = normalizeWord(item.word);
						const isSaved = savedWords.has(key);
						const isSelected = selectedWords.has(key);

						return (
							<button
								type="button"
								key={key}
								onClick={() => toggleWord(item)}
								disabled={isSaved || isSaving}
								aria-pressed={isSaved || isSelected}
								className={`flex w-full items-start gap-4 rounded-2xl border p-4 text-left transition sm:p-5 ${
									isSaved
										? "cursor-default border-emerald-500/25 bg-emerald-500/8"
										: isSelected
											? "border-blue-500/50 bg-blue-500/10"
											: "border-slate-800 bg-[#081123] hover:border-slate-700"
								}`}
							>
								<span
									className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border ${
										isSaved
											? "border-emerald-500 bg-emerald-500 text-slate-950"
											: isSelected
												? "border-blue-500 bg-blue-500 text-white"
												: "border-slate-600 bg-slate-950"
									}`}
								>
									{(isSaved || isSelected) && <Check size={15} />}
								</span>

								<span className="min-w-0 flex-1">
									<span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
										<strong className="text-lg text-white">{item.word}</strong>
										{item.pronunciation && (
											<span className="font-mono text-sm text-blue-300">
												{item.pronunciation}
											</span>
										)}
										{isSaved && (
											<span className="ml-auto text-sm font-semibold text-emerald-300">
												✓ Đã lưu
											</span>
										)}
									</span>
									<span className="mt-1 block text-sm font-medium text-slate-300">
										{item.translation}
									</span>
									{item.example && (
										<span className="mt-2 block text-sm italic leading-6 text-slate-500">
											“{item.example}”
										</span>
									)}
								</span>
							</button>
						);
					})}
				</div>

				{(authLoading || libraryLoading) && user && (
					<div className="mt-5 flex items-center justify-center gap-2 text-sm text-slate-400">
						<LoaderCircle className="h-4 w-4 animate-spin" /> Đang kiểm tra Sổ tay...
					</div>
				)}

				{allWordsSaved && (
					<p className="mt-6 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-center text-sm text-emerald-300">
						✓ Tất cả từ trong bài đã có trong Sổ tay của bạn.
					</p>
				)}

				<div className="sticky bottom-0 mt-8 border-t border-slate-800 bg-[#030616]/95 py-4 backdrop-blur-md">
					<button
						type="button"
						onClick={saveSelectedWords}
						disabled={
							isSaving ||
							authLoading ||
							(Boolean(user) && libraryLoading) ||
							(Boolean(user) && selectedUnsavedWords.length > 0 && !selectedTopicId)
						}
						className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-6 py-4 font-semibold text-white shadow-lg shadow-blue-600/15 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45"
					>
						{isSaving ? (
							<>
								<LoaderCircle className="h-5 w-5 animate-spin" /> Đang lưu...
							</>
						) : selectedUnsavedWords.length > 0 && user ? (
							`Lưu ${selectedUnsavedWords.length} từ vào Sổ tay`
						) : (
							"Tiếp tục mà không lưu"
						)}
					</button>
					<button
						type="button"
						onClick={() => router.push(lessonHref)}
						disabled={isSaving}
						className="mt-2 w-full px-6 py-2.5 text-sm font-semibold text-slate-400 transition hover:text-white disabled:opacity-40"
					>
						Bỏ qua
					</button>
				</div>
			</div>
		</main>
	);
}
