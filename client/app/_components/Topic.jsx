"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
	CalendarDays,
	MoreHorizontal,
	BookOpen,
	ArrowRight,
} from "lucide-react";

function Topic({ topic, onDelete, onFix, words }) {
	const router = useRouter();
	const dropdownRef = useRef(null);

	const [isMenuOpen, setIsMenuOpen] = useState(false);
	const [isEditing, setIsEditing] = useState(false);

	const [editName, setEditName] = useState(topic.name);
	const [editDesc, setEditDesc] = useState(topic.description || "");

	const formatDate = (dateString) => {
		if (!dateString) return "";

		return new Intl.DateTimeFormat("vi-VN", {
			month: "long",
			day: "numeric",
			year: "numeric",
		}).format(new Date(dateString));
	};

	// words due for review inside this topic
	const wordsToReview =
		words?.filter(
			(word) => word.nextReview && new Date(word.nextReview) <= new Date(),
		) || [];

	const handleEditSubmit = (e) => {
		e.preventDefault();

		onFix(topic._id, editName, editDesc);

		setIsEditing(false);
	};

	// Close dropdown when clicking outside
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
			{/* ================= TOPIC CARD ================= */}
			<div
				onClick={() => router.push(`/wordlist/${topic._id}`)}
				className="
					group relative overflow-hidden cursor-pointer
					rounded-2xl border border-[#182b52]
					bg-gradient-to-br from-[#0d1930] to-[#091225]
					p-4 sm:p-5
					transition-all duration-300
					hover:border-blue-500/40
					hover:shadow-[0_15px_45px_-20px_rgba(37,99,235,0.45)]
				"
			>
				{/* subtle glow */}
				<div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.08),transparent_45%)]" />

				<div className="relative z-10 flex gap-4">
					{/* ================= ICON ================= */}
					<div
						className="
						hidden sm:flex
						h-28 w-28 shrink-0
						items-center justify-center
						rounded-xl
						border border-blue-500/20
						bg-gradient-to-br from-blue-500/20 to-indigo-500/5
					"
					>
						<div className="flex h-14 w-14 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
							<BookOpen className="h-7 w-7" />
						</div>
					</div>

					{/* ================= CONTENT ================= */}
					<div className="flex min-w-0 flex-1 flex-col">
						{/* title */}
						<div className="flex items-start justify-between gap-3">
							<div className="min-w-0">
								<h3
									className="
									truncate text-xl sm:text-2xl
									font-bold tracking-tight text-white
									transition-colors
									group-hover:text-blue-300
								"
								>
									{topic.name}
								</h3>

								{/* Date */}
								{topic.createdAt && (
									<div className="mt-2 flex items-center gap-2 text-xs sm:text-sm text-slate-500">
										<CalendarDays className="h-4 w-4" />

										<span>{formatDate(topic.createdAt)}</span>
									</div>
								)}
							</div>

							{/* Menu */}
							<button
								type="button"
								onClick={(e) => {
									e.stopPropagation();
									setIsMenuOpen((open) => !open);
								}}
								className="
									shrink-0 rounded-lg p-2
									text-slate-500 transition
									hover:bg-slate-800 hover:text-white
								"
							>
								<MoreHorizontal className="h-5 w-5" />
							</button>
						</div>

						{/* Description */}
						<p
							className="
							mt-4 line-clamp-2
							min-h-[3.25rem]
							text-sm sm:text-base
							leading-relaxed text-slate-400
						"
						>
							{topic.description || "Chưa có mô tả cho danh sách này."}
						</p>

						{/* Bottom */}
						<div
							className="
							mt-auto pt-5
							flex items-end justify-between gap-4
						"
						>
							<div className="flex items-center gap-5">
								{/* total words */}
								<div>
									<div className="flex items-end gap-1">
										<span className="text-xl font-bold text-white">
											{words?.length || 0}
										</span>

										<span className="mb-[2px] text-sm text-blue-300">từ</span>
									</div>
								</div>

								{/* divider */}
								<div className="h-8 w-px bg-slate-800" />

								{/* review */}
								<div>
									<div className="flex items-end gap-1">
										<span
											className={`text-xl font-bold ${
												wordsToReview.length > 0
													? "text-amber-400"
													: "text-emerald-400"
											}`}
										>
											{wordsToReview.length}
										</span>

										<span className="mb-[2px] text-xs text-slate-500">
											cần ôn
										</span>
									</div>
								</div>
							</div>

							{/* Learn button */}
							<button
								type="button"
								onClick={(e) => {
									e.stopPropagation();
									router.push(`/wordlist/${topic._id}`);
								}}
								className="
									flex items-center gap-2
									rounded-lg bg-blue-600
									px-4 py-2
									text-sm font-semibold text-white
									shadow-[0_5px_20px_-8px_rgba(37,99,235,0.8)]
									transition-all
									hover:bg-blue-500
									active:scale-[0.97]
								"
							>
								Học
								<ArrowRight className="h-4 w-4" />
							</button>
						</div>
					</div>
				</div>
			</div>

			{/* ================= DROPDOWN ================= */}
			{isMenuOpen && (
				<div
					className="
					absolute right-4 top-14 z-30
					w-36 overflow-hidden
					rounded-xl border border-slate-700
					bg-[#111b2e]
					shadow-2xl
				"
				>
					<button
						onClick={(e) => {
							e.stopPropagation();
							setIsMenuOpen(false);
							setIsEditing(true);
						}}
						className="
							w-full px-4 py-3
							text-left text-sm text-slate-200
							transition hover:bg-slate-700/60
						"
					>
						Chỉnh sửa
					</button>

					<div className="h-px bg-slate-700/60" />

					<button
						onClick={(e) => {
							e.stopPropagation();
							setIsMenuOpen(false);
							onDelete(topic._id);
						}}
						className="
							w-full px-4 py-3
							text-left text-sm text-red-400
							transition hover:bg-red-500/10
						"
					>
						Xóa
					</button>
				</div>
			)}

			{/* ================= EDIT MODAL ================= */}
			{isEditing && (
				<div
					className="
					fixed inset-0 z-50
					flex items-center justify-center
					bg-black/70 p-4
					backdrop-blur-sm
				"
				>
					<form
						onSubmit={handleEditSubmit}
						onClick={(e) => e.stopPropagation()}
						className="
							w-full max-w-md
							rounded-2xl
							border border-slate-800
							bg-[#0c1426]
							p-6 sm:p-8
							shadow-2xl
						"
					>
						{/* Header */}
						<div>
							<h4 className="text-xl font-bold text-white">
								Chỉnh sửa danh sách
							</h4>

							<p className="mt-1 text-sm text-slate-500">
								Thay đổi tên hoặc ghi chú của danh sách.
							</p>
						</div>

						{/* Name */}
						<div className="mt-6 flex flex-col gap-2">
							<label className="text-sm font-medium text-slate-300">
								Tiêu đề
							</label>

							<input
								type="text"
								value={editName}
								onChange={(e) => setEditName(e.target.value)}
								className="
									rounded-xl border border-slate-700
									bg-slate-950/60
									px-4 py-3
									text-slate-100
									outline-none transition
									focus:border-blue-500
								"
								required
							/>
						</div>

						{/* Description */}
						<div className="mt-4 flex flex-col gap-2">
							<label className="text-sm font-medium text-slate-300">
								Ghi chú
							</label>

							<textarea
								value={editDesc}
								onChange={(e) => setEditDesc(e.target.value)}
								rows={3}
								className="
									resize-none rounded-xl
									border border-slate-700
									bg-slate-950/60
									px-4 py-3
									text-slate-100
									outline-none transition
									focus:border-blue-500
								"
							/>
						</div>

						{/* Actions */}
						<div className="mt-6 flex gap-3">
							<button
								type="button"
								onClick={() => setIsEditing(false)}
								className="
									flex-1 rounded-xl
									border border-slate-700
									py-3
									text-sm font-medium text-slate-300
									transition hover:bg-slate-800
								"
							>
								Hủy
							</button>

							<button
								type="submit"
								className="
									flex-1 rounded-xl
									bg-blue-600 py-3
									text-sm font-semibold text-white
									transition hover:bg-blue-500
								"
							>
								Lưu thay đổi
							</button>
						</div>
					</form>
				</div>
			)}
		</div>
	);
}

export default Topic;
