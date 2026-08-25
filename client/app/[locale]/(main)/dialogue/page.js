"use client";

import Link from "next/link";
import { Search, Clock3, BookOpen, CheckCircle2 } from "lucide-react";

const courses = [
	{
		id: "office-introduction",
		title: "Ngày đầu tiên tại văn phòng",
		description:
			"Maria gặp Tom trong ngày đầu đi làm. Học cách giới thiệu bản thân và giao tiếp trong văn phòng.",
		level: "Beginner",
		lessons: 33,
		duration: "25 phút",
		completed: 4,
		emoji: "🏢",
	},
	{
		id: "coffee-shop",
		title: "Gặp gỡ tại quán cà phê",
		level: "Beginner",
		lessons: 18,
		emoji: "☕",
	},
	{
		id: "airport",
		title: "Tại sân bay",
		level: "Beginner",
		lessons: 24,
		emoji: "✈️",
	},
	{
		id: "interview",
		title: "Phỏng vấn xin việc",
		level: "Intermediate",
		lessons: 20,
		emoji: "💼",
	},
	{
		id: "shopping",
		title: "Mua sắm",
		level: "Beginner",
		lessons: 16,
		emoji: "🛍️",
	},
];

export default function DialoguePage() {
	const currentCourse = courses[0];

	const progress = Math.round(
		(currentCourse.completed / currentCourse.lessons) * 100,
	);

	return (
		<div className="min-h-screen px-4 py-8 text-slate-100 sm:px-8">
			<div className="mx-auto max-w-6xl">
				{/* Hero */}
				<div>
					<h1 className="text-3xl font-bold sm:text-4xl">
						Hội thoại thực tế 🎧
					</h1>

					<p className="mt-2 text-slate-400">
						Luyện nghe và phản xạ qua các tình huống đời thường.
					</p>

					<div className="relative mt-6 max-w-lg">
						<Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />

						<input
							type="text"
							placeholder="Tìm kiếm bài học..."
							className="w-full rounded-xl border border-slate-800 bg-slate-900/70 py-3 pl-12 pr-4 text-sm outline-none transition focus:border-blue-500"
						/>
					</div>
				</div>

				{/* Current course */}
				<div className="mt-10">
					<h2 className="text-xl font-semibold">Đang học</h2>

					<div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
						<div className="flex flex-col gap-6 md:flex-row md:items-center">
							<div className="flex h-36 w-full items-center justify-center rounded-2xl bg-slate-800 text-6xl md:w-52">
								🏢
							</div>

							<div className="flex-1">
								<div className="flex flex-wrap items-center gap-3">
									<h3 className="text-2xl font-bold">
										{currentCourse.title}
									</h3>

									<span className="rounded-full bg-green-500/10 px-3 py-1 text-xs font-medium text-green-400">
										{currentCourse.level}
									</span>
								</div>

								<p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
									{currentCourse.description}
								</p>

								<div className="mt-5 flex flex-wrap gap-5 text-sm text-slate-400">
									<span className="flex items-center gap-2">
										<BookOpen size={16} />
										{currentCourse.lessons} bài học
									</span>

									<span className="flex items-center gap-2">
										<Clock3 size={16} />
										~{currentCourse.duration}
									</span>

									<span className="flex items-center gap-2">
										<CheckCircle2 size={16} />
										{currentCourse.completed}/{currentCourse.lessons} hoàn thành
									</span>
								</div>

								<div className="mt-5 flex items-center gap-4">
									<div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
										<div
											className="h-full rounded-full bg-green-500"
											style={{ width: `${progress}%` }}
										/>
									</div>

									<span className="text-sm text-slate-400">
										{progress}%
									</span>
								</div>
							</div>

							<Link
								href={`/dialogue/${currentCourse.id}`}
								className="rounded-xl bg-blue-600 px-5 py-3 text-center font-semibold text-white transition hover:bg-blue-500"
							>
								Tiếp tục học →
							</Link>
						</div>
					</div>
				</div>

				{/* Explore */}
				<div className="mt-10">
					<h2 className="text-xl font-semibold">Khám phá hội thoại</h2>

					<div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
						{courses.slice(1).map((course) => (
							<Link
								key={course.id}
								href={`/dialogue/${course.id}`}
								className="group rounded-2xl border border-slate-800 bg-slate-900/50 p-5 transition hover:-translate-y-1 hover:border-blue-500/40 hover:bg-slate-900"
							>
								<div className="text-4xl">{course.emoji}</div>

								<h3 className="mt-4 font-semibold text-white">
									{course.title}
								</h3>

								<p className="mt-2 text-sm text-green-400">
									{course.level}
								</p>

								<p className="mt-1 text-sm text-slate-500">
									{course.lessons} bài học
								</p>

								<div className="mt-5 text-sm font-medium text-blue-400">
									Bắt đầu học →
								</div>
							</Link>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}