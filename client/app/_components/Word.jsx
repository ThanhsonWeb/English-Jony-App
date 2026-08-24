"use client";

import { Edit2, MoreVertical, Trash2, Volume2 } from "lucide-react";
import { useState } from "react";
import Button from "./Button";
import { createPortal } from "react-dom";

function Word({ word, onDelete, onFix, variant = "list" }) {
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
									Từ mới
								</span>
							)}

							{wordStatus === "learning" && (
								<span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-400">
									Đang học
								</span>
							)}

							{wordStatus === "review" && (
								<span className="rounded-full border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 text-[10px] font-medium text-orange-400">
									Cần ôn
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
											Chỉnh sửa
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
											Xóa
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
			<div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-0 items-center text-sm p-5 md:p-4 bg-[#161c2e] hover:bg-[#1c243b] border border-slate-800/50 rounded-2xl md:rounded-xl transition-all duration-150">
				{/* Word */}
				<div className="md:col-span-2">
					<p className="md:hidden text-xs text-slate-500 mb-1">Từ vựng</p>
					<p className="font-serif text-xl md:text-lg text-amber-100/90 font-semibold">
						{word.english}
					</p>
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
					<p className="md:hidden text-xs text-slate-500 mb-1">Nghĩa</p>
					<p className="text-slate-200 text-base md:text-sm">
						{word.vietnamese}
					</p>
				</div>

				{/* Example */}
				<div className="md:col-span-3">
					<p className="md:hidden text-xs text-slate-500 mb-1">Ví dụ</p>
					<p className="text-slate-400 text-sm md:text-md italic whitespace-normal break-words leading-relaxed">
						{word.example || "—"}
					</p>
				</div>

				{/* Status */}
				<div className="md:col-span-2">
					<p className="md:hidden text-xs text-slate-500 mb-2">Trạng thái</p>

					{wordStatus === "new" && (
						<span className="inline-flex items-center rounded-full border border-slate-600 bg-slate-700/40 px-2.5 py-1 text-xs font-medium text-slate-300">
							🌱 Mới
						</span>
					)}

					{wordStatus === "learning" && (
						<span className="inline-flex items-center rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-1 text-xs font-medium text-blue-400">
							Đang học
						</span>
					)}

					{wordStatus === "review" && (
						<span className="inline-flex items-center rounded-full border border-orange-500/30 bg-orange-500/10 px-2.5 py-1 text-xs font-medium text-orange-400">
							Cần ôn
						</span>
					)}
				</div>

				{/* Actions */}
				<div className="md:col-span-1 flex justify-end gap-2 border-t border-slate-800/70 pt-4 md:border-0 md:pt-0">
					<button
						onClick={() => setIsEditing((cur) => !cur)}
						className="p-2 rounded-lg text-slate-400 hover:bg-slate-700/50 hover:text-white transition-colors cursor-pointer"
					>
						<Edit2 className="w-4 h-4" />
					</button>

					<button
						onClick={() => onDelete(word._id)}
						className="p-2 rounded-lg text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-colors cursor-pointer"
					>
						<Trash2 className="w-4 h-4" />
					</button>
				</div>
			</div>
			)}

			{isEditing &&
				createPortal(
					<div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
						<form
							onSubmit={handleEditSubmit}
							className="relative w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl"
						>
							<button
								type="button"
								onClick={() => setIsEditing(false)}
								className="absolute right-4 top-3 text-2xl text-slate-500 transition hover:text-white cursor-pointer"
							>
								&times;
							</button>

							<h2 className="mb-6 text-xl font-bold text-slate-100">
								Chỉnh sửa từ vựng
							</h2>

							<div className="flex flex-col gap-4">
								<div>
									<label className="mb-1.5 block text-sm font-medium text-slate-300">
										Từ vựng
									</label>

									<input
										type="text"
										value={editEnglish}
										onChange={(e) => setEditEnglish(e.target.value)}
										className="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-slate-100 focus:border-blue-500 focus:outline-none"
									/>
								</div>

								<div>
									<label className="mb-1.5 block text-sm font-medium text-slate-300">
										Nghĩa
									</label>

									<input
										type="text"
										value={editVietnamese}
										onChange={(e) => setEditVietnamese(e.target.value)}
										className="w-full rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-slate-100 focus:border-blue-500 focus:outline-none"
									/>
								</div>

								<div>
									<label className="mb-1.5 block text-sm font-medium text-slate-300">
										Ví dụ
									</label>

									<textarea
										value={editExample}
										onChange={(e) => setEditExample(e.target.value)}
										rows={4}
										className="w-full resize-none rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-slate-100 focus:border-blue-500 focus:outline-none"
									/>
								</div>

								<div className="mt-2 flex gap-3">
									<button
										type="button"
										onClick={() => setIsEditing(false)}
										className="flex-1 rounded-xl border border-slate-700 px-4 py-3 font-medium text-slate-300 transition hover:bg-slate-800 cursor-pointer"
									>
										Hủy
									</button>

									<button
										type="submit"
										className="flex-1 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-500 cursor-pointer"
									>
										Lưu thay đổi
									</button>
								</div>
							</div>
						</form>
					</div>,
					document.body,
				)}
		</>
	);
}

export default Word;
