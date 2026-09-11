"use client";

import {
	AlertCircle,
	BookOpen,
	BookmarkPlus,
	Check,
	LoaderCircle,
	Search,
	Volume2,
	X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { useAuth } from "@/app/_contexts/AuthContext";
import { Link } from "@/i18n/navigation";

const normalizeWord = (value = "") => value.trim().toLocaleLowerCase("en");
const MAX_SUGGESTIONS = 6;
let englishWordsPromise;

const subscribeToBrowserFeatures = () => () => {};
const getSpeechSynthesisSupport = () => "speechSynthesis" in window;
const getServerSpeechSynthesisSupport = () => false;

function loadEnglishWords() {
	if (!englishWordsPromise) {
		englishWordsPromise = fetch("/data/english_words.json")
			.then((response) => {
				if (!response.ok) throw new Error("Unable to load word suggestions");
				return response.json();
			})
			.then((words) => (Array.isArray(words) ? words : []))
			.catch(() => []);
	}

	return englishWordsPromise;
}

function findSuggestions(words, query) {
	const prefixMatches = [];
	const otherMatches = [];

	for (const word of words) {
		const normalizedWord = normalizeWord(word);
		if (normalizedWord.startsWith(query)) {
			prefixMatches.push(word);
		} else if (
			otherMatches.length < MAX_SUGGESTIONS &&
			normalizedWord.includes(query)
		) {
			otherMatches.push(word);
		}

		if (prefixMatches.length >= MAX_SUGGESTIONS) break;
	}

	return [...prefixMatches, ...otherMatches].slice(0, MAX_SUGGESTIONS);
}

function HighlightedSuggestion({ word, query }) {
	const matchStart = normalizeWord(word).indexOf(normalizeWord(query));
	if (matchStart < 0) return word;

	const matchEnd = matchStart + query.trim().length;
	return (
		<>
			{word.slice(0, matchStart)}
			<span className="rounded bg-primary-soft px-0.5 font-semibold text-primary">
				{word.slice(matchStart, matchEnd)}
			</span>
			{word.slice(matchEnd)}
		</>
	);
}

export default function MiniDictionary() {
	const t = useTranslations("MiniDictionary");
	const { user, loading: authLoading } = useAuth();
	const containerRef = useRef(null);
	const searchAreaRef = useRef(null);
	const suggestionsListRef = useRef(null);
	const inputRef = useRef(null);
	const audioRef = useRef(null);
	const speechRef = useRef(null);
	const requestIdRef = useRef(0);
	const libraryUserRef = useRef(null);
	const suggestionsOpenRef = useRef(false);
	const skipAutocompleteRef = useRef(false);
	const [isOpen, setIsOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [result, setResult] = useState(null);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState("");
	const [topics, setTopics] = useState([]);
	const [savedWords, setSavedWords] = useState(() => new Set());
	const [isLibraryLoading, setIsLibraryLoading] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [saveError, setSaveError] = useState("");
	const [isPronunciationPlaying, setIsPronunciationPlaying] = useState(false);
	const [suggestions, setSuggestions] = useState([]);
	const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);
	const [highlightedSuggestion, setHighlightedSuggestion] = useState(-1);
	const canUseSpeechSynthesis = useSyncExternalStore(
		subscribeToBrowserFeatures,
		getSpeechSynthesisSupport,
		getServerSpeechSynthesisSupport,
	);

	useEffect(() => {
		suggestionsOpenRef.current = isSuggestionsOpen;
	}, [isSuggestionsOpen]);

	useEffect(() => {
		return () => {
			window.speechSynthesis?.cancel();
			if (!audioRef.current) return;
			audioRef.current.pause();
			audioRef.current.onplay = null;
			audioRef.current.onpause = null;
			audioRef.current.onended = null;
			audioRef.current.onerror = null;
		};
	}, []);

	useEffect(() => {
		if (highlightedSuggestion < 0) return;

		suggestionsListRef.current?.children[
			highlightedSuggestion
		]?.scrollIntoView({ block: "nearest" });
	}, [highlightedSuggestion]);

	useEffect(() => {
		if (!isOpen) return undefined;

		const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 0);

		function handlePointerDown(event) {
			if (
				suggestionsOpenRef.current &&
				!searchAreaRef.current?.contains(event.target)
			) {
				setIsSuggestionsOpen(false);
				setHighlightedSuggestion(-1);
			}

			if (!containerRef.current?.contains(event.target)) setIsOpen(false);
		}

		function handleKeyDown(event) {
			if (event.key !== "Escape") return;

			if (suggestionsOpenRef.current) {
				setIsSuggestionsOpen(false);
				setHighlightedSuggestion(-1);
			} else {
				setIsOpen(false);
			}
		}

		document.addEventListener("pointerdown", handlePointerDown);
		window.addEventListener("keydown", handleKeyDown);

		return () => {
			window.clearTimeout(focusTimer);
			document.removeEventListener("pointerdown", handlePointerDown);
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, [isOpen]);

	useEffect(() => {
		if (!isOpen) return undefined;
		if (skipAutocompleteRef.current) {
			skipAutocompleteRef.current = false;
			return undefined;
		}

		const normalizedQuery = normalizeWord(query);
		if (normalizedQuery.length < 2) return undefined;

		let cancelled = false;
		const debounceTimer = window.setTimeout(async () => {
			const words = await loadEnglishWords();
			if (cancelled) return;

			const nextSuggestions = findSuggestions(words, normalizedQuery);
			setSuggestions(nextSuggestions);
			setIsSuggestionsOpen(nextSuggestions.length > 0);
			setHighlightedSuggestion(-1);
		}, 200);

		return () => {
			cancelled = true;
			window.clearTimeout(debounceTimer);
		};
	}, [isOpen, query]);

	useEffect(() => {
		if (!isOpen || authLoading || !user) return undefined;

		const userId = user._id || user.id;
		if (libraryUserRef.current === userId) return undefined;

		let cancelled = false;
		setIsLibraryLoading(true);

		async function loadLibrary() {
			try {
				const [topicsResponse, wordsResponse] = await Promise.all([
					fetch("/api/v1/topics", { credentials: "include" }),
					fetch("/api/v1/vocab", { credentials: "include" }),
				]);

				if (!topicsResponse.ok || !wordsResponse.ok) return;

				const [topicsData, wordsData] = await Promise.all([
					topicsResponse.json(),
					wordsResponse.json(),
				]);

				if (cancelled) return;
				setTopics(topicsData.data?.topics || []);
				setSavedWords(
					new Set(
						(wordsData.data?.vocabularies || []).map((item) =>
							normalizeWord(item.english),
						),
					),
				);
				libraryUserRef.current = userId;
			} finally {
				if (!cancelled) setIsLibraryLoading(false);
			}
		}

		loadLibrary();
		return () => {
			cancelled = true;
		};
	}, [authLoading, isOpen, user]);

	function closePanel() {
		audioRef.current?.pause();
		window.speechSynthesis?.cancel();
		setIsPronunciationPlaying(false);
		setIsSuggestionsOpen(false);
		setIsOpen(false);
	}

	async function lookupWord(word) {
		if (!word) {
			setResult(null);
			setError(t("enterWord"));
			return;
		}

		const requestId = ++requestIdRef.current;
		audioRef.current?.pause();
		window.speechSynthesis?.cancel();
		setIsPronunciationPlaying(false);
		setIsSuggestionsOpen(false);
		setHighlightedSuggestion(-1);
		setIsLoading(true);
		setError("");
		setSaveError("");

		try {
			const response = await fetch(
				`/api/v1/dictionary/${encodeURIComponent(word)}`,
				{ credentials: "include" },
			);
			const data = await response.json().catch(() => null);

			if (requestId !== requestIdRef.current) return;
			if (!response.ok) throw new Error(data?.message || t("lookupError"));

			const nextResult = data?.data;
			if (!nextResult?.vietnamese && !nextResult?.pronunciation) {
				throw new Error(t("notFound"));
			}

			setResult(nextResult);
		} catch (lookupError) {
			if (requestId === requestIdRef.current) {
				setResult(null);
				setError(lookupError.message || t("lookupError"));
			}
		} finally {
			if (requestId === requestIdRef.current) setIsLoading(false);
		}
	}

	function handleSearch(event) {
		event.preventDefault();
		lookupWord(query.trim());
	}

	function handleQueryChange(event) {
		setQuery(event.target.value);
		setSuggestions([]);
		setIsSuggestionsOpen(false);
		setHighlightedSuggestion(-1);
	}

	function selectSuggestion(word) {
		skipAutocompleteRef.current = true;
		setQuery(word);
		lookupWord(word);
	}

	function handleSearchKeyDown(event) {
		if (!isSuggestionsOpen || suggestions.length === 0) return;

		if (event.key === "ArrowDown") {
			event.preventDefault();
			setHighlightedSuggestion((current) =>
				current >= suggestions.length - 1 ? 0 : current + 1,
			);
		} else if (event.key === "ArrowUp") {
			event.preventDefault();
			setHighlightedSuggestion((current) =>
				current <= 0 ? suggestions.length - 1 : current - 1,
			);
		} else if (event.key === "Enter" && highlightedSuggestion >= 0) {
			event.preventDefault();
			selectSuggestion(suggestions[highlightedSuggestion]);
		}
	}

	function playPronunciation() {
		if (!result) return;

		if (!result.audioUrl && canUseSpeechSynthesis) {
			window.speechSynthesis.cancel();
			const speech = new SpeechSynthesisUtterance(result.english);
			speech.lang = "en-US";
			speech.rate = 0.85;
			speech.onstart = () => setIsPronunciationPlaying(true);
			speech.onend = () => setIsPronunciationPlaying(false);
			speech.onerror = () => setIsPronunciationPlaying(false);
			speechRef.current = speech;
			window.speechSynthesis.speak(speech);
			return;
		}

		if (!result.audioUrl) return;

		if (!audioRef.current || audioRef.current.src !== result.audioUrl) {
			audioRef.current?.pause();
			const audio = new Audio(result.audioUrl);
			audio.onplay = () => setIsPronunciationPlaying(true);
			audio.onpause = () => setIsPronunciationPlaying(false);
			audio.onended = () => setIsPronunciationPlaying(false);
			audio.onerror = () => setIsPronunciationPlaying(false);
			audioRef.current = audio;
		}

		audioRef.current.currentTime = 0;
		setIsPronunciationPlaying(true);
		audioRef.current
			.play()
			.catch(() => setIsPronunciationPlaying(false));
	}

	async function saveWord() {
		if (!user || !result || !topics[0] || isSaving) return;

		setIsSaving(true);
		setSaveError("");

		try {
			const response = await fetch("/api/v1/vocab", {
				method: "POST",
				credentials: "include",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					english: result.english,
					vietnamese: result.vietnamese,
					pronunciation: result.pronunciation || "",
					example: result.example || "",
					topic: topics[0]._id,
				}),
			});

			if (!response.ok) throw new Error(t("saveError"));

			setSavedWords((current) =>
				new Set([...current, normalizeWord(result.english)]),
			);
		} catch (wordError) {
			setSaveError(wordError.message || t("saveError"));
		} finally {
			setIsSaving(false);
		}
	}

	const isSaved = result
		? savedWords.has(normalizeWord(result.english))
		: false;

	return (
		<div
			ref={containerRef}
			className="fixed bottom-[calc(env(safe-area-inset-bottom)+1rem)] right-4 z-[80] sm:bottom-6 sm:right-6"
		>
			{isOpen && (
				<>
					<button
						type="button"
						aria-label={t("close")}
						onClick={closePanel}
						className="fixed inset-0 cursor-default bg-black/10 backdrop-blur-[2px]"
					/>
					<section
						aria-label={t("title")}
						className="mini-dictionary-panel fixed inset-x-4 bottom-4 z-10 max-h-[82vh] overflow-y-auto rounded-3xl border border-app bg-surface p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] text-main sm:absolute sm:inset-auto sm:bottom-16 sm:right-12 sm:flex sm:min-h-[480px] sm:max-h-[70vh] sm:w-[390px] sm:flex-col sm:rounded-2xl sm:p-5"
					>
					<div className="flex items-center justify-between gap-4">
						<div className="flex items-center gap-2.5">
							<span className="grid h-9 w-9 place-items-center rounded-xl bg-primary-soft text-primary">
								<BookOpen className="h-5 w-5" />
							</span>
							<h2 className="font-bold">{t("title")}</h2>
						</div>
						<button
							type="button"
							onClick={closePanel}
							aria-label={t("close")}
							className="grid h-9 w-9 place-items-center rounded-xl text-secondary transition hover:bg-surface-muted hover:text-main"
						>
							<X className="h-5 w-5" />
						</button>
					</div>

					<form onSubmit={handleSearch} className="mt-4 flex gap-2">
						<div ref={searchAreaRef} className="relative min-w-0 flex-1">
							<label>
								<span className="sr-only">{t("searchLabel")}</span>
								<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
								<input
									ref={inputRef}
									value={query}
									onChange={handleQueryChange}
									onFocus={() => {
										if (query.trim().length >= 2 && suggestions.length > 0) {
											setIsSuggestionsOpen(true);
										}
									}}
									onKeyDown={handleSearchKeyDown}
									placeholder={t("placeholder")}
									role="combobox"
									aria-autocomplete="list"
									aria-controls="mini-dictionary-suggestions"
									aria-expanded={isSuggestionsOpen}
									aria-activedescendant={
										highlightedSuggestion >= 0
											? `mini-dictionary-suggestion-${highlightedSuggestion}`
											: undefined
									}
									className="h-11 w-full rounded-xl border border-app bg-page pl-10 pr-3 text-sm text-main outline-none transition placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/15"
								/>
							</label>

							{isSuggestionsOpen && (
								<ul
									ref={suggestionsListRef}
									id="mini-dictionary-suggestions"
									role="listbox"
									className={`absolute inset-x-0 top-full z-30 mt-2 max-h-[176px] overscroll-contain rounded-lg border border-app bg-surface p-1.5 shadow-[0_14px_32px_rgba(2,6,23,0.38)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
										suggestions.length > 4
											? "overflow-y-auto"
											: "overflow-y-hidden"
									}`}
								>
									{suggestions.map((word, index) => (
										<li
											key={word}
											id={`mini-dictionary-suggestion-${index}`}
											role="option"
											aria-selected={highlightedSuggestion === index}
										>
											<button
												type="button"
												onClick={() => selectSuggestion(word)}
												onMouseEnter={() => setHighlightedSuggestion(index)}
												className={`flex h-10 w-full cursor-pointer items-center rounded-md px-3 text-left text-sm text-main transition ${
													highlightedSuggestion === index
														? "bg-primary-soft"
														: "hover:bg-surface-muted"
												}`}
											>
												<HighlightedSuggestion word={word} query={query} />
											</button>
										</li>
									))}
								</ul>
							)}
						</div>
						<button
							type="submit"
							disabled={isLoading}
							className="h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:cursor-wait disabled:opacity-60"
						>
							{t("search")}
						</button>
					</form>

					<div
						className="mt-4 min-h-28 sm:flex sm:flex-1 sm:flex-col"
						aria-live="polite"
					>
						{isLoading ? (
							<div className="flex min-h-28 items-center justify-center gap-2 text-sm text-secondary">
								<LoaderCircle className="h-4 w-4 animate-spin" />
								{t("loading")}
							</div>
						) : error ? (
							<div className="flex min-h-28 items-center justify-center gap-2 rounded-xl bg-red-500/10 px-4 text-center text-sm text-red-400">
								<AlertCircle className="h-4 w-4 shrink-0" />
								{error}
							</div>
						) : result ? (
							<div className="rounded-2xl border border-app bg-page p-4">
								<div>
									<div className="min-w-0">
										<div className="flex flex-wrap items-center gap-2">
											<h3 className="text-xl font-bold capitalize">{result.english}</h3>
							{(result.audioUrl || canUseSpeechSynthesis) && (
												<button
													type="button"
													onClick={playPronunciation}
													aria-label={t("play", { word: result.english })}
													aria-pressed={isPronunciationPlaying}
													className={`grid h-8 w-8 shrink-0 cursor-pointer place-items-center rounded-lg transition ${
														isPronunciationPlaying
															? "bg-primary text-white"
															: "bg-primary-soft text-primary hover:bg-primary/15"
													}`}
												>
													<Volume2 className="h-4 w-4" />
												</button>
											)}
											{result.partOfSpeech && (
												<span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary">
													{result.partOfSpeech}
												</span>
											)}
										</div>
										{result.pronunciation && (
											<p className="mt-1 font-mono text-sm text-secondary">
												{result.pronunciation}
											</p>
										)}
									</div>
								</div>

								<p className="mt-3 font-semibold text-primary">{result.vietnamese}</p>

								{result.example && (
									<div className="mt-4 border-t border-app pt-3">
										<p className="text-sm leading-6 text-main">{result.example}</p>
										{result.exampleVietnamese && (
											<p className="mt-1 text-sm leading-6 text-secondary">
												{result.exampleVietnamese}
											</p>
										)}
									</div>
								)}

								<div className="mt-4">
									{!authLoading && !user ? (
										<Link
											href="/login"
											className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
										>
											{t("signInToSave")}
										</Link>
									) : user && !isLibraryLoading && topics.length === 0 ? (
										<Link
											href="/wordlist"
											className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
										>
											{t("createList")}
										</Link>
									) : user ? (
										<button
											type="button"
											onClick={saveWord}
											disabled={isSaved || isSaving || isLibraryLoading}
											className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-3.5 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:cursor-default disabled:opacity-60"
										>
											{isSaving ? (
												<LoaderCircle className="h-4 w-4 animate-spin" />
											) : isSaved ? (
												<Check className="h-4 w-4" />
											) : (
												<BookmarkPlus className="h-4 w-4" />
											)}
											{isSaved ? t("saved") : t("save")}
										</button>
									) : null}
									{saveError && (
										<p className="mt-2 text-xs text-red-400">{saveError}</p>
									)}
								</div>
							</div>
						) : (
							<div className="flex min-h-28 flex-col items-center justify-center text-center text-sm text-secondary sm:flex-1 sm:justify-start sm:pt-14">
								<BookOpen className="mb-2 h-6 w-6 text-primary" />
								{t("empty")}
							</div>
						)}
					</div>
					</section>
				</>
			)}

			<button
				type="button"
				onClick={() => setIsOpen((open) => !open)}
				aria-label={t("toggle")}
				aria-expanded={isOpen}
				className="mini-dictionary-launcher relative z-10 grid h-12 w-12 cursor-pointer place-items-center rounded-full border border-primary/40 bg-primary text-white outline-none transition duration-200 hover:-translate-y-1 hover:scale-105 hover:bg-primary-hover active:translate-y-0 active:scale-95 focus-visible:ring-2 focus-visible:ring-primary/30"
			>
				{isOpen ? <X className="h-5 w-5" /> : <BookOpen className="h-5 w-5" />}
			</button>
		</div>
	);
}
