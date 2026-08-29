"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { lessonData } from "./_data/lessonData";

export default function DialoguePage() {
	const courses = Object.values(lessonData);

	const currentCourse = courses[0]; //office-introduction
	const otherCourses = courses.slice(1);

	return (
		<div className="min-h-screen px-4 py-8 text-white sm:px-8">
			<div className="mx-auto max-w-6xl">
				{/* Hero */}
				<div className="relative min-h-[300px] overflow-hidden rounded-xl bg-[#020817]">
					{/* Content */}
					<div className="relative   ">
						<div className="max-w-[520px]">
							<h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
								Hội thoại thực tế
								<span aria-hidden="true">🎧</span>
							</h1>

							<p className="mt-3 text-base text-slate-400">
								Luyện nghe và phản xạ qua các tình huống đời thường.
							</p>

							<div className="relative mt-7 max-w-[485px]">
								<Search
									size={20}
									className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
								/>

								<input
									type="text"
									placeholder="Tìm kiếm hội thoại..."
									className="h-14 w-full rounded-xl border border-slate-800 bg-[#0b1428]/90 pl-12 pr-4 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10"
								/>
							</div>
						</div>
					</div>
					{/* Right-side image */}
					<div className="absolute inset-y-0 right-0 hidden w-[52%] md:block">
						<img
							src="/hero-img.png"
							alt="Maria và Tom đang trò chuyện"
							className="h-full w-full object-cover object-center"
						/>

						{/* Blend image into background */}
						<div className="absolute inset-0 bg-gradient-to-r from-[#020817] via-[#020217]/2 to-transparent" />
					</div>
				</div>

				{/* Current course */}
				{currentCourse && (
					<div className="mt-3">
						<h2 className="text-xl font-semibold">Đang học</h2>

						<div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
							<div className="flex flex-col gap-6 md:flex-row md:items-center">
								<div className="flex h-32 w-full items-center justify-center rounded-xl bg-slate-800 text-5xl md:w-40">
									🏢
								</div>

								<div className="flex-1">
									<h3 className="text-2xl font-bold">{currentCourse.title}</h3>

									<p className="mt-2 text-sm text-green-400">
										{currentCourse.level}
									</p>

									<p className="mt-3 text-slate-400">
										{currentCourse.description}
									</p>

									<p className="mt-4 text-sm text-slate-500">
										{currentCourse.dialogues.length} hội thoại
									</p>
								</div>

								<Link
									href={`/dialogue/${currentCourse.id}`}
									className="rounded-xl bg-blue-600 px-5 py-3 text-center font-semibold hover:bg-blue-500"
								>
									Tiếp tục học →
								</Link>
							</div>
						</div>
					</div>
				)}

				{/* Other courses */}
				{otherCourses.length > 0 && (
					<div className="mt-10">
						<h2 className="text-xl font-semibold">Khám phá hội thoại</h2>

						<div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
							{otherCourses.map((course) => (
								<Link
									key={course.id}
									href={`/dialogue/${course.id}`}
									className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 transition hover:border-blue-500/40"
								>
									<h3 className="font-semibold">{course.title}</h3>

									<p className="mt-2 text-sm text-green-400">{course.level}</p>

									<p className="mt-2 text-sm text-slate-500">
										{course.dialogues.length} hội thoại
									</p>

									<p className="mt-5 text-sm text-blue-400">Bắt đầu học →</p>
								</Link>
							))}
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
