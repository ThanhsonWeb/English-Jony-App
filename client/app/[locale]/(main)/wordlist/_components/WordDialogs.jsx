"use client";
import { useEffect, useRef, useState } from "react";
import { BookOpen, X } from "lucide-react";
import styles from "../wordlist.module.css";

export function WordDialog({ word, onClose, onSave, t }) {
	const dialog = useRef(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	useEffect(() => {
		dialog.current.showModal();
	}, []);
	async function submit(event) {
		event.preventDefault();
		if (busy) return;
		const body = Object.fromEntries(new FormData(event.currentTarget));
		for (const key of Object.keys(body)) body[key] = body[key].trim();
		if (!body.english || !body.vietnamese) return;
		setBusy(true);
		setError("");
		try {
			await onSave(body);
			onClose();
		} catch {
			setError(t("saveError"));
			setBusy(false);
		}
	}
	return (
		<dialog
			ref={dialog}
			className={`${styles.dialog} ${styles.wordDialog}`}
			onCancel={(event) => {
				if (busy) event.preventDefault();
				else onClose();
			}}
			aria-labelledby="word-dialog-title"
		>
			<form onSubmit={submit}>
				<div className={styles.dialogHeading}>
					<div className={styles.dialogTitle}>
						<span className={styles.dialogIcon} aria-hidden="true">
							<BookOpen size={21} />
						</span>
						<h2 id="word-dialog-title">{t(word ? "editTitle" : "addWord")}</h2>
					</div>
					<button
						type="button"
						disabled={busy}
						onClick={onClose}
						aria-label={t("close")}
						className={styles.dialogClose}
					>
						<X size={20} />
					</button>
				</div>
				{[
					["english", "word"],
					["vietnamese", "meaning"],
					["example", "example"],
				].map(([name, label]) => (
					<label key={name} className={styles.field}>
						{t(label)}
						{name === "example" && (
							<small> · {t("optional")}</small>
						)}
						{name === "example" ? <textarea
							name={name}
							defaultValue={word?.[name] || ""}
							maxLength={2000}
							disabled={busy}
							rows={3}
						/> : <input
							name={name}
							defaultValue={word?.[name] || ""}
							required
							maxLength={500}
							disabled={busy}
							autoComplete="off"
						/>}
					</label>
				))}
				{error && <p role="alert">{error}</p>}
				<div className={styles.dialogActions}>
					<button
						type="button"
						disabled={busy}
						onClick={onClose}
						className={styles.secondary}
					>
						{t("cancel")}
					</button>
					<button disabled={busy} className={styles.primary}>
						{t(busy ? "saving" : "save")}
					</button>
				</div>
			</form>
		</dialog>
	);
}

export function DeleteDialog({ word, onClose, onDelete, t }) {
	const dialog = useRef(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	useEffect(() => {
		dialog.current.showModal();
	}, []);
	return (
		<dialog
			ref={dialog}
			className={styles.dialog}
			onCancel={(event) => {
				if (busy) event.preventDefault();
				else onClose();
			}}
			aria-labelledby="delete-title"
		>
			<h2 id="delete-title">{t("deleteTitle", { word: word.english })}</h2>
			<p>{t("deleteBody")}</p>
			{error && <p role="alert">{error}</p>}
			<div className={styles.dialogActions}>
				<button disabled={busy} className={styles.secondary} onClick={onClose}>
					{t("cancel")}
				</button>
				<button
					disabled={busy}
					className={styles.primary}
					onClick={async () => {
						setBusy(true);
						try {
							await onDelete(word._id);
							onClose();
						} catch {
							setError(t("deleteError"));
							setBusy(false);
						}
					}}
				>
					{t("remove")}
				</button>
			</div>
		</dialog>
	);
}
