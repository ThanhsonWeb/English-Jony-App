"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { lessonData } from "./_data/lessonData";
import { useEffect, useState } from "react";
import Image from "next/image";
const courseImages = {
	"office-introduction":
		"/dialogue/office-introduction/thumbnails/meeting-tom.png",
	"coffee-shop": "/dialogue/coffee-shop/thumbnail.png",
	airport: "/dialogue/airport/thumbnail.png",
};
export default function DialoguePage() {
	const courses = Object.values(lessonData);

	const [currentCourseId, setCurrentCourseId] = useState(null);

	useEffect(() => {
		async function loadCurrentCourse() {
			try {
				const res = await fetch("/api/v1/dialogue-progress/latest", {
					credentials: "include",
				});

				if (!res.ok) {
					throw new Error("Failed to load latest dialogue progress");
				}

				const data = await res.json();

				setCurrentCourseId(data.data.progress?.lessonId || null);
			} catch (error) {
				console.error(error);
			}
		}

		loadCurrentCourse();
	}, []);

	const currentCourse =
		courses.find((course) => course.id === currentCourseId) || null;

	const otherCourses = courses.filter(
		(course) => course.id !== currentCourse?.id,
	);

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

						<div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/40 p-5 sm:p-6">
							<div className="flex flex-col gap-5 md:flex-row md:items-center">
								{/* Thumbnail */}
								<div className="relative h-28 w-full shrink-0 overflow-hidden rounded-xl md:w-40">
									<Image
										src="/dialogue/office-introduction/thumbnails/meeting-tem.png"
										alt={currentCourse.title}
										fill
										className="object-cover"
										sizes="(max-width: 768px) 100vw, 160px"
									/>
								</div>

								{/* Content */}
								<div className="min-w-0 flex-1">
									<div className="flex flex-wrap items-center gap-3">
										<h3 className="text-xl font-bold sm:text-2xl">
											{currentCourse.title}
										</h3>

										<span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-400">
											{currentCourse.level}
										</span>
									</div>

									<p className="mt-3 max-w-3xl leading-relaxed text-slate-400">
										{currentCourse.description}
									</p>

									<p className="mt-4 text-sm text-slate-500">
										{currentCourse.dialogues.length} hội thoại
									</p>
								</div>

								{/* CTA */}
								<Link
									href={`/dialogue/${currentCourse.id}`}
									className="inline-flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-5 py-3 font-semibold text-white shadow-lg shadow-blue-950/30 transition hover:-translate-y-0.5 hover:from-blue-500 hover:to-violet-500"
								>
									Tiếp tục học →
								</Link>
							</div>
						</div>
					</div>
				)}

				{/* Other courses */}
				{otherCourses.length > 0 && (
					<div className="mt-8">
						<h2 className="text-xl font-semibold">Khám phá hội thoại</h2>

						<div className="mt-4 grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
							{otherCourses.map((course) => (
								<Link
									key={course.id}
									href={`/dialogue/${course.id}`}
									className="
		group block rounded-2xl p-3
		transition-all duration-300
		hover:bg-slate-900/70
		hover:shadow-[0_16px_45px_rgba(0,0,0,0.5)]
	"
								>
									{/* Thumbnail */}
									<div className="relative aspect-video overflow-hidden rounded-xl bg-slate-900">
										<Image
											src="/dialogue/office-introduction/thumbnails/meeting-tem.png"
											alt={course.title}
											fill
											className="object-cover transition duration-300 group-hover:scale-[1.02]"
											sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
										/>

										{/* Small badge */}
										<span className="absolute bottom-2 right-2 rounded-md bg-black/75 px-2 py-1 text-xs font-semibold text-white">
											{course.dialogues.length} hội thoại
										</span>
									</div>

									{/* Info */}
									<div className="mt-3">
										<h3 className="line-clamp-2 text-base font-semibold leading-snug text-white ">
											{course.title}
										</h3>

										<p className="mt-1 line-clamp-2 text-sm leading-relaxed text-slate-400">
											{course.description}
										</p>

										<div className="mt-2 flex items-center gap-2 text-sm">
											<span className="text-emerald-400">{course.level}</span>

											<span className="text-slate-600">•</span>

											<span className="text-slate-500">Bắt đầu học</span>
										</div>
									</div>
								</Link>
							))}
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
