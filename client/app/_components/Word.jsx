"use client";

import { Edit2, Trash2 } from "lucide-react";
import { useState } from "react";
import Button from "./Button";
import { createPortal } from "react-dom";

function Word({ word, onDelete, onFix }) {
	const [isEditing, setIsEditing] = useState(false);
	const [editEnglish, setEditEnglish] = useState(word.english);
	const [editVietnamese, setEditVietnamese] = useState(word.vietnamese);
	const [editExample, setEditExample] = useState(word.example || "");

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

	return (
		<>
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
				<div className="md:col-span-4">
					<p className="md:hidden text-xs text-slate-500 mb-1">Ví dụ</p>
					<p className="text-slate-400 text-sm md:text-md italic whitespace-normal break-words leading-relaxed">
						{word.example || "—"}
					</p>
				</div>

				{/* Status */}
				<div className="md:col-span-1">
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
