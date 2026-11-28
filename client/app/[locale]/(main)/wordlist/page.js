"use client";
import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import {
	BookOpen,
	GraduationCap,
	CalendarDays,
	Plus,
	Search,
	Volume2,
	Pencil,
	Trash2,
	X,
	Check,
	ChevronDown,
	ChevronRight,
	Clock3,
	Filter,
	Sparkles,
	MessageCircle,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/app/_contexts/AuthContext";
import {
	getWordStatus,
	selectReviewWords,
	speakWord,
} from "@/app/_lib/vocabulary.mjs";
import { mutateVocabulary } from "@/app/_lib/vocabularyMutation.mjs";
import { WordDialog, DeleteDialog } from "./_components/WordDialogs";
import styles from "./wordlist.module.css";
import { splitExample } from "@/app/_lib/exampleHighlight.mjs";
import { useVocabularyResource } from "@/app/_lib/useStudyResources";
import { resolveWordlistFilter } from "@/app/_lib/wordlistFilter.mjs";
import { sourceKey, selectFilteredReviewWords } from "@/app/_lib/wordlistSourceFilter.mjs";
import { lessonData } from "../dialogue/_data/lessonData";
import { getLocalizedDialogueValue } from "@/app/_lib/dialogue/localization";

const statuses = ["all", "new", "learning", "review", "mastered"];
const WORDS_PER_PAGE = 10;
const reviewModes = [
	{ value: "flashcard", Icon: BookOpen },
	{ value: "quiz", Icon: GraduationCap },
	{ value: "write", Icon: Pencil },
];
const statusIcons = {
	new: Sparkles,
	learning: GraduationCap,
	review: Clock3,
	mastered: Check,
};

function StatusFilter({ value, onChange, t, options }) {
	const [isOpen, setIsOpen] = useState(false);
	const filterRef = useRef(null);

	useEffect(() => {
		if (!isOpen) return undefined;

		function closeOnPointerDown(event) {
			if (!filterRef.current?.contains(event.target)) setIsOpen(false);
		}

		function closeOnEscape(event) {
			if (event.key === "Escape") setIsOpen(false);
		}

		document.addEventListener("pointerdown", closeOnPointerDown);
		window.addEventListener("keydown", closeOnEscape);
		return () => {
			document.removeEventListener("pointerdown", closeOnPointerDown);
			window.removeEventListener("keydown", closeOnEscape);
		};
	}, [isOpen]);

	return (
		<div ref={filterRef} className={styles.statusFilter}>
			<button
				type="button"
				className={styles.statusTrigger}
				onClick={() => setIsOpen((open) => !open)}
				aria-expanded={isOpen}
				aria-haspopup="listbox"
				aria-label={t("topicFilter")}
			>
				<Filter aria-hidden="true" size={18} />
				<strong>{options.find(option => option.value === value)?.label || t("allTopics")}</strong>
				<ChevronDown
					aria-hidden="true"
					size={17}
					className={isOpen ? styles.chevronOpen : ""}
				/>
			</button>
			{isOpen && (
				<div
					className={styles.statusMenu}
					role="listbox"
					aria-label={t("topicFilter")}
				>
					{options.map(({ value: status, label }) => (
						<button
							type="button"
							role="option"
							aria-selected={value === status}
							key={status}
							onClick={() => {
								onChange(status);
								setIsOpen(false);
							}}
						>
							<span>{label}</span>
							{value === status && <Check aria-hidden="true" size={16} />}
						</button>
					))}
				</div>
			)}
		</div>
	);
}

export default function WordlistPage() {
	const t = useTranslations("Notebook");
	const locale = useLocale();
	const { user, loading: authLoading } = useAuth();
	const userId = user?._id || user?.id;
	const { data: cachedWords, error: loadError, loading: queryLoading, refresh } = useVocabularyResource(userId, undefined, !authLoading);
	const [search, setSearch] = useState("");
	const searchParams = useSearchParams();
	function setFilter(status) {
		const params = new URLSearchParams(searchParams.toString());
		params.set("status", status);
		window.history.replaceState(null, "", `?${params}${window.location.hash}`);
		setPage(1);
	}
	const [editor, setEditor] = useState(null);
	const [deleting, setDeleting] = useState(null);
	const [audioError, setAudioError] = useState(false);
	const [playingExample, setPlayingExample] = useState(null);
	const exampleUtteranceRef = useRef(null);
	useEffect(() => () => {
		if (exampleUtteranceRef.current) {
			exampleUtteranceRef.current.onend = null;
			exampleUtteranceRef.current.onerror = null;
		}
	}, []);
	function playExample(word) {
		if (!("speechSynthesis" in window)) { setAudioError(true); return; }
		window.speechSynthesis.cancel();
		const utterance = new SpeechSynthesisUtterance(word.example);
		utterance.lang = "en-US";
		exampleUtteranceRef.current = utterance;
		utterance.onstart = () => { if (exampleUtteranceRef.current === utterance) setPlayingExample(word._id); };
		utterance.onend = utterance.onerror = () => { if (exampleUtteranceRef.current === utterance) { exampleUtteranceRef.current = null; setPlayingExample(null); } };
		setPlayingExample(null);
		setAudioError(false);
		window.speechSynthesis.speak(utterance);
	}
	const [practiceOpen, setPracticeOpen] = useState(false);
	const practiceRef = useRef(null);
	const practiceDialogRef = useRef(null);
	const [page, setPage] = useState(1);
	useEffect(() => {
		const dialog = practiceDialogRef.current;
		if (!dialog) return;
		if (practiceOpen && !dialog.open) dialog.showModal();
		if (!practiceOpen && dialog.open) dialog.close();
	}, [practiceOpen]);
	const loading = authLoading || (Boolean(user) && queryLoading);
	const error = !loading && Boolean(user && loadError && cachedWords === undefined);
	const words = user ? cachedWords || [] : [];
	const now = new Date();
	const counts = Object.fromEntries(
		statuses.map((status) => [
			status,
			status === "all"
				? words.length
				: words.filter((word) => getWordStatus(word, now) === status).length,
		]),
	);
	const totalWords = counts.all;
	const activeFilter = resolveWordlistFilter(searchParams.get("status"), counts, loading);
	const [selectedSource, setSelectedSource] = useState("all");
	const sourceGroups = new Map();
	for (const word of words) {
		const key = sourceKey(word);
		const group = sourceGroups.get(key) || { count: 0, source: word.source };
		group.count++;
		sourceGroups.set(key, group);
	}
	const sourceOptions = [{ value: "all", label: t("allTopics") }, ...Array.from(sourceGroups, ([key, group]) => {
		const source = group.source;
		const dialogue = key !== "custom" ? lessonData[source.lessonId]?.dialogues?.find(item => item.id === source.dialogueId) : null;
		const title = key === "custom" ? t("customWords") : (dialogue ? getLocalizedDialogueValue(dialogue, "title", locale) : source.dialogueTitle || source.dialogueId);
		return { value: key, label: `${title} (${group.count})` };
	})];
	const selectedPair = selectedSource !== "all" && selectedSource !== "custom" ? JSON.parse(selectedSource) : null;
	const reviewFilters = { status: activeFilter, ...(selectedSource === "custom" ? { sourceType: "custom" } : selectedPair ? { lessonId: selectedPair[0], dialogueId: selectedPair[1] } : {}) };
	const explicitFilters = searchParams.has("status") || selectedSource !== "all";
	const selectedReviewWords = explicitFilters ? selectFilteredReviewWords(words, {}, reviewFilters) : null;
	const queue = selectReviewWords(words, { global: true, now });
	const practiceCount = selectedReviewWords ? selectedReviewWords.length : counts.review > 0
		? selectReviewWords(words, { global: true, dueOnly: true, now }).length
		: queue.length;
	const canQuiz =
		new Set(words.map((word) => word.vietnamese.trim().toLowerCase())).size >=
		4;
	const query = search.trim().toLocaleLowerCase();
	const filtered = words.filter(
		(word) =>
		(activeFilter === "all" || getWordStatus(word, now) === activeFilter) && (selectedSource === "all" || sourceKey(word) === selectedSource) &&
			[word.english, word.vietnamese, word.example, word.pronunciation].some(
				(value) => value?.toLocaleLowerCase().includes(query),
			),
	);
	const pages = Math.max(1, Math.ceil(filtered.length / WORDS_PER_PAGE));
	const currentPage = Math.min(page, pages);
	const firstVisiblePage = Math.max(1, Math.min(currentPage - 2, pages - 4));
	const pageNumbers = Array.from({ length: Math.min(pages, 5) }, (_, index) => firstVisiblePage + index);
	const firstMobilePage = Math.max(1, Math.min(currentPage - 1, pages - 2));
	const mobilePageNumbers = Array.from({ length: Math.min(pages, 3) }, (_, index) => firstMobilePage + index);
	if (!loading && !error && user && page > pages) setPage(pages);
	const visible = filtered.slice((currentPage - 1) * WORDS_PER_PAGE, currentPage * WORDS_PER_PAGE);
	async function saveWord(body) {
		const word = editor.word;
		await mutateVocabulary({ userId, id: word?._id, method: word ? "PATCH" : "POST", body,
			topicId: word?.topic?._id || word?.topic });
	}
	async function deleteWord(id) {
		const oldWord = words.find(word => word._id === id);
		await mutateVocabulary({ userId, id, method: "DELETE", topicId: oldWord?.topic?._id || oldWord?.topic });
	}
	return (
		<main className={styles.page}>
			<div className={styles.container}>
				<header className={styles.heroHeader}>
					<div className={styles.heroCopy}>
						<h1>{t("title")}</h1>
						<p>{t("subtitle")}</p>
					</div>
					<div className={styles.stats}>
						{[
							["total", counts.all, BookOpen, "all"],
							["learning", counts.learning, GraduationCap, "learning"],
							["dueToday", counts.review, CalendarDays, "review"],
						].map(([label, count, Icon, filter]) => (
							<button type="button" key={label} className={styles.stat} aria-pressed={activeFilter === filter} onClick={() => setFilter(filter)}>
								<svg className={styles.statWave} data-wave={label} viewBox="0 0 220 90" preserveAspectRatio="none" aria-hidden="true">
									<path d="M0 90C45 90 40 60 95 55S150 5 220 25V90Z" fill="currentColor" fillOpacity=".10" stroke="currentColor" strokeOpacity=".25" />
								</svg>
								<span className={styles.statIcon} data-tone={label}><Icon size={24} /></span>
								<span>
									<span className={styles.statLabel}>{t(label)}</span>
									<strong>{loading || error || !user ? "—" : count}</strong>
								</span>
							</button>
						))}
					</div>
				</header>
				<div className={styles.content}>
					<div className={styles.mainColumn}>
						{totalWords > 0 && (
						<div className={styles.toolbar}>
							<div className={styles.search}>
								<Search size={21} />
								<input
									aria-label={t("search")}
									placeholder={t("search")}
									value={search}
									onChange={(event) => {
										setSearch(event.target.value);
										setPage(1);
									}}
								/>
								{search && (
									<button onClick={() => setSearch("")} aria-label={t("clear")}>
										<X size={17} />
									</button>
								)}
							</div>
							<StatusFilter
								value={selectedSource}
								t={t}
								options={sourceOptions}
								onChange={(source) => {
									setSelectedSource(source);
									setPage(1);
								}}
							/>
							<div className={styles.mobileFilters} aria-label={t("status")}>
								{statuses.map((status) => (
									<button key={status} type="button" aria-pressed={activeFilter === status}
										onClick={() => { setFilter(status); setPage(1); }}>
										{t(status)}
									</button>
								))}
							</div>
							<button
								className={`${styles.secondary} ${styles.addButton}`}
								disabled={!user || loading || Boolean(error)}
								onClick={() => setEditor({ word: null })}
							>
								<Plus size={18} /> {t("addWord")}
							</button>
							<div ref={practiceRef} className={styles.practiceControl}>
								<button
									type="button"
									className={styles.practiceTrigger}
									aria-expanded={practiceOpen}
									aria-controls="wordlist-practice-menu"
									onClick={() => setPracticeOpen((open) => !open)}
								>
									<Sparkles size={18} aria-hidden="true" />
									{t("practice")}
								</button>
								<dialog ref={practiceDialogRef} id="wordlist-practice-menu" className={styles.practiceMenu} aria-labelledby="practice-title" onClose={() => { setPracticeOpen(false); practiceRef.current?.querySelector("button")?.focus(); }} onClick={(event) => { if (event.target === event.currentTarget) event.currentTarget.close(); }} onKeyDown={(event) => {
									if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.repeat || event.target.closest("input, textarea, select, [contenteditable='true']")) return;
									const mode = reviewModes[Number(event.key) - 1];
									if (!mode || !/^[1-3]$/.test(event.key)) return;
									const link = event.currentTarget.querySelector(`a[data-mode="${mode.value}"]`);
									if (link) { event.preventDefault(); link.click(); }
								}}>
										<div className={styles.practiceHeader}>
											<div><span className={styles.practiceChip}>{t("practiceModes")}</span><h2 id="practice-title">{t("practice")}</h2><p>{t("choosePracticeMode")}</p><span className={styles.practiceCount}>{t("wordsReady", { count: practiceCount })}</span></div>
											<button type="button" aria-label={t("close")} onClick={() => setPracticeOpen(false)}><X size={20} /></button>
										</div>
										<div className={styles.practiceGrid}>{reviewModes.map(({ value, Icon }, index) => {
											const available = practiceCount > 0 && (value !== "quiz" || canQuiz);
											const params = new URLSearchParams();
											if (explicitFilters) {
												if (activeFilter !== "all") params.set("status", activeFilter);
												if (reviewFilters.sourceType) params.set("sourceType", reviewFilters.sourceType);
												if (selectedPair) { params.set("lessonId", selectedPair[0]); params.set("dialogueId", selectedPair[1]); }
											} else if (counts.review > 0) params.set("reviewMode", "due");
											const href = `/wordlist/review/${value}${params.size ? `?${params}` : ""}`;
											const contents = (
												<>
																			<span className={styles.practiceKey} aria-hidden="true">{index + 1}</span>
															<span className={styles.practicePreview} aria-hidden="true">
																{value === "flashcard" ? <span className={styles.previewFlash}><small>ENGLISH</small><b>same team</b><small>{t("previewFlip")}</small></span> : value === "quiz" ? <span className={styles.previewQuiz}><b>same team</b><span>✓ {t("previewAnswer")}</span><span>○ {t("previewOther")}</span><span>○ {t("previewHome")}</span></span> : <span className={styles.previewWrite}><small>{t("previewMeaning")}</small><b>{t("previewAnswer")}</b><span>đ　 ộ　 i</span></span>}
															</span>
															<span className={styles.reviewModeHeading}><span className={styles.reviewModeIcon} aria-hidden="true"><Icon size={23} strokeWidth={1.9} /></span><span className={styles.reviewModeCopy}><strong>{t(value)}</strong><span className={styles.reviewTag}>{t(`${value}Tag`)}</span></span></span>
															<span className={styles.reviewDescription}>{t(`${value}Description`)}</span>
															<span className={styles.reviewFooter}>{t("practiceStart")}<span className={styles.reviewModeArrow}><ChevronRight size={19} aria-hidden="true" /></span></span>
												</>
											);
											return available ? (
												<Link key={value} href={href} className={styles.reviewMode} data-mode={value} onClick={() => setPracticeOpen(false)}>
													{contents}
												</Link>
											) : (
												<div key={value} className={`${styles.reviewMode} ${styles.reviewModeDisabled}`} data-mode={value} aria-disabled="true">
													{contents}
												</div>
											);
										})}</div>
										{queue.length > 0 && !canQuiz && <small className={styles.reviewHint}>{t("quizHelp")}</small>}
								</dialog>
							</div>
						</div>
						)}
						{audioError && <p role="alert">{t("audioError")}</p>}
						{loading ? (
							<div className={styles.empty} role="status">
								{t("loading")}
							</div>
						) : !user || error === "unauthorized" ? (
							<>
			<div className={`${styles.empty} ${styles.firstWordEmpty} ${styles.guestEmpty} ${styles.authDesktopEmpty}`}>
				<Image src="/wordlist-hero-2.png" alt="" width={300} height={200} className={styles.emptyImage} />
				<h2>{t("emptyTitle")}</h2>
				<p>{t("guestEmptyBody")}</p>
				<Link className={styles.primary} href="/dialogue"><MessageCircle size={18} />{t("learnFirstDialogue")}</Link>
				<Link className={styles.manualAdd} href="/login">{t("signInOrCreateAccount")}</Link>
			</div>
							<div className={`${styles.empty} ${styles.firstWordEmpty} ${styles.guestEmpty} ${styles.mobileAuthEmpty}`}>
								<Image src="/wordlist-hero-2.png" alt="" width={300} height={200} className={styles.emptyImage} />
								<h2>{t("emptyTitle")}</h2>
								<p>{t("guestEmptyBody")}</p>
								<Link className={styles.primary} href="/dialogue"><MessageCircle size={18} />{t("learnFirstDialogue")}</Link>
								<Link className={styles.manualAdd} href="/login">{t("signInOrCreateAccount")}</Link>
							</div>
							</>
						) : error ? (
							<div className={styles.empty} role="alert">
								<p>{t("loadError")}</p>
								<button
									className={styles.secondary}
									onClick={() => void refresh(true).catch(() => {})}
								>
									{t("retry")}
								</button>
							</div>
						) : !words.length ? (
							<div className={`${styles.empty} ${styles.firstWordEmpty} ${styles.emptyNotebook}`}>
								<Image src="/wordlist-hero-2.png" alt="" width={300} height={200} className={styles.emptyImage} />
								<h2><span className={styles.desktopEmptyCopy}>{t("emptyTitle")}</span><span className={styles.mobileEmptyCopy}>{locale === "en" ? "Your notebook is ready for its first word!" : t("emptyTitle")}</span></h2>
								<p>{t("emptyBody")}</p>
								<Link className={styles.primary} href="/dialogue"><MessageCircle size={18} />{t("learnFirstDialogue")}</Link>
								<button
									className={styles.manualAdd}
									onClick={() => setEditor({ word: null })}
								>
									<span aria-hidden="true">+ </span>{t("addManually")}
								</button>
							</div>
						) : !filtered.length ? (
							<div className={`${styles.empty} ${styles.filteredEmpty}`} role="status">
								<span className={styles.filteredEmptyIcon}><Sparkles size={24} aria-hidden="true" /></span>
								<h2>{t(activeFilter === "review" && !query ? "noDueWords" : "noResults")}</h2>
								<p>{t(activeFilter === "review" && !query ? "noDueWordsDescription" : "noResultsDescription")}</p>
								<div className={styles.filteredEmptyActions}>
									<button className={styles.secondary} onClick={() => { setSearch(""); setFilter("all"); setSelectedSource("all"); }}>{t("clear")}</button>
									<button className={styles.primary} onClick={() => { setSearch(""); setFilter("all"); setSelectedSource("all"); }}>{t("viewAllWords", { count: totalWords })}</button>
								</div>
							</div>
						) : (
							<>
								<div className={styles.tableWrap}>
									<table className={styles.table}>
										<caption className="sr-only">{t("title")}</caption>
										<thead>
											<tr>
												{[
													"word",
													"ipa",
													"meaning",
													"example",
													"status",
													"actions",
												].map((label) => (
													<th key={label} scope="col">
														{t(label)}
													</th>
												))}
											</tr>
										</thead>
										<tbody>
											{visible.map((word) => {
												const status = getWordStatus(word, now);
												const Icon = statusIcons[status];
												return (
													<tr key={word._id}>
														<th scope="row">
															<div className={styles.word}>
																<strong>{word.english}</strong>
																<button
																	onClick={() =>
																		setAudioError(!speakWord(word.english))
																	}
																	aria-label={t("audio", {
																		word: word.english,
																	})}
																>
																	<Volume2 size={19} />
																</button>
																					{word.pronunciation?.trim() && <span className={styles.mobileIpa}>{word.pronunciation}</span>}
															</div>
														</th>
														<td className={styles.ipa}>
																			{word.pronunciation?.trim() || <span className={styles.desktopIpaPlaceholder}>—</span>}
														</td>
														<td className={styles.meaning}>
															{word.vietnamese}
														</td>
														<td className={styles.example}>
																			{word.example && <button type="button" className={styles.exampleButton} data-playing={playingExample === word._id} onClick={() => playExample(word)} aria-label={t("audio", { word: word.example })}>
																<span className={styles.exampleIcon}><Volume2 size={17} aria-hidden="true" /></span>
																<span>
															{splitExample(word.example, word.english).map(
																(part, index) =>
																	part.matched ? (
																		<span
																			key={index}
																			className={styles.exampleMatch}
																		>
																			{part.text}
																		</span>
																	) : (
																		part.text
																	),
															)}
																</span>
															</button>}
														</td>
														<td className={styles.statusCell}>
															<span
																className={styles.badge}
																data-status={status}
															>
																<Icon size={14} />
																{t(status)}
															</span>
														</td>
														<td className={styles.actions}>
															<button
																onClick={() => setEditor({ word })}
																aria-label={`${t("edit")} ${word.english}`}
															>
																<Pencil size={17} />
															</button>
															<button
																onClick={() => setDeleting(word)}
																aria-label={`${t("remove")} ${word.english}`}
															>
																<Trash2 size={17} />
															</button>
														</td>
													</tr>
												);
											})}
										</tbody>
									</table>
								<nav className={styles.pagination} aria-label={t("paginationLabel")}>
									<div className={styles.paginationControls}>
										<button type="button" className={styles.paginationCircle} aria-label={t("firstPage")} disabled={currentPage === 1} onClick={() => setPage(1)}>«</button>
										<button type="button" className={styles.paginationText} disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>{t("previous")}</button>
										{pageNumbers.map(number => (
											<button key={number} type="button" className={`${styles.paginationCircle} ${styles.desktopPageNumber}`} aria-label={t("pageNumber", { number })} aria-current={number === currentPage ? "page" : undefined} onClick={() => setPage(number)}>{number}</button>
										))}
										{mobilePageNumbers.map(number => (
											<button key={`mobile-${number}`} type="button" className={`${styles.paginationCircle} ${styles.mobilePageNumber}`} aria-label={t("pageNumber", { number })} aria-current={number === currentPage ? "page" : undefined} onClick={() => setPage(number)}>{number}</button>
										))}
										<button type="button" className={styles.paginationText} disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>{t("next")}</button>
										<button type="button" className={styles.paginationCircle} aria-label={t("lastPage")} disabled={currentPage === pages} onClick={() => setPage(pages)}>»</button>
									</div>
									<span className={styles.paginationSummary} aria-live="polite">{t("pageSummary", { current: currentPage, total: pages, count: filtered.length })}</span>
								</nav>
								</div>
							</>
						)}
					</div>
				</div>
			</div>
			{editor && (
				<WordDialog
					word={editor.word}
					t={t}
					onClose={() => setEditor(null)}
					onSave={saveWord}
				/>
			)}
			{deleting && (
				<DeleteDialog
					word={deleting}
					t={t}
					onClose={() => setDeleting(null)}
					onDelete={deleteWord}
				/>
			)}
		</main>
	);
}
