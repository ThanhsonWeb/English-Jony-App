"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays } from "lucide-react";

function Topic({ topic, onDelete, onFix, words }) {
	const router = useRouter();
	const dropdownRef = useRef(null);
	const [isMenuOpen, setIsMenuOpen] = useState(false);
	const [isEditing, setIsEditing] = useState(false);
	const [editName, setEditName] = useState(topic.name);
	const [editDesc, setEditDesc] = useState(topic.description || "");

	const formatDate = (dateString) => {
		if (!dateString) return "";
		return new Intl.DateTimeFormat("vi-US", {
			month: "long",
			day: "numeric",
			year: "numeric",
		}).format(new Date(dateString));
	};

	const handleEditSubmit = (e) => {
		e.preventDefault();
		onFix(topic._id, editName, editDesc);
		setIsEditing(false);
	};
	// handleClickOutSide
	useEffect(() => {
		function handleClickOutside(event) {
			if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
				setIsMenuOpen(false);
			}
		}

		document.addEventListener("mousedown", handleClickOutside);

		return () => {
			document.removeEventListener("mousedown", handleClickOutside);
		};
	}, []);

	return (
		<div ref={dropdownRef} className="relative">
			<div
				onClick={() => router.push(`/wordlist/${topic._id}`)}
				className="block p-6 border border-slate-800 bg-slate-900/80 hover:bg-slate-900 rounded-2xl hover:border-blue-500/40 transition-all group shadow-sm hover:shadow-md cursor-pointer"
			>
				<div className="flex items-start justify-between gap-2">
					<h3 className="font-semibold text-slate-100 text-2xl group-hover:text-blue-400 transition-colors">
						{topic.name}
					</h3>

					<button
						onClick={(e) => {
							e.stopPropagation();
							setIsMenuOpen((open) => !open);
						}}
						className="p-1.5 hover:bg-slate-700/50 rounded-md hover:text-slate-200 transition-colors text-slate-400 hover:text-white text-2xl leading-none cursor-pointer "
					>
						...
					</button>
				</div>
				{/* date */}
				{topic.createdAt && (
					<span className="mt-1 flex items-center gap-2 text-sm text-slate-500">
						<CalendarDays className="h-4 w-4" />
						{formatDate(topic.createdAt)}
					</span>
				)}
				<p className="text-slate-400 text-md line-clamp-2 min-h-[2.5rem] mt-4">
					{topic.description || "There is no description"}
				</p>
				<div className="text-slate-300 flex items-center justify-between mt-6 pt-4 border-t border-slate-800/80">
					<span className="text-lg text-slate-400 font-medium">
						<strong className="text-slate-100">{words?.length || 0} </strong>
						Từ
					</span>
					<span className="bg-gray-600 hover:bg-blue-500 text-white text-sm py-1.5 px-4 rounded-lg font-medium transition-colors">
						Learn
					</span>
				</div>
			</div>

			{/* Dropdown Menu */}
			{isMenuOpen && (
				<div className="absolute right-4 top-16 bg-slate-800 border border-slate-700 rounded-xl overflow-hidden w-36 z-20 shadow-xl">
					<button
						onClick={(e) => {
							e.stopPropagation();
							setIsMenuOpen(false);
							setIsEditing(true); // Open edit modal
						}}
						className="w-full text-left px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-700 transition-colors"
					>
						Edit
					</button>
					<button
						onClick={(e) => {
							e.stopPropagation();
							setIsMenuOpen(false);
							onDelete(topic._id);
						}}
						className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-slate-700 transition-colors"
					>
						Xóa
					</button>
				</div>
			)}

			{/* Edit Modal */}
			{isEditing && (
				<div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
					<form
						onSubmit={handleEditSubmit}
						onClick={(e) => e.stopPropagation()}
						className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-8 flex flex-col gap-4"
					>
						<h4 className="text-xl font-bold text-slate-100">Chỉnh sửa</h4>

						<div className="flex flex-col gap-1">
							<label className="text-sm font-medium text-slate-300">
								Tiêu đề
							</label>
							<input
								type="text"
								value={editName}
								onChange={(e) => setEditName(e.target.value)}
								className="border border-slate-700/80 bg-slate-950/50 p-3 rounded-xl text-slate-100 focus:outline-none focus:border-blue-500"
								required
							/>
						</div>

						<div className="flex flex-col gap-1">
							<label className="text-sm font-medium text-slate-300">
								Ghi chú
							</label>
							<textarea
								value={editDesc}
								onChange={(e) => setEditDesc(e.target.value)}
								rows={3}
								className="border border-slate-700/80 bg-slate-950/50 p-3 rounded-xl text-slate-100 focus:outline-none focus:border-blue-500"
							/>
						</div>

						<div className="flex gap-3 mt-2">
							<button
								type="button"
								onClick={() => setIsEditing(false)}
								className="flex-1 p-3 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors"
							>
								Hủy
							</button>
							<button
								type="submit"
								className="flex-1 p-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors"
							>
								Lưu
							</button>
						</div>
					</form>
				</div>
			)}
		</div>
	);
}

export default Topic;
