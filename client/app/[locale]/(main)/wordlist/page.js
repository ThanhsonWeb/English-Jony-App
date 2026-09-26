"use client";
import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
	BookOpen,
	GraduationCap,
	CalendarDays,
	Play,
	Plus,
	Search,
	Volume2,
	Pencil,
	Trash2,
	Sprout,
	X,
	Check,
	ChevronDown,
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
import NotebookIllustration from "./_components/NotebookIllustration";
import { WordDialog, DeleteDialog } from "./_components/WordDialogs";
import styles from "./wordlist.module.css";
import { splitExample } from "@/app/_lib/exampleHighlight.mjs";

const statuses = ["all", "new", "learning", "review", "mastered"];
const motivationalQuotes = {
	vi: [
		"Một từ hôm nay, một câu chuyện ngày mai.",
		"Từng từ một, bạn đang xây cả một ngôn ngữ.",
		"Đừng chỉ lưu từ. Hãy biến chúng thành lời nói.",
		"Học ít thôi, nhưng nhớ thật lâu.",
		"Mỗi từ mới là một bước gần hơn đến sự tự tin.",
		"Từ vựng nhỏ, tiến bộ lớn.",
		"Mỗi ngày một từ, mỗi ngày thêm tự tin.",
		"Những từ bạn nhớ hôm nay sẽ thành lời nói ngày mai.",
	],
	en: [
		"One word today, one story tomorrow.",
		"Word by word, you are building a whole language.",
		"Do not just save words. Turn them into speech.",
		"Learn a little, remember it for longer.",
		"Every new word is one step closer to confidence.",
		"Small words, big progress.",
		"One word a day, a little more confidence every day.",
		"The words you remember today become tomorrow's voice.",
	],
};
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

function ReviewButton({ available, mode, label }) {
	return available ? (
		<Link href={`/wordlist/review/${mode}`} className={styles.primary}>
			<Play size={18} fill="currentColor" />
			{label}
		</Link>
	) : (
		<button disabled className={styles.primary}>
			<Play size={18} />
			{label}
		</button>
	);
}

export default function WordlistPage() {
	const t = useTranslations("Notebook");
	const locale = useLocale();
	const { user, loading: authLoading } = useAuth();
	const [result, setResult] = useState(null);
	const [retry, setRetry] = useState(0);
	const [search, setSearch] = useState("");
	const [filter, setFilter] = useState("all");
	const [mode, setMode] = useState("flashcard");
	const [editor, setEditor] = useState(null);
	const [deleting, setDeleting] = useState(null);
	const [audioError, setAudioError] = useState(false);
	const [page, setPage] = useState(1);
	const [motivationalQuote, setMotivationalQuote] = useState("");
	const quoteChosenRef = useRef(false);
	const userId = user?._id;
	const requestKey = `${userId || "guest"}:${retry}`;
	useEffect(() => {
		if (quoteChosenRef.current) return;

		const quotes = motivationalQuotes[locale] || motivationalQuotes.en;
		quoteChosenRef.current = true;
		setMotivationalQuote(quotes[Math.floor(Math.random() * quotes.length)]);
	}, [locale]);
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
	const queue = selectReviewWords(words, { global: true, now });
	const canQuiz =
		new Set(words.map((word) => word.vietnamese.trim().toLowerCase())).size >=
		4;
	const canReview = queue.length > 0 && (mode !== "quiz" || canQuiz);
	const query = search.trim().toLocaleLowerCase();
	const filtered = words.filter(
		(word) =>
			(filter === "all" || getWordStatus(word, now) === filter) &&
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
	const reviewButton = (
		<ReviewButton available={canReview} mode={mode} label={t("reviewNow")} />
	);
	return (
		<main className={styles.page}>
			<div className={styles.container}>
				<div className={styles.content}>
					<div className={styles.mainColumn}>
						<p
							className={styles.motivationalQuote}
							data-ready={Boolean(motivationalQuote)}
						>
							<Sparkles size={14} aria-hidden="true" />
							<span>{motivationalQuote || "\u00a0"}</span>
						</p>
						<div className={styles.stats}>
							{[
								["total", counts.all, BookOpen],
								["learning", counts.learning, GraduationCap],
								["dueToday", counts.review, CalendarDays],
							].map(([label, count, Icon]) => (
								<section key={label} className={styles.stat}>
									<svg
										className={styles.statWave}
										data-wave={label}
										viewBox="0 0 220 90"
										preserveAspectRatio="none"
										aria-hidden="true"
									>
										<path
											d="M0 90C45 90 40 60 95 55S150 5 220 25V90Z"
											fill="currentColor"
											fillOpacity=".10"
											stroke="currentColor"
											strokeOpacity=".25"
										/>
									</svg>
									<span className={styles.statIcon} data-tone={label}>
										<Icon size={24} />
									</span>
									<div>
										<h2>{t(label)}</h2>
										<strong>{loading || error || !user ? "—" : count}</strong>
									</div>
								</section>
							))}
						</div>
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
								value={filter}
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
					<aside className={styles.sideColumn}>
						<div className={styles.illustration}>
							<NotebookIllustration />
						</div>
						<div className={styles.reviewCard}>
							<Sprout size={54} strokeWidth={1.4} />
							<h2>
								{loading || error || !user
									? "—"
									: t(
											counts.review
												? "dueHeading"
												: queue.length
													? "learningHeading"
													: "caughtUp",
											{ count: counts.review || queue.length },
										)}
							</h2>
							<p>{t(queue.length ? "readyBody" : "caughtUpBody")}</p>
							<label htmlFor="review-mode">{t("mode")}</label>
							<select
								id="review-mode"
								value={mode}
								onChange={(event) => setMode(event.target.value)}
							>
								{["flashcard", "quiz", "write"].map((value) => (
									<option key={value} value={value}>
										{t(value)}
									</option>
								))}
							</select>
							{mode === "quiz" && !canQuiz && <small>{t("quizHelp")}</small>}
							{reviewButton}
							<div className={styles.quickLinks} aria-label={t("status")}>
								{[
									["all", BookOpen, counts.all],
									["learning", GraduationCap, counts.learning],
									["review", CalendarDays, counts.review],
								].map(([status, Icon, count]) => (
									<button
										key={status}
										type="button"
										onClick={() => {
											setFilter(status);
											setPage(1);
										}}
										aria-current={filter === status ? "true" : undefined}
									>
										<Icon size={17} />
										<span>
											{status === "review"
												? t("dueToday")
												: t(status === "all" ? "allWords" : status)}
										</span>
										<strong>{loading || error || !user ? "—" : count}</strong>
									</button>
								))}
							</div>
						</div>
					</aside>
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
