"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
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
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/app/_contexts/AuthContext";
import {
	fetchVocabulary,
	getWordStatus,
	selectReviewWords,
	speakWord,
} from "@/app/_lib/vocabulary.mjs";
import { WordDialog, DeleteDialog } from "./_components/WordDialogs";
import styles from "./wordlist.module.css";
import { splitExample } from "@/app/_lib/exampleHighlight.mjs";

const statuses = ["all", "new", "learning", "review", "mastered"];
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

function StatusFilter({ value, onChange, t }) {
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
				aria-label={`${t("status")}: ${t(value)}`}
			>
				<Filter aria-hidden="true" size={18} />
				<strong>{t(value)}</strong>
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
					aria-label={t("status")}
				>
					{statuses.map((status) => (
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
							<span>{t(status)}</span>
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
	const { user, loading: authLoading } = useAuth();
	const [result, setResult] = useState(null);
	const [retry, setRetry] = useState(0);
	const [search, setSearch] = useState("");
	const [filter, setFilter] = useState("review");
	const [editor, setEditor] = useState(null);
	const [deleting, setDeleting] = useState(null);
	const [audioError, setAudioError] = useState(false);
	const [practiceOpen, setPracticeOpen] = useState(false);
	const practiceRef = useRef(null);
	const [page, setPage] = useState(1);
	useEffect(() => {
		if (!practiceOpen) return undefined;
		function closeOnPointerDown(event) {
			if (!practiceRef.current?.contains(event.target)) setPracticeOpen(false);
		}
		function closeOnEscape(event) {
			if (event.key === "Escape") {
				setPracticeOpen(false);
				practiceRef.current?.querySelector("button")?.focus();
			}
		}
		document.addEventListener("pointerdown", closeOnPointerDown);
		window.addEventListener("keydown", closeOnEscape);
		return () => {
			document.removeEventListener("pointerdown", closeOnPointerDown);
			window.removeEventListener("keydown", closeOnEscape);
		};
	}, [practiceOpen]);
	const userId = user?._id;
	const requestKey = `${userId || "guest"}:${retry}`;
	useEffect(() => {
		if (authLoading || !userId) return;
		const controller = new AbortController();
		fetchVocabulary(undefined, controller.signal)
			.then((words) => {
				if (!controller.signal.aborted) setResult({ key: requestKey, words });
			})
			.catch((error) => {
				if (!controller.signal.aborted)
					setResult({ key: requestKey, error: error.message });
			});
		return () => controller.abort();
	}, [authLoading, userId, requestKey]);
	const loading = authLoading || (user && result?.key !== requestKey);
	const error = !loading && user && result?.error;
	const words = !loading && user && !error ? result?.words || [] : [];
	const now = new Date();
	const counts = Object.fromEntries(
		statuses.map((status) => [
			status,
			status === "all"
				? words.length
				: words.filter((word) => getWordStatus(word, now) === status).length,
		]),
	);
	const activeFilter = !loading && filter === "review" && counts.review === 0
		? counts.new > 0 ? "new" : "all"
		: filter;
	const queue = selectReviewWords(words, { global: true, now });
	const canQuiz =
		new Set(words.map((word) => word.vietnamese.trim().toLowerCase())).size >=
		4;
	const query = search.trim().toLocaleLowerCase();
	const filtered = words.filter(
		(word) =>
		(activeFilter === "all" || getWordStatus(word, now) === activeFilter) &&
			[word.english, word.vietnamese, word.example, word.pronunciation].some(
				(value) => value?.toLocaleLowerCase().includes(query),
			),
	);
	const pages = Math.max(1, Math.ceil(filtered.length / 20));
	const currentPage = Math.min(page, pages);
	const visible = filtered.slice((currentPage - 1) * 20, currentPage * 20);
	async function saveWord(body) {
		const word = editor.word;
		const response = await fetch(`/api/v1/vocab${word ? `/${word._id}` : ""}`, {
			method: word ? "PATCH" : "POST",
			credentials: "include",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		});
		if (!response.ok) throw new Error("save");
		const { data } = await response.json();
		const saved = word ? data.updatedVocab : data.newVocab;
		setResult((previous) => ({
			...previous,
			words: word
				? previous.words.map((item) => (item._id === word._id ? saved : item))
				: [saved, ...previous.words],
		}));
	}
	async function deleteWord(id) {
		const response = await fetch(`/api/v1/vocab/${id}`, {
			method: "DELETE",
			credentials: "include",
		});
		if (!response.ok) throw new Error("delete");
		setResult((previous) => ({
			...previous,
			words: previous.words.filter((word) => word._id !== id),
		}));
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
							["total", counts.all, BookOpen],
							["learning", counts.learning, GraduationCap],
							["dueToday", counts.review, CalendarDays],
						].map(([label, count, Icon]) => (
							<section key={label} className={styles.stat}>
								<svg className={styles.statWave} data-wave={label} viewBox="0 0 220 90" preserveAspectRatio="none" aria-hidden="true">
									<path d="M0 90C45 90 40 60 95 55S150 5 220 25V90Z" fill="currentColor" fillOpacity=".10" stroke="currentColor" strokeOpacity=".25" />
								</svg>
								<span className={styles.statIcon} data-tone={label}><Icon size={24} /></span>
								<div>
									<h2>{t(label)}</h2>
									<strong>{loading || error || !user ? "—" : count}</strong>
								</div>
							</section>
						))}
					</div>
				</header>
				<div className={styles.content}>
					<div className={styles.mainColumn}>
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
				value={activeFilter}
								t={t}
								onChange={(status) => {
									setFilter(status);
									setPage(1);
								}}
							/>
							<button
								className={`${styles.primary} ${styles.addButton}`}
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
									<ChevronDown size={17} aria-hidden="true" className={practiceOpen ? styles.chevronOpen : ""} />
								</button>
								{practiceOpen && (
									<div id="wordlist-practice-menu" className={styles.practiceMenu} role="group" aria-label={t("practice")}>
										{reviewModes.map(({ value, Icon }) => {
											const available = queue.length > 0 && (value !== "quiz" || canQuiz);
											const href = `/wordlist/review/${value}${counts.review > 0 ? "?reviewMode=due" : ""}`;
											const contents = (
												<>
													<span className={styles.reviewModeIcon} aria-hidden="true"><Icon size={21} strokeWidth={1.9} /></span>
													<span className={styles.reviewModeCopy}>
														<strong>{t(value)}</strong>
														<span>{t(`${value}Description`)}</span>
													</span>
													<ChevronRight className={styles.reviewModeArrow} size={18} aria-hidden="true" />
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
										})}
										{queue.length > 0 && !canQuiz && <small className={styles.reviewHint}>{t("quizHelp")}</small>}
									</div>
								)}
							</div>
						</div>
						{audioError && <p role="alert">{t("audioError")}</p>}
						{loading ? (
							<div className={styles.empty} role="status">
								{t("loading")}
							</div>
						) : !user || error === "unauthorized" ? (
							<div className={styles.empty}>
								<BookOpen size={32} />
								<p>{t("unauthorized")}</p>
								<Link className={styles.primary} href="/login">
									{t("login")}
								</Link>
							</div>
						) : error ? (
							<div className={styles.empty} role="alert">
								<p>{t("loadError")}</p>
								<button
									className={styles.secondary}
									onClick={() => setRetry((value) => value + 1)}
								>
									{t("retry")}
								</button>
							</div>
						) : !words.length ? (
							<div className={styles.empty}>
								<BookOpen size={38} />
								<h2>{t("emptyTitle")}</h2>
								<p>{t("emptyBody")}</p>
								<button
									className={styles.primary}
									onClick={() => setEditor({ word: null })}
								>
									<Plus size={18} />
									{t("addWord")}
								</button>
							</div>
						) : !filtered.length ? (
							<div className={styles.empty}>
								<p>{t("noResults")}</p>
								<button
									className={styles.secondary}
									onClick={() => {
										setSearch("");
										setFilter("all");
									}}
								>
									{t("clear")}
								</button>
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
															</div>
														</th>
														<td className={styles.ipa}>
															{word.pronunciation || "—"}
														</td>
														<td className={styles.meaning}>
															{word.vietnamese}
														</td>
														<td className={styles.example}>
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
								</div>
								<div className={styles.pagination}>
									<span>{t("shown", { count: filtered.length })}</span>
									{pages > 1 && (
										<div>
											<button
												disabled={currentPage === 1}
												onClick={() => setPage(currentPage - 1)}
											>
												{t("previous")}
											</button>
											<span>
												{t("page", { current: currentPage, total: pages })}
											</span>
											<button
												disabled={currentPage === pages}
												onClick={() => setPage(currentPage + 1)}
											>
												{t("next")}
											</button>
										</div>
									)}
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
