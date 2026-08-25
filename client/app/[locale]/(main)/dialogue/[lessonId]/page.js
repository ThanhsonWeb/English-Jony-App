"use client";

import Link from "next/link";
import { ArrowLeft, BookOpen, Clock3, CheckCircle2 } from "lucide-react";

export default function DialogueLessonPage() {
	const lessons = Array.from({ length: 33 }, (_, i) => ({
		id: i + 1,
		completed: i < 3,
	}));

	return (
		<div className="min-h-screen px-4 py-8 text-white sm:px-8">
			<div className="mx-auto max-w-5xl">
				{/* Back */}
				<Link
					href="/dialogue"
					className="inline-flex items-center gap-2 text-slate-400 hover:text-white"
				>
					<ArrowLeft size={18} />
					Quay lại
				</Link>

				{/* Course info */}
				<div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
					<h1 className="text-2xl font-bold sm:text-3xl">
						Ngày đầu tiên tại văn phòng 🏢
					</h1>

					<p className="mt-3 max-w-2xl text-slate-400">
						Maria gặp Tom trong ngày đầu đi làm. Học cách giới thiệu bản thân và
						giao tiếp với đồng nghiệp.
					</p>

					<div className="mt-5 flex flex-wrap gap-5 text-sm text-slate-400">
						<span className="flex items-center gap-2">
							<BookOpen size={16} />
							33 bài học
						</span>

						<span className="flex items-center gap-2">
							<Clock3 size={16} />
							~25 phút
						</span>

						<span className="flex items-center gap-2">
							<CheckCircle2 size={16} />
							3/33 hoàn thành
						</span>
					</div>

					<div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-800">
						<div className="h-full w-[9%] rounded-full bg-green-500" />
					</div>
				</div>

				{/* Lessons */}
				<div className="mt-10">
					<h2 className="text-xl font-semibold">Các bài học</h2>

					<div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6">
						{lessons.map((lesson) => (
							<Link
								key={lesson.id}
								href={`/dialogue/office-introduction/${lesson.id}`}
								className={`flex h-16 items-center justify-center rounded-xl border font-semibold transition ${
									lesson.completed
										? "border-green-500/30 bg-green-500/10 text-green-400"
										: "border-slate-800 bg-slate-900 text-slate-300 hover:border-blue-500 hover:text-white"
								}`}
							>
								{lesson.completed ? "✓ " : ""}
								Bài {lesson.id}
							</Link>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}
