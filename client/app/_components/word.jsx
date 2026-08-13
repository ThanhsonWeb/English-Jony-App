"use client";

import { Plus, Edit2, Trash2 } from "lucide-react";
import { useState } from "react";
import Button from "./Button";
import { createPortal } from "react-dom";

function Word({ word, index, onDelete, onFix }) {
	const [isEditing, setIsEditing] = useState(false);
	const [editEnglish, setEditEnglish] = useState(word.english);
	const [editVietnamese, setEditVietnamese] = useState(word.vietnamese);
	const [editExample, setEditExample] = useState(word.example || "");

	const handleEditSubmit = (e) => {
		e.preventDefault();
		onFix(word._id, editEnglish, editVietnamese, editExample);
		setIsEditing(false);
	};

	return (
		<>
			<div className="grid grid-cols-12 items-center text-sm p-4 bg-[#161c2e] hover:bg-[#1c243b] border border-slate-800/50 rounded-xl transition-all duration-150">
				{/* Word */}
				<div className="col-span-2 font-serif text-lg text-amber-100/90 font-medium">
					{index + 1}. {word.english}
				</div>
				{/* IPA */}
				<div className="col-span-2 text-slate-400 font-mono text-sm">
					{word.pronunciation}
				</div>
				{/* Definition */}
				<div className="col-span-2 text-slate-300">{word.vietnamese}</div>
				{/* Example */}
				<div className="col-span-3 text-slate-400 italic truncate">
					{word.example}
				</div>
				{/* Status */}
				<div className="col-span-1">
					<span
						className={`inline-flex text-xs px-2.5 py-1 rounded-full border font-medium ${
							word.status === true
								? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
								: "bg-amber-500/10 text-amber-300 border-amber-500/20"
						}`}
					>
						{word.status === true ? "Đã học" : "Chưa học"}
					</span>
				</div>

				{/* Actions */}
				<div className="col-span-2 flex justify-end gap-1">
					{/* Edit */}
					<button
						onClick={() => setIsEditing(!isEditing)}
						className="p-1.5 hover:bg-slate-700/50 rounded-md hover:text-slate-200 transition-colors"
					>
						<Edit2 className="w-3.5 h-3.5" />
					</button>
					{/* delete */}
					<button
						onClick={() => onDelete(word._id)}
						className="p-1.5 hover:bg-slate-700/50 rounded-md hover:text-red-400 transition-colors"
					>
						<Trash2 className="w-3.5 h-3.5" />
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
