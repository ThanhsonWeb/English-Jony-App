"use client";
import { useEffect, useRef, useState } from "react";
import { BookOpen, X } from "lucide-react";
import styles from "../wordlist.module.css";

export function WordDialog({ word, onClose, onSave, t }) {
	const dialog = useRef(null);
	const latestEnglish = useRef(word?.english?.trim() || "");
	const manuallyEdited = useRef({ vietnamese: false, pronunciation: false, example: false });
	const [fields, setFields] = useState({
		english: word?.english || "",
		vietnamese: word?.vietnamese || "",
		pronunciation: word?.pronunciation || "",
		example: word?.example || "",
	});
	const [lookupState, setLookupState] = useState("idle");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	useEffect(() => {
		dialog.current.showModal();
	}, []);
	useEffect(() => {
		if (word || !fields.english.trim()) return;
		const english = fields.english.trim();
		const controller = new AbortController();
		const timer = setTimeout(async () => {
			try {
				const response = await fetch(
					`/api/v1/dictionary/${encodeURIComponent(english)}`,
					{ credentials: "include", signal: controller.signal },
				);
				if (!response.ok) throw new Error("lookup failed");
				const { data } = await response.json();
				if (controller.signal.aborted || latestEnglish.current !== english) return;
				setFields((current) => ({
					...current,
					vietnamese: manuallyEdited.current.vietnamese
						? current.vietnamese : data?.vietnamese || current.vietnamese,
					pronunciation: manuallyEdited.current.pronunciation
						? current.pronunciation : data?.pronunciation || current.pronunciation,
					example: manuallyEdited.current.example
						? current.example : data?.example || current.example,
				}));
				setLookupState("idle");
			} catch {
				if (!controller.signal.aborted) setLookupState("error");
			}
		}, 400);
		return () => {
			clearTimeout(timer);
			controller.abort();
		};
	}, [fields.english, word]);
	function changeField(event) {
		const { name, value } = event.target;
		if (name === "english") {
			latestEnglish.current = value.trim();
			setLookupState(!word && value.trim() ? "loading" : "idle");
			setFields((current) => ({
				...current,
				english: value,
				...(word ? {} : {
					vietnamese: manuallyEdited.current.vietnamese ? current.vietnamese : "",
					pronunciation: manuallyEdited.current.pronunciation ? current.pronunciation : "",
					example: manuallyEdited.current.example ? current.example : "",
				}),
			}));
			return;
		}
		manuallyEdited.current[name] = true;
		setFields((current) => ({ ...current, [name]: value }));
	}
	async function submit(event) {
		event.preventDefault();
		if (busy) return;
		const body = { ...fields };
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
					["pronunciation", "ipa"],
					["example", "example"],
				].map(([name, label]) => (
					<label key={name} className={styles.field}>
						{t(label)}
						{(name === "example" || name === "pronunciation") && (
							<small> · {t("optional")}</small>
						)}
						{name === "example" ? <textarea
							name={name}
							value={fields[name]}
							onChange={changeField}
							maxLength={2000}
							disabled={busy}
							rows={3}
						/> : <input
							name={name}
							value={fields[name]}
							onChange={changeField}
							required={name === "english" || name === "vietnamese"}
							maxLength={500}
							disabled={busy}
							autoComplete="off"
						/>}
						{name === "english" && lookupState !== "idle" && (
							<span className={styles.lookupHint} role="status">
								{lookupState === "loading" ? t("lookingUpWord") : t("lookupUnavailable")}
							</span>
						)}
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
