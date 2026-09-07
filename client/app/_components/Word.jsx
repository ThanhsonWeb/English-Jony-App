"use client";

import {
	BookPlus,
	Edit2,
	Languages,
	MoreVertical,
	NotebookText,
	Sparkles,
	Tag,
	Trash2,
	Volume2,
	X,
} from "lucide-react";
import { useState } from "react";
import Button from "./Button";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";

function Word({ word, onDelete, onFix, variant = "list" }) {
	const t = useTranslations("WordlistDetail");
	const [isEditing, setIsEditing] = useState(false);
	const [editEnglish, setEditEnglish] = useState(word.english);
	const [editVietnamese, setEditVietnamese] = useState(word.vietnamese);
	const [editExample, setEditExample] = useState(word.example || "");
	const [isMenuOpen, setIsMenuOpen] = useState(false);

	const handleEditSubmit = (e) => {
		e.preventDefault();
		onFix(word._id, editEnglish, editVietnamese, editExample);
		setIsEditing(false);
	};
	// helper function
	function getWordStatus(word) {
		const reviewCount = word.reviewCount || 0;
		const now = new Date();

		if (reviewCount === 0) {
			return "new";
		}

		if (new Date(word.nextReview) <= now) {
			return "review";
		}

		return "learning";
	}
	const wordStatus = getWordStatus(word);
	const cardAccentClass = {
		new: "border-l-emerald-500",
		learning: "border-l-blue-500",
		review: "border-l-orange-500",
	}[wordStatus];

	function playPronunciation() {
		if (!("speechSynthesis" in window)) return;

		window.speechSynthesis.cancel();
		const utterance = new SpeechSynthesisUtterance(word.english);
		utterance.lang = "en-US";
		window.speechSynthesis.speak(utterance);
	}

	return (
		<>
			{variant === "card" ? (
				<div
					className={`relative min-h-[120px] rounded-xl border border-l-[3px] border-slate-800/80 bg-gradient-to-br from-[#151d30] to-[#10182a] p-4 shadow-md transition-colors hover:border-slate-700 ${cardAccentClass}`}
				>
					<div className="flex items-center justify-between gap-2">
						<div className="flex min-w-0 items-center gap-2">
							<h3 className="max-w-32 truncate font-serif text-lg font-bold text-amber-100/90 sm:max-w-40">
								{word.english}
							</h3>

							<button
								type="button"
								onClick={playPronunciation}
								aria-label={`Phát âm ${word.english}`}
								className="shrink-0 rounded p-1 text-blue-400 transition hover:bg-blue-500/10 hover:text-blue-300"
							>
								<Volume2 className="h-3.5 w-3.5" />
							</button>

							<span className="min-w-0 truncate font-mono text-[11px] text-slate-500">
								{word.pronunciation || "—"}
							</span>
						</div>

						<div className="flex shrink-0 items-center gap-1.5">
							{wordStatus === "new" && (
								<span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
									{t("new")}
								</span>
							)}

							{wordStatus === "learning" && (
								<span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-400">
									{t("learning")}
								</span>
							)}

							{wordStatus === "review" && (
								<span className="rounded-full border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 text-[10px] font-medium text-orange-400">
									{t("review")}
								</span>
							)}

							<div className="relative">
								<button
									type="button"
									onClick={() => setIsMenuOpen((open) => !open)}
									aria-label={`Mở thao tác cho ${word.english}`}
									className="rounded p-1 text-slate-500 transition hover:bg-slate-700/60 hover:text-white"
								>
									<MoreVertical className="h-4 w-4" />
								</button>

								{isMenuOpen && (
									<div className="absolute right-0 top-full z-20 mt-1 w-32 overflow-hidden rounded-lg border border-slate-700 bg-slate-900 py-1 shadow-xl">
										<button
											type="button"
											onClick={() => {
												setIsMenuOpen(false);
												setIsEditing(true);
											}}
											className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-slate-300 transition hover:bg-slate-800 hover:text-white"
										>
											<Edit2 className="h-3.5 w-3.5" />
											{t("edit")}
										</button>

										<button
											type="button"
											onClick={() => {
												setIsMenuOpen(false);
												onDelete(word._id);
											}}
											className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-red-400 transition hover:bg-red-500/10"
										>
											<Trash2 className="h-3.5 w-3.5" />
											{t("delete")}
										</button>
									</div>
								)}
							</div>
						</div>
					</div>

					<p className="mt-2 truncate text-sm font-medium text-slate-200">
						{word.vietnamese}
					</p>

					<p className="mt-1 line-clamp-2 break-words text-xs leading-5 text-slate-500">
						{word.example || "—"}
					</p>
				</div>
			) : (
			<div className="grid grid-cols-1 items-center gap-4 rounded-2xl border border-slate-800/70 bg-[#111929] p-5 text-sm transition duration-200 hover:border-emerald-500/20 hover:bg-[#141e30] md:grid-cols-12 md:gap-0 md:rounded-xl md:px-5 md:py-4">
				{/* Word */}
				<div className="md:col-span-2">
					<p className="md:hidden text-xs text-slate-500 mb-1">{t("word")}</p>
					<div className="flex items-center gap-2">
						<p className="text-xl font-semibold tracking-tight text-white md:text-base">
							{word.english}
						</p>
						<button
							type="button"
							onClick={playPronunciation}
							aria-label={`Phát âm ${word.english}`}
							className="rounded-full p-1.5 text-emerald-400 transition hover:bg-emerald-500/10 hover:text-emerald-300"
						>
							<Volume2 className="h-3.5 w-3.5" />
						</button>
					</div>
				</div>

				{/* IPA */}
				<div className="md:col-span-2">
					<p className="md:hidden text-xs text-slate-500 mb-1">IPA</p>
					<p className="text-slate-400 font-mono text-sm">
						{word.pronunciation || "—"}
					</p>
				</div>

				{/* Definition */}
				<div className="md:col-span-2">
					<p className="md:hidden text-xs text-slate-500 mb-1">{t("meaning")}</p>
					<p className="text-slate-200 text-base md:text-sm">
						{word.vietnamese}
					</p>
				</div>

				{/* Example */}
				<div className="md:col-span-3">
					<p className="md:hidden text-xs text-slate-500 mb-1">{t("example")}</p>
					<p className="whitespace-normal break-words text-sm italic leading-relaxed text-slate-400 md:pr-4">
						{word.example || "—"}
					</p>
				</div>

				{/* Status */}
				<div className="md:col-span-2">
					<p className="md:hidden text-xs text-slate-500 mb-2">{t("status")}</p>

					{wordStatus === "new" && (
						<span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300">
							<span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> {t("new")}
						</span>
					)}

					{wordStatus === "learning" && (
						<span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/20 bg-sky-500/10 px-2.5 py-1 text-xs font-medium text-sky-300">
							<span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
							{t("learning")}
						</span>
					)}

					{wordStatus === "review" && (
						<span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-300">
							<span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
							{t("review")}
						</span>
					)}
				</div>

				{/* Actions */}
				<div className="flex justify-end gap-1 border-t border-slate-800/70 pt-4 md:col-span-1 md:border-0 md:pt-0">
					<button
						onClick={() => setIsEditing((cur) => !cur)}
						aria-label={`Chỉnh sửa ${word.english}`}
						className="cursor-pointer rounded-lg p-2 text-slate-500 transition hover:bg-emerald-500/10 hover:text-emerald-300"
					>
						<Edit2 className="w-4 h-4" />
					</button>

					<button
						onClick={() => onDelete(word._id)}
						aria-label={`Xóa ${word.english}`}
						className="cursor-pointer rounded-lg p-2 text-slate-500 transition hover:bg-red-500/10 hover:text-red-400"
					>
						<Trash2 className="w-4 h-4" />
					</button>
				</div>
			</div>
			)}

			{isEditing &&
				createPortal(
					<div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
						<form
							onSubmit={handleEditSubmit}
							className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl border border-violet-500/35 bg-[#0b1022]"
						>
							<div className="pointer-events-none absolute inset-x-0 top-0 h-32 overflow-hidden">
								<div className="absolute -left-16 -top-20 h-36 w-[130%] rotate-[-7deg] rounded-[50%] bg-gradient-to-r from-violet-500/20 via-purple-500/10 to-transparent blur-xl" />
								<div className="absolute left-1/2 top-4 h-20 w-40 -translate-x-1/2 rounded-full bg-violet-500/15 blur-3xl" />
							</div>
							<button
								type="button"
								onClick={() => setIsEditing(false)}
								aria-label={t("form.close")}
								className="absolute right-4 top-4 z-10 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-slate-700/80 bg-slate-900/70 text-slate-500 transition hover:border-violet-400/50 hover:bg-violet-500/10 hover:text-white active:scale-95"
							>
								<X className="h-4 w-4" />
							</button>

							<div className="relative px-6 pb-6 pt-5 sm:px-8">
								<div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-violet-400/30 bg-violet-500/15 text-violet-300">
									<BookPlus className="h-6 w-6" />
								</div>
								<div className="mt-4 text-center">
									<h2 className="text-xl font-bold text-white sm:text-2xl">
										{t("form.editTitle")}
									</h2>
								</div>

								<div className="mt-6 flex flex-col gap-2">
									<label className="text-sm font-medium text-slate-300">{t("word")}</label>
									<div className="relative">
										<Tag className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-violet-400" />
									<input
										type="text"
										value={editEnglish}
										onChange={(e) => setEditEnglish(e.target.value)}
										className="w-full rounded-xl border border-slate-700/80 bg-[#080d1c] py-3 pl-10 pr-4 text-sm text-slate-100 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10"
									/>
									</div>
								</div>

								<div className="mt-4 flex flex-col gap-2">
									<label className="text-sm font-medium text-slate-300">
										{t("meaning")}
									</label>
									<div className="relative">
										<Languages className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-violet-400" />
									<input
										type="text"
										value={editVietnamese}
										onChange={(e) => setEditVietnamese(e.target.value)}
										className="w-full rounded-xl border border-slate-700/80 bg-[#080d1c] py-3 pl-10 pr-4 text-sm text-slate-100 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10"
									/>
									</div>
								</div>

								<div className="mt-4 flex flex-col gap-2">
									<label className="text-sm font-medium text-slate-300">
										{t("example")}
									</label>
									<div className="relative">
										<NotebookText className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-violet-400" />
									<textarea
										value={editExample}
										onChange={(e) => setEditExample(e.target.value)}
										rows={3}
										className="w-full resize-none rounded-xl border border-slate-700/80 bg-[#080d1c] py-3 pl-10 pr-4 text-sm text-slate-100 outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10"
									/>
									</div>
								</div>
							</div>

							<div className="flex gap-3 border-t border-violet-500/15 bg-[#090e1d]/80 px-6 py-4 sm:px-8">
									<button
										type="button"
										onClick={() => setIsEditing(false)}
										className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-3 text-sm font-semibold text-slate-300 transition hover:border-slate-600 hover:bg-slate-800 hover:text-white active:scale-[0.98]"
									>
										<X className="h-4 w-4 text-violet-400" />
										{t("form.cancel")}
									</button>

									<button
										type="submit"
										className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-500 px-3 py-3 text-sm font-semibold text-white shadow-[0_10px_28px_-12px_rgba(139,92,246,0.9)] transition hover:from-blue-500 hover:to-violet-400 active:scale-[0.98]"
									>
										<Sparkles className="h-4 w-4" />
										{t("form.save")}
									</button>
							</div>
						</form>
					</div>,
					document.body,
				)}
		</>
	);
}

export default Word;
