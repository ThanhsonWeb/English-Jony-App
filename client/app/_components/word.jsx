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
			<div className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-0 items-center text-sm p-4 bg-[#161c2e] hover:bg-[#1c243b] border border-slate-800/50 rounded-xl transition-all duration-150">
				{/* Word */}
				<div className="md:col-span-2">
					<p className="md:hidden text-xs text-slate-500 mb-1">Từ</p>
					<p className="font-serif text-lg text-amber-100/90 font-medium">
						{word.english}
					</p>
				</div>

				{/* IPA */}
				<div className="md:col-span-2">
					<p className="md:hidden text-xs text-slate-500 mb-1">IPA</p>
					<p className="text-slate-400 font-mono">
						{word.pronunciation || "—"}
					</p>
				</div>

				{/* Definition */}
				<div className="md:col-span-2">
					<p className="md:hidden text-xs text-slate-500 mb-1">Nghĩa</p>
					<p className="text-slate-300">{word.vietnamese}</p>
				</div>

				{/* Example */}
				<div className="md:col-span-4">
					<p className="md:hidden text-sm text-slate-500 mb-1">Ví dụ</p>
					<p className="text-slate-400 text-md italic whitespace-normal break-words leading-relaxed">
						{word.example || "—"}
					</p>
				</div>

				{/* Status */}
				<div className="md:col-span-1">
					<p className="md:hidden text-xs text-slate-500 mb-1">Trạng thái</p>

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
				<div className="md:col-span-1 flex justify-end gap-1">
					<button
						onClick={() => setIsEditing(true)}
						className="p-2 rounded-lg text-slate-400 hover:bg-slate-700/50 hover:text-white transition-colors"
					>
						<Edit2 className="w-4 h-4" />
					</button>

					<button
						onClick={() => onDelete(word._id)}
						className="p-2 rounded-lg text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-colors"
					>
						<Trash2 className="w-4 h-4" />
					</button>
				</div>
			</div>
			{/* Form model */}
			{isEditing &&
				createPortal(
					<div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
						<form
							onSubmit={handleEditSubmit}
							className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 flex flex-col gap-4 shadow-xl"
						>
							<h2 className="text-xl font-semibold text-white mb-2">
								Chỉnh sửa từ 🍀
							</h2>
							{/* nhập từ */}
							<div className="flex flex-col gap-1.5">
								<label className="text-sm font-medium text-slate-300">Từ</label>
								<input
									type="text"
									name="word"
									value={editEnglish}
									onChange={(e) => setEditEnglish(e.target.value)}
									placeholder="Nhập từ bằng tiếng Anh"
									required
									className="w-full px-3.5 py-2.5 bg-[#131927] border border-slate-700/80 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
								/>
							</div>
							{/* nhập nghĩa */}
							<div className="flex flex-col gap-1.5">
								<label className="text-sm font-medium text-slate-300">
									Bản dịch
								</label>
								<input
									type="text"
									name="translation"
									value={editVietnamese}
									onChange={(e) => setEditVietnamese(e.target.value)}
									placeholder="Nhập bản dịch"
									required
									className="w-full px-3.5 py-2.5 bg-[#131927] border border-slate-700/80 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
								/>
							</div>
							{/* nhập câu ví dụ */}
							<div className="flex flex-col gap-1.5">
								<label className="text-sm font-medium text-slate-300">
									Câu ví dụ
								</label>
								<textarea
									name="example"
									value={editExample}
									onChange={(e) => setEditExample(e.target.value)}
									rows={3}
									placeholder="Nhập câu ví dụ (tùy chọn)"
									className="w-full px-3.5 py-2.5 bg-[#131927] border border-slate-700/80 rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors resize-none"
								/>
							</div>

							<div className="flex gap-3 mt-4">
								<button
									type="button"
									onClick={() => setIsEditing(false)}
									className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors text-sm font-medium"
								>
									Hủy
								</button>
								<Button type="submit" className="flex-1">
									Lưu
								</Button>
							</div>
						</form>
					</div>,
					document.body,
				)}
		</>
	);
}

export default Word;
