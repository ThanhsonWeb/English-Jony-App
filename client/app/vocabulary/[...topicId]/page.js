"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import {
	Search,
	Plus,
	Edit2,
	Trash2,
	Check,
	ChevronRight,
	Filter,
} from "lucide-react";
import Word from "@/app/_components/Word.jsx";

export default function VocabularyPage() {
	const { topicId } = useParams();
	const [words, setWords] = useState([
		{
			id: 1,
			english: "Hello",
			pronunciation: "/həˈloʊ/",
			vietnamese: "xin chào",
			example: "Hello, how are you?",
			status: "Chưa học",
		},
		{
			id: 2,
			english: "Goodbye",
			pronunciation: "/həˈloʊ/",
			vietnamese: "Tam biet",
			example: '"It was pure serendipity that we met."',

			status: "Đã học",
		},
	]);

	useEffect(() => {
		async function fetchData() {
			try {
				const res = await fetch(
					`${process.env.NEXT_PUBLIC_API_URL}/api/v1/vocab/${topicId}`,
					{
						method: "GET",
						headers: {
							"Content-Type": "application/json",
						},
					},
				);
				const data = await res.json();

				// setWords(data.data);
				console.log(data);
			} catch (err) {
				console.error(err);
			}
		}

		fetchData();
	}, [topicId]);

	return (
		<div className="min-h-screen bg-[#0b0f19] text-slate-100 p-8 flex flex-col items-center font-sans">
			<div className="w-full max-w-5xl space-y-6">
				{/* Header Title */}
				<h1 className="text-3xl font-bold tracking-tight text-white">
					Vocabulary List
				</h1>

				{/* Search & Actions Bar */}
				<div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
					{/* Search Input */}
					<div className="relative w-full sm:w-80">
						<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
						<input
							type="text"
							placeholder="Search vocabulary..."
							className="w-full pl-10 pr-4 py-2.5 bg-[#131927] border border-slate-800 rounded-lg text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
						/>
					</div>

					{/* Filters & Add Button */}
					<div className="flex items-center gap-3 w-full sm:w-auto justify-end">
						<div className="relative">
							<select className="appearance-none bg-[#131927] border border-slate-800 text-slate-300 text-sm py-2.5 pl-9 pr-8 rounded-lg focus:outline-none focus:border-blue-500 cursor-pointer">
								<option value="all">Filter</option>
								<option value="all">All</option>
								<option value="to-learn">To Learn</option>
								<option value="learned">Learned</option>
							</select>
							<Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
						</div>

						<button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm px-4 py-2.5 rounded-lg shadow-lg shadow-blue-600/20 transition-all cursor-pointer">
							<Plus className="w-4 h-4" />
							<span>Add New Word</span>
						</button>
					</div>
				</div>

				{/* Main Table Container */}
				<div className="bg-[#111625]/60 border border-slate-800/80 rounded-xl p-4 backdrop-blur-sm shadow-2xl">
					{/* Header */}
					<div className="grid grid-cols-12 items-center px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
						<div className="col-span-2">Từ</div>
						<div className="col-span-2">IPA</div>
						<div className="col-span-2">Nghĩa</div>
						<div className="col-span-3">Ví dụ</div>
						<div className="col-span-1">Status</div>
						<div className="col-span-2 text-right">Thao Tác</div>
					</div>

					{/* Table Rows */}
					<div className="mt-3 space-y-2">
						{words.map((item, index) => (
							<Word key={item.id} item={item} index={index} />
						))}
					</div>
					{/* Pagination Footer */}
					<div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-800/60 text-xs text-slate-400 px-2">
						<span>Page 1 of 5</span>
						<div className="flex gap-2">
							<button className="px-3 py-1.5 bg-[#161c2e] border border-slate-800 rounded-lg hover:bg-slate-800 text-slate-300 disabled:opacity-50">
								Previous
							</button>
							<button className="px-3 py-1.5 bg-[#161c2e] border border-slate-800 rounded-lg hover:bg-slate-800 text-slate-300">
								Next
							</button>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
