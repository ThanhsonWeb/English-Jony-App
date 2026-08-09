"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

function Topic({ topic, onDelete }) {
	const router = useRouter();
	const [isMenuOpen, setIsMenuOpen] = useState(false);

	const formatDate = (dateString) => {
		if (!dateString) return "";
		return new Intl.DateTimeFormat("vi-US", {
			month: "long",
			day: "numeric",
			year: "numeric",
		}).format(new Date(dateString));
	};

	return (
		<div className="relative">
			<div
				onClick={() => router.push(`/vocabulary/${topic._id}`)}
				className="block p-6 border border-slate-800 bg-slate-900/80 hover:bg-slate-900 rounded-2xl border-slate-800/80 hover:border-blue-500/40 transition-all group shadow-sm hover:shadow-md"
			>
				<div className="flex items-start justify-between gap-2">
					<h3 className="font-semibold text-slate-100 text-2xl group-hover:text-blue-400 transition-colors">
						{topic.name}
					</h3>

					{/* 3-dot menu */}
					<button
						onClick={(e) => {
							e.stopPropagation(); // Prevents clicking link
							setIsMenuOpen(!isMenuOpen);
						}}
						className="text-slate-400 hover:text-white text-2xl leading-none cursor-pointer mt-1  "
					>
						...
					</button>
				</div>
				{/*  date */}
				{topic.createdAt && (
					<span className="text-sm text-slate-500 shrink-0 mt-1 block">
						{formatDate(topic.createdAt)}
					</span>
				)}
				<p className="text-slate-400 text-md line-clamp-2 min-h-[2.5rem] mt-4">
					{topic.description || "There is no description"}
				</p>
				<div className="text-slate-300 flex items-center justify-between mt-6 pt-4 border-t border-slate-800/80">
					<span className="text-lg text-slate-400 font-medium">
						<strong className="text-slate-100">
							{topic.words?.length || 0}
						</strong>{" "}
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
					<button className="w-full text-left px-4 py-2.5 text-sm text-slate-200 hover:bg-slate-700 transition-colors">
						Chỉnh sửa
					</button>
					<button
						onClick={() => {
							setIsMenuOpen(false);
							onDelete(topic._id);
						}}
						className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-slate-700 transition-colors"
					>
						Xóa
					</button>
				</div>
			)}
		</div>
	);
}

export default Topic;
