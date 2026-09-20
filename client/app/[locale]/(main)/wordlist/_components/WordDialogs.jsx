"use client";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
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
			className={styles.dialog}
			onCancel={(event) => {
				if (busy) event.preventDefault();
				else onClose();
			}}
			aria-labelledby="word-dialog-title"
		>
			<form onSubmit={submit}>
				<div className={styles.dialogHeading}>
					<h2 id="word-dialog-title">{t(word ? "editTitle" : "addWord")}</h2>
					<button
						type="button"
						disabled={busy}
						onClick={onClose}
						aria-label={t("close")}
					>
						<X size={20} />
					</button>
				</div>
				{[
					["english", "word"],
					["pronunciation", "ipa"],
					["vietnamese", "meaning"],
					["example", "example"],
				].map(([name, label]) => (
					<label key={name} className={styles.field}>
						{t(label)}
						{["pronunciation", "example"].includes(name) && (
							<small> · {t("optional")}</small>
						)}
						<input
							name={name}
							defaultValue={word?.[name] || ""}
							required={["english", "vietnamese"].includes(name)}
							maxLength={name === "example" ? 2000 : 500}
							disabled={busy}
							autoComplete="off"
						/>
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
