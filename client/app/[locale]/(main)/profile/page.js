"use client";

import StudyHeatmap from "@/app/_components/StudyHeatmap";
import LanguageSwitcher from "@/app/_components/LanguageSwitcher";
import ThemeSelector from "@/app/_components/ThemeSelector";
import { useAuth } from "@/app/_contexts/AuthContext";
import { useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
	Mail,
	CalendarDays,
	Pencil,
	Camera,
	LoaderCircle,
	Languages,
	Volume2,
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
	const { user, setUser } = useAuth();
	const [isEditingName, setIsEditingName] = useState(false);
	const [newName, setNewName] = useState(user?.name || "");
	const avatarInputRef = useRef(null);
	const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
	const [avatarError, setAvatarError] = useState("");
	const [failedAvatarUrls, setFailedAvatarUrls] = useState([]);
	const avatarUrl = [user?.avatar, user?.photo].find((url) =>
		typeof url === "string" && url.trim() && !failedAvatarUrls.includes(url),
	);

	async function handleAvatarChange(event) {
		const file = event.target.files?.[0];
		event.target.value = "";
		if (!file) return;
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
		try {
			const image = await compressAvatar(file);
			if (image.size > MAX_UPLOAD_BYTES) throw new Error("Avatar exceeds upload limit");
			const response = await fetch("/api/v1/users/avatar", {
				method: "PATCH",
				credentials: "include",
				headers: { "Content-Type": "image/jpeg" },
				body: image,
			});
			if (!response.ok) throw new Error("Avatar upload failed");
			const data = await response.json();
			if (!data?.data?.user?.avatar) throw new Error("Avatar URL is missing");
			setUser(data.data.user);
		} catch (error) {
			console.error("Avatar upload failed:", error);
			setAvatarError(t("avatarUploadError"));
		} finally {
			setIsUploadingAvatar(false);
		}
	}
	async function handleUpdateName() {
		try {
			const res = await fetch("/api/v1/users/updateMe", {
				method: "PATCH",
				credentials: "include",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					name: newName,
				}),
			});

			if (!res.ok) return;

			const data = await res.json();

			setUser(data.data.user);
			setIsEditingName(false);
		} catch (error) {
			console.log(error);
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

				<div className="mt-5 sm:mt-0">
					<div className="flex items-center gap-3">
						<h1 className="text-3xl font-bold">{user?.name}</h1>
						<button
							onClick={() => {
								setNewName(user?.name || "");
								setIsEditingName(true);
							}}
							className="text-slate-400 hover:text-white cursor-pointer"
						>
							<Pencil size={18} />
						</button>
					</div>
					{isEditingName && (
						<div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
							<div className="relative w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-900 p-8 shadow-2xl">
						<button
							onClick={() => setIsEditingName(false)}
							aria-label={t("close")}
									className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-slate-800 text-xl text-slate-400 transition hover:bg-slate-700 hover:text-white"
								>
									✕
								</button>

								<h2 className="mb-6 text-center text-2xl font-bold text-white">
									{t("updateName")}
								</h2>

								<input
									type="text"
									value={newName}
									onChange={(e) => setNewName(e.target.value)}
									className="w-full rounded-2xl border border-slate-700 bg-slate-950 px-4 py-4 text-slate-100 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
								/>

								<button
									type="button"
									onClick={handleUpdateName}
									className="mx-auto mt-8 block rounded-2xl bg-blue-900 px-16 py-3 font-semibold text-white transition hover:bg-blue-800"
								>
									{t("save")}
								</button>
							</div>
						</div>
					)}

					<div className="mt-4 flex items-center gap-2 text-slate-300">
						<Mail size={18} />
						<span>{user?.email}</span>
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
				<div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
					<div className="flex items-center gap-4">
						<Languages className="text-primary" />
						<span className="font-medium">{t("language")}</span>
					</div>

					<LanguageSwitcher variant="settings" />
				</div>

				<div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
					<div className="flex items-center gap-4">
						<Volume2 className="text-blue-400" />
						<span className="font-medium">{t("sound")}</span>
					</div>

					<input type="range" className="w-32" />
				</div>

				<div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
					<div className="flex items-center gap-4">
						<Moon className="text-primary" />
						<span className="font-medium">{t("darkMode")}</span>
					</div>

					<ThemeSelector />
				</div>
			</div>
		</div>
	);
}

export default Page;
