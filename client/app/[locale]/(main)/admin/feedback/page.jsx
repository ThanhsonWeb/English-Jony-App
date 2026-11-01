"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, ChevronLeft, ChevronRight, LoaderCircle, MessageSquareText, Trash2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/app/_contexts/AuthContext";
import styles from "./feedback.module.css";

const PAGE_SIZE = 20;
const types = ["suggestion", "bug", "general"];
const typeTranslation = { suggestion: "types.suggestion", bug: "types.bug", general: "types.other" };

function DeleteFeedbackDialog({ item, onCancel, onDelete, t }) {
	const dialogRef = useRef(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");

	useEffect(() => {
		const dialog = dialogRef.current;
		if (dialog && !dialog.open) dialog.showModal();
		return () => {
			if (dialog?.open) dialog.close();
		};
	}, []);

	return (
		<dialog
			ref={dialogRef}
			className={styles.deleteDialog}
			aria-labelledby="delete-feedback-title"
			aria-describedby="delete-feedback-description"
			onCancel={(event) => {
				event.preventDefault();
				if (!busy) onCancel();
			}}
		>
			<div className={styles.dialogIcon}><Trash2 size={20} aria-hidden="true" /></div>
			<h2 id="delete-feedback-title">{t("deleteTitle")}</h2>
			<p id="delete-feedback-description">{t("deleteBody")}</p>
			{error && <p className={styles.dialogError} role="alert">{t(error)}</p>}
			<div className={styles.dialogActions}>
				<button type="button" className={styles.secondaryButton} disabled={busy} onClick={onCancel}>{t("cancel")}</button>
				<button
					type="button"
					className={`${styles.dangerButton} bg-red-600 text-white hover:bg-red-700`}
					disabled={busy}
					onClick={async () => {
						setBusy(true);
						setError("");
						try {
							await onDelete(item._id);
							onCancel();
						} catch (reason) {
							setError(reason.message || "deleteFailed");
							setBusy(false);
						}
					}}
				>
					{busy ? t("deleting") : t("delete")}
				</button>
			</div>
		</dialog>
	);
}

export default function AdminFeedbackPage() {
	const t = useTranslations("AdminFeedback");
	const locale = useLocale();
	const { user, loading: authLoading } = useAuth();
	const [feedback, setFeedback] = useState([]);
	const [pagination, setPagination] = useState({ page: 1, totalPages: 1, totalRecords: 0 });
	const [type, setType] = useState("all");
	const [status, setStatus] = useState("all");
	const [page, setPage] = useState(1);
	const [refreshKey, setRefreshKey] = useState(0);
	const [loadedQuery, setLoadedQuery] = useState("");
	const [error, setError] = useState("");
	const [actionError, setActionError] = useState("");
	const [busyId, setBusyId] = useState("");
	const [deleteTarget, setDeleteTarget] = useState(null);
	const queryKey = `${user?._id || ""}:${page}:${type}:${status}:${refreshKey}`;
	const loading = Boolean(user?.role === "admin" && loadedQuery !== queryKey);

	useEffect(() => {
		if (authLoading || !user || user.role !== "admin") return undefined;

		const controller = new AbortController();
		let active = true;
		const requestKey = queryKey;
		const query = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
		if (type !== "all") query.set("type", type);
		if (status !== "all") query.set("status", status);
		fetch(`/api/v1/admin/feedback?${query}`, {
			credentials: "include",
			cache: "no-store",
			signal: controller.signal,
		})
			.then(async (response) => {
				if (!active) return;
				if (!response.ok) {
					setError(response.status === 401 ? "sessionExpired" : response.status === 403 ? "adminRequired" : "loadFailed");
					setFeedback([]);
					return;
				}
				const result = await response.json();
				if (!active) return;
				setError("");
				setFeedback(result.data.feedback);
				setPagination(result.data.pagination);
			})
			.catch((reason) => {
				if (active && reason.name !== "AbortError") {
					setFeedback([]);
					setError("loadFailed");
				}
			})
			.finally(() => {
				if (active) setLoadedQuery(requestKey);
			});
		return () => {
			active = false;
			controller.abort();
		};
	}, [authLoading, user, page, type, status, refreshKey, queryKey]);

	async function mutate(path, method, body) {
		let response;
		try {
			response = await fetch(path, {
				method,
				credentials: "include",
				cache: "no-store",
				headers: body === undefined ? undefined : { "Content-Type": "application/json" },
				...(body === undefined ? {} : { body: JSON.stringify(body) }),
			});
		} catch {
			throw new Error("actionFailed");
		}
		if (!response.ok) {
			if (response.status === 401) throw new Error("sessionExpired");
			if (response.status === 403) throw new Error("adminRequired");
			throw new Error("actionFailed");
		}
		return response.status === 204 ? null : response.json();
	}

	async function markResolved(id) {
		setBusyId(id);
		setActionError("");
		try {
			await mutate(`/api/v1/admin/feedback/${id}/status`, "PATCH", { status: "resolved" });
			setRefreshKey((value) => value + 1);
		} catch (reason) {
			setActionError(reason.message || "actionFailed");
		} finally {
			setBusyId("");
		}
	}

	async function deleteFeedback(id) {
		await mutate(`/api/v1/admin/feedback/${id}`, "DELETE");
		if (feedback.length === 1 && page > 1) setPage((value) => value - 1);
		else setRefreshKey((value) => value + 1);
	}

	function changeType(event) {
		setType(event.target.value);
		setPage(1);
	}

	function changeStatus(event) {
		setStatus(event.target.value);
		setPage(1);
	}

	if (authLoading) {
		return <main className={styles.page}><p className={styles.notice} role="status">{t("checkingAccess")}</p></main>;
	}
	if (!user) {
		return (
			<main className={styles.page}>
				<section className={styles.notice} role="alert">
					<h1>{t("privateTitle")}</h1>
					<p>{t("signInRequired")}</p>
					<Link className={styles.primaryButton} href="/login">{t("signIn")}</Link>
				</section>
			</main>
		);
	}
	if (user.role !== "admin") {
		return <main className={styles.page}><section className={styles.notice} role="alert"><h1>{t("privateTitle")}</h1><p>{t("adminRequired")}</p></section></main>;
	}

	const totalPages = Math.max(1, pagination.totalPages || 1);
	const dateFormatter = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });

	return (
		<main className={styles.page}>
			<header className={styles.heading}>
				<div>
					<p className={styles.eyebrow}><MessageSquareText size={16} aria-hidden="true" />{t("eyebrow")}</p>
					<h1>{t("title")}</h1>
					<p className={styles.subtitle}>{t("subtitle")}</p>
				</div>
				<span className={styles.count}>{t("count", { count: pagination.totalRecords })}</span>
			</header>

			<section className={styles.filters} aria-label={t("filterHeading")}>
				<label>
					<span>{t("typeFilter")}</span>
					<select value={type} onChange={changeType}>
						<option value="all">{t("types.all")}</option>
						{types.map((value) => <option key={value} value={value}>{t(typeTranslation[value])}</option>)}
					</select>
				</label>
				<label>
					<span>{t("statusFilter")}</span>
					<select value={status} onChange={changeStatus}>
						<option value="all">{t("statuses.all")}</option>
						{["new", "reviewing", "resolved"].map((value) => <option key={value} value={value}>{t(`statuses.${value}`)}</option>)}
					</select>
				</label>
			</section>

			{actionError && <p className={`${styles.error} border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300`} role="alert">{t(actionError)}</p>}
			{error && <p className={`${styles.error} border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300`} role="alert">{t(error)}</p>}

			{loading ? (
				<div className={styles.notice} role="status"><LoaderCircle className={styles.spinner} size={22} aria-hidden="true" />{t("loading")}</div>
			) : feedback.length === 0 ? (
				<div className={styles.notice} role="status"><MessageSquareText size={24} aria-hidden="true" /><p>{error ? t("loadFailed") : t("empty")}</p></div>
			) : (
				<ul className={styles.feedbackList} aria-label={t("listLabel")}>
					{feedback.map((item) => {
						const itemStatus = item.status || "new";
						const created = new Date(item.createdAt);
						return (
							<li key={item._id}>
								<article className={styles.feedbackCard}>
									<div className={styles.cardHeading}>
										<div className={styles.badges}>
											<span className={styles.typeBadge}>{t(typeTranslation[item.type] || "types.other")}</span>
											<span className={`${styles.statusBadge} ${styles[`status_${itemStatus}`] || ""}`}>{t(`statuses.${itemStatus}`)}</span>
										</div>
										<time dateTime={created.toISOString()}>{dateFormatter.format(created)}</time>
									</div>
									<p className={styles.message}>{item.message}</p>
									<div className={styles.cardActions}>
										{itemStatus !== "resolved" && (
											<button type="button" className={styles.primaryButton} disabled={busyId === item._id} onClick={() => markResolved(item._id)}>
												{busyId === item._id ? <LoaderCircle className={styles.spinner} size={17} aria-hidden="true" /> : <Check size={17} aria-hidden="true" />}
												{t(busyId === item._id ? "saving" : "markResolved")}
											</button>
										)}
										<button type="button" className={styles.secondaryButton} onClick={() => setDeleteTarget(item)}>
											<Trash2 size={17} aria-hidden="true" />{t("delete")}
										</button>
									</div>
								</article>
							</li>
						);
					})}
				</ul>
			)}

			<footer className={styles.pagination}>
				<p>{t("pageSummary", { current: page, total: totalPages })}</p>
				<div>
					<button type="button" className={styles.secondaryButton} disabled={loading || page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
						<ChevronLeft size={18} aria-hidden="true" />{t("previous")}
					</button>
					<button type="button" className={styles.secondaryButton} disabled={loading || page >= totalPages} onClick={() => setPage((value) => value + 1)}>
						{t("next")}<ChevronRight size={18} aria-hidden="true" />
					</button>
				</div>
			</footer>

			{deleteTarget && (
				<DeleteFeedbackDialog
					item={deleteTarget}
					t={t}
					onCancel={() => setDeleteTarget(null)}
					onDelete={deleteFeedback}
				/>
			)}
		</main>
	);
}
