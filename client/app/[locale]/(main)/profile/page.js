"use client";

import StudyHeatmap from "@/app/_components/StudyHeatmap";
import LanguageSwitcher from "@/app/_components/LanguageSwitcher";
import ThemeSelector from "@/app/_components/ThemeSelector";
import MobileDialogOverlay from "@/app/_components/MobileDialogOverlay";
import { useAuth } from "@/app/_contexts/AuthContext";
import { resolveAvatarUrl } from "@/app/_lib/resolveAvatarUrl";
import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { validateProfileName } from "@/app/_lib/profileName.mjs";
import {
	ACCOUNT_DELETION_CONFIRMATION,
	canRequestPasswordAccountDeletion,
	isAccountDeletionConfirmationValid,
	isAccountDeletionUiEnabled,
	submitAccountDeletionRequest,
} from "@/app/_lib/accountDeletionUi.mjs";
import {
	Mail,
	CalendarDays,
	Pencil,
	Camera,
	LoaderCircle,
	Languages,
	Moon,
	LogOut,
} from "lucide-react";

const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SOURCE_BYTES = 10 * 1024 * 1024;
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

async function compressAvatar(file) {
	const objectUrl = URL.createObjectURL(file);
	try {
		const image = new Image();
		await new Promise((resolve, reject) => {
			image.onload = resolve;
			image.onerror = reject;
			image.src = objectUrl;
		});
		const scale = Math.min(1, 512 / Math.max(image.naturalWidth, image.naturalHeight));
		const canvas = document.createElement("canvas");
		canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
		canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
		const context = canvas.getContext("2d");
		if (!context) throw new Error("Canvas is unavailable");
		context.fillStyle = "#fff";
		context.fillRect(0, 0, canvas.width, canvas.height);
		context.drawImage(image, 0, 0, canvas.width, canvas.height);
		const blob = await new Promise((resolve, reject) => {
			canvas.toBlob((result) => result ? resolve(result) : reject(new Error("Image compression failed")), "image/jpeg", 0.82);
		});
		return blob;
	} finally {
		URL.revokeObjectURL(objectUrl);
	}
}

function Page() {
	const t = useTranslations("Profile");
	const locale = useLocale();
	const { user, captureSession, isCurrentSession, updateUserForSession } = useAuth();
	const [isEditingName, setIsEditingName] = useState(false);
	const [newName, setNewName] = useState(user?.name || "");
	const [nameError, setNameError] = useState("");
	const [isSavingName, setIsSavingName] = useState(false);
	const nameSavingRef = useRef(false);
	const avatarInputRef = useRef(null);
	const avatarRequestId = useRef(0);
	const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
	const [avatarError, setAvatarError] = useState("");
	const [failedAvatarUrls, setFailedAvatarUrls] = useState([]);
	const [isDeletionDialogOpen, setIsDeletionDialogOpen] = useState(false);
	const [deletionPassword, setDeletionPassword] = useState("");
	const [deletionConfirmation, setDeletionConfirmation] = useState("");
	const [deletionError, setDeletionError] = useState("");
	const [deletionNotice, setDeletionNotice] = useState("");
	const [isSubmittingDeletion, setIsSubmittingDeletion] = useState(false);
	const [canRequestDeletion, setCanRequestDeletion] = useState(() => canRequestPasswordAccountDeletion(user));
	const deletionSubmittingRef = useRef(false);
	const avatarUrl = resolveAvatarUrl(user, failedAvatarUrls);
	const deletionUiEnabled = isAccountDeletionUiEnabled(process.env.NEXT_PUBLIC_ACCOUNT_DELETION_UI_ENABLED);
	const authenticatedUserId = user?._id || user?.id;

	useEffect(() => {
		if (!deletionUiEnabled || !authenticatedUserId) {
			setCanRequestDeletion(false);
			return;
		}
		if (typeof user?.canRequestPasswordAccountDeletion === "boolean") {
			setCanRequestDeletion(user.canRequestPasswordAccountDeletion);
			return;
		}

		let cancelled = false;
		const session = captureSession();
		setCanRequestDeletion(false);
		fetch("/api/v1/users/me", { credentials: "include", cache: "no-store" })
			.then((response) => response.ok ? response.json() : null)
			.then((data) => {
				if (cancelled || !isCurrentSession(session)) return;
				setCanRequestDeletion(data?.data?.accountCapabilities?.canRequestPasswordAccountDeletion === true);
			})
			.catch(() => {
				if (!cancelled && isCurrentSession(session)) setCanRequestDeletion(false);
			});
		return () => { cancelled = true; };
	}, [deletionUiEnabled, authenticatedUserId, user?.canRequestPasswordAccountDeletion, captureSession, isCurrentSession]);

	const showAccountDeletion = deletionUiEnabled && canRequestDeletion;

	async function handleAvatarChange(event) {
		const file = event.target.files?.[0];
		event.target.value = "";
		if (!file) return;
		const session = captureSession();
		if (!session.userId) return;
		setAvatarError("");
		if (!AVATAR_TYPES.includes(file.type)) {
			setAvatarError(t("avatarTypeError"));
			return;
		}
		if (file.size > MAX_SOURCE_BYTES) {
			setAvatarError(t("avatarSizeError"));
			return;
		}

		setIsUploadingAvatar(true);
		const requestId = ++avatarRequestId.current;
		try {
			const image = await compressAvatar(file);
			if (!isCurrentSession(session)) return;
			if (image.size > MAX_UPLOAD_BYTES) throw new Error("Avatar exceeds upload limit");
			const response = await fetch("/api/v1/users/avatar", {
				method: "PATCH",
				credentials: "include",
				headers: { "Content-Type": "image/jpeg" },
				body: image,
			});
			if (!response.ok) {
				if (response.status === 404) throw new Error("avatarServerUnavailable");
				if (response.status === 503) throw new Error("avatarStorageUnavailable");
				throw new Error("avatarUploadError");
			}
			const data = await response.json();
			if (!data?.data?.user?.avatar) throw new Error("Avatar URL is missing");
			updateUserForSession(data.data.user, session);
		} catch (error) {
			if (!isCurrentSession(session)) return;
			const key = ["avatarServerUnavailable", "avatarStorageUnavailable"].includes(error.message)
				? error.message : "avatarUploadError";
			setAvatarError(t(key));
		} finally {
			if (requestId === avatarRequestId.current) setIsUploadingAvatar(false);
		}
	}
	async function handleUpdateName() {
		if (nameSavingRef.current) return;
		const session = captureSession();
		if (!session.userId) return;
		const validation = validateProfileName(newName);
		setNameError("");
		if (validation) { setNameError(t(validation)); return; }
		nameSavingRef.current = true;
		setIsSavingName(true);
		try {
			const res = await fetch("/api/v1/users/updateMe", {
				method: "PATCH",
				credentials: "include",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					name: newName.trim(),
				}),
			});

			const data = await res.json().catch(() => null);
			if (!isCurrentSession(session)) return;
			if (!res.ok || data?.status !== "success" || !data?.data?.user) {
				const key = res.status === 400 && ["nameRequired", "nameTooShort", "nameTooLong"].includes(data?.code)
					? data.code : "nameSaveError";
				setNameError(t(key));
				return;
			}

			if (!updateUserForSession(data.data.user, session)) return;
			setIsEditingName(false);
		} catch {
			if (isCurrentSession(session)) setNameError(t("nameSaveError"));
		} finally {
			nameSavingRef.current = false;
			setIsSavingName(false);
		}
	}

	async function handleAccountDeletionRequest(event) {
		event.preventDefault();
		if (deletionSubmittingRef.current ||
			!isAccountDeletionConfirmationValid(deletionConfirmation) ||
			!deletionPassword) return;
		const session = captureSession();
		if (!session.userId || !isCurrentSession(session)) return;

		deletionSubmittingRef.current = true;
		setIsSubmittingDeletion(true);
		setDeletionError("");
		try {
			const result = await submitAccountDeletionRequest(deletionPassword);
			if (!isCurrentSession(session)) return;
			if (!result.ok) {
				const key = result.status === 401
					? "deletionReauthenticationError"
					: result.status === 429
						? "deletionRateLimited"
						: "deletionRequestError";
				setDeletionError(t(key));
				return;
			}
			setDeletionPassword("");
			setDeletionConfirmation("");
			setIsDeletionDialogOpen(false);
			setDeletionNotice(t("deletionRequested"));
		} catch {
			if (isCurrentSession(session)) setDeletionError(t("deletionRequestError"));
		} finally {
			deletionSubmittingRef.current = false;
			setIsSubmittingDeletion(false);
		}
	}

	return (
		<div className="mx-auto w-full max-w-3xl px-4 py-10 text-slate-100">
			{/* Profile top */}
			<div className="mb-10 flex flex-col items-center gap-6 sm:flex-row">
				<div className="relative">
					{avatarUrl ? (
						<img
							src={avatarUrl}
							alt={user.name}
							referrerPolicy="no-referrer"
							onError={() => setFailedAvatarUrls((urls) => [...urls, avatarUrl])}
							className="h-36 w-36 rounded-full border-4 border-gray-300 object-cover"
						/>
					) : (
						<div className="flex h-36 w-36 items-center justify-center rounded-full border-4 border-blue-200 bg-slate-800 text-4xl font-bold">
							{user?.name?.charAt(0).toUpperCase()}
						</div>
					)}

					<input
						ref={avatarInputRef}
						type="file"
						accept="image/jpeg,image/png,image/webp"
						className="sr-only"
						onChange={handleAvatarChange}
					/>
					<button
						type="button"
						aria-label={t("uploadAvatar")}
						title={t("uploadAvatar")}
						disabled={!user || isUploadingAvatar}
						onClick={() => avatarInputRef.current?.click()}
						className="absolute bottom-1 right-1 flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-primary text-white shadow-lg transition hover:bg-primary-hover disabled:cursor-wait disabled:opacity-60"
					>
						{isUploadingAvatar ? <LoaderCircle size={20} className="animate-spin" /> : <Camera size={20} />}
					</button>
				</div>

				<div className="mt-5 sm:mt-0 max-md:min-w-0 max-md:max-w-full">
					<div className="flex items-center gap-3">
						<h1 className="text-3xl font-bold max-md:min-w-0 max-md:[overflow-wrap:anywhere]">{user?.name}</h1>
						<button
							aria-label={t("updateName")}
							onClick={() => {
								setNewName(user?.name || "");
								setNameError("");
								setIsEditingName(true);
							}}
							className="text-slate-400 hover:text-white cursor-pointer max-md:shrink-0"
						>
							<Pencil size={18} />
						</button>
					</div>
					{isEditingName && (
						<MobileDialogOverlay labelledBy="profile-name-title" className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
							<div className="relative w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-900 p-8 shadow-2xl">
						<button
							onClick={() => setIsEditingName(false)}
							aria-label={t("close")}
									className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-slate-800 text-xl text-slate-400 transition hover:bg-slate-700 hover:text-white"
								>
									✕
								</button>

								<h2 id="profile-name-title" className="mb-6 text-center text-2xl font-bold text-white">
									{t("updateName")}
								</h2>

								<input
									type="text"
									aria-label={t("editName")}
									aria-invalid={Boolean(nameError)}
									aria-describedby={nameError ? "profile-name-error" : undefined}
									disabled={isSavingName}
									value={newName}
									onChange={(e) => setNewName(e.target.value)}
									className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-4 text-slate-100 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
								/>

								{nameError && <p id="profile-name-error" role="alert" className="mt-3 text-sm text-red-400">{nameError}</p>}
								<button
									type="button"
									onClick={handleUpdateName}
									disabled={isSavingName}
									className="mx-auto mt-8 block max-w-full rounded-2xl bg-blue-900 px-16 py-3 font-semibold text-white transition hover:bg-blue-800 disabled:opacity-60"
								>
									{t(isSavingName ? "savingName" : "save")}
								</button>
							</div>
						</MobileDialogOverlay>
					)}

					<div className="mt-4 flex items-center gap-2 text-slate-300">
						<Mail size={18} className="max-md:shrink-0" />
						<span className="max-md:min-w-0 max-md:[overflow-wrap:anywhere]">{user?.email}</span>
					</div>

					<div className="mt-2 flex items-center gap-2 text-slate-300">
						<CalendarDays size={18} />
						<span>
								{t("joined")}:{" "}
								{user?.createdAt
									? new Date(user.createdAt).toLocaleDateString(locale)
								: "—"}
						</span>
					</div>
				</div>
			</div>
			{(isUploadingAvatar || avatarError) && (
				<p role={avatarError ? "alert" : "status"} className={`mb-6 text-center text-sm ${avatarError ? "text-red-400" : "text-secondary"}`}>
					{avatarError || t("uploadingAvatar")}
				</p>
			)}

			<StudyHeatmap />

			{/* Settings */}
			<div className="mt-4 space-y-4">
				<div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:flex-nowrap sm:gap-0">
					<div className="flex items-center gap-4">
						<Languages className="text-primary" />
						<span className="font-medium">{t("language")}</span>
					</div>

					<LanguageSwitcher variant="settings" />
				</div>

				<div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:flex-nowrap sm:gap-0">
					<div className="flex items-center gap-4">
						<Moon className="text-primary" />
						<span className="font-medium">{t("darkMode")}</span>
					</div>

					<ThemeSelector />
				</div>

				{deletionNotice && <p role="status" className="rounded-2xl border border-emerald-900 bg-emerald-950/40 p-4 text-sm text-emerald-200">{deletionNotice}</p>}
				{showAccountDeletion && (
					<div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-red-900/70 bg-slate-900/60 p-5">
						<div className="min-w-0">
							<h2 className="font-semibold text-red-300">{t("deleteAccountTitle")}</h2>
							<p className="mt-1 text-sm text-slate-300">{t("deleteAccountDescription")}</p>
						</div>
						<button
							type="button"
							onClick={() => {
								setDeletionPassword("");
								setDeletionConfirmation("");
								setDeletionError("");
								setIsDeletionDialogOpen(true);
							}}
							className="rounded-xl border border-red-700 px-4 py-2 font-semibold text-red-200 transition hover:bg-red-950/60"
						>
							{t("deleteAccountButton")}
						</button>
					</div>
				)}
			</div>

			{showAccountDeletion && isDeletionDialogOpen && (
				<MobileDialogOverlay labelledBy="profile-delete-account-title" className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
					<div className="relative w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl sm:p-8">
						<button
							type="button"
							onClick={() => setIsDeletionDialogOpen(false)}
							disabled={isSubmittingDeletion}
							aria-label={t("close")}
							className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-slate-800 text-xl text-slate-400 transition hover:bg-slate-700 hover:text-white disabled:opacity-60"
						>
							✕
						</button>
						<h2 id="profile-delete-account-title" className="mb-3 pr-10 text-xl font-bold text-red-300">{t("deleteAccountConfirmTitle")}</h2>
						<p className="mb-6 text-sm leading-6 text-slate-300">{t("deleteAccountConfirmDescription")}</p>
						<form onSubmit={handleAccountDeletionRequest} className="space-y-4">
							<label className="block text-sm font-medium text-slate-200">
								{t("currentPassword")}
								<input
									type="password"
									autoComplete="current-password"
									required
									disabled={isSubmittingDeletion}
									value={deletionPassword}
									onChange={(event) => setDeletionPassword(event.target.value)}
									className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-500/10 disabled:opacity-60"
								/>
							</label>
							<label className="block text-sm font-medium text-slate-200">
								{t("typeConfirmation", { phrase: ACCOUNT_DELETION_CONFIRMATION })}
								<input
									type="text"
									autoComplete="off"
									required
									disabled={isSubmittingDeletion}
									value={deletionConfirmation}
									onChange={(event) => setDeletionConfirmation(event.target.value)}
									className="mt-2 w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-500/10 disabled:opacity-60"
								/>
							</label>
							{deletionError && <p role="alert" className="text-sm text-red-300">{deletionError}</p>}
							<div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
								<button type="button" onClick={() => setIsDeletionDialogOpen(false)} disabled={isSubmittingDeletion} className="rounded-xl border border-slate-700 px-4 py-3 font-semibold text-slate-200 transition hover:bg-slate-800 disabled:opacity-60">{t("cancel")}</button>
								<button type="submit" disabled={isSubmittingDeletion || !deletionPassword || !isAccountDeletionConfirmationValid(deletionConfirmation)} className="rounded-xl bg-red-700 px-4 py-3 font-semibold text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50">{t(isSubmittingDeletion ? "deletionSubmitting" : "confirmDeleteAccount")}</button>
							</div>
						</form>
					</div>
				</MobileDialogOverlay>
			)}
		</div>
	);
}

export default Page;
