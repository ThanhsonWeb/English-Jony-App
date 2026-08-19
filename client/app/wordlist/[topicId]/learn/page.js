"use client";

import { useParams, useRouter } from "next/navigation";
import {
	PenLine,
	Layers3,
	Brain,
	X,
	CheckCircle2,
	RotateCcw,
	Target,
} from "lucide-react";

export default function LearnPage() {
	const { topicId } = useParams();
	const router = useRouter();

	return (
		<div className="min-h-[calc(100vh-80px)] bg-[#030616] px-4 py-7 sm:px-6 sm:py-10">
			<div className="mx-auto w-full max-w-6xl">
				{/* Top */}
				<div className="relative mb-8 text-center sm:mb-10">
					<button
						onClick={() => router.back()}
						className="absolute right-0 top-0 rounded-xl border border-slate-800 bg-slate-900/70 p-2.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
					>
						<X size={20} />
					</button>

					<div className="mx-auto inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1.5 text-xs font-medium text-blue-400">
						✨ Chế độ học tập
					</div>

					<h1 className="mx-auto mt-4 max-w-3xl text-3xl font-bold leading-tight tracking-tight text-white sm:text-5xl">
						Bạn muốn học theo cách nào hôm nay? 😊
					</h1>

					<p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-slate-400 sm:text-base">
						Chọn một chế độ phù hợp để ôn tập hiệu quả và ghi nhớ từ vựng
						lâu hơn.
					</p>
				</div>

				{/* Main container */}
				<div className="rounded-3xl border border-blue-500/20 bg-[#071022]/70 p-3 shadow-[0_0_60px_-30px_rgba(59,130,246,0.6)] sm:p-5">
					<div className="grid gap-4 md:grid-cols-3">
						{/* Write */}
						<button
							onClick={() =>
								router.push(`/wordlist/${topicId}/learn/write`)
							}
							className="group relative overflow-hidden rounded-3xl border border-purple-500/30 bg-gradient-to-b from-purple-500/15 via-[#16102a] to-[#090d19] p-5 text-left transition-all duration-300 hover:-translate-y-1 hover:border-purple-400/60 hover:shadow-[0_0_35px_rgba(168,85,247,0.18)] sm:p-6"
						>
							{/* Visual */}
							<div className="relative mb-6 flex h-40 items-center justify-center overflow-hidden rounded-2xl bg-purple-500/5">
								<div className="absolute h-28 w-28 rounded-full bg-purple-500/20 blur-3xl" />

								<div className="relative rotate-[-8deg] rounded-2xl border border-purple-400/30 bg-purple-500/10 p-5 shadow-2xl">
									<PenLine className="h-14 w-14 text-purple-300" />
								</div>

								<div className="absolute bottom-4 right-8 h-16 w-24 rotate-6 rounded-xl border border-purple-500/20 bg-purple-500/5" />
							</div>

							<div className="text-center">
								<h2 className="text-2xl font-bold text-white">Viết từ</h2>

								<p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-slate-400">
									Tự nhập câu trả lời để luyện khả năng nhớ mặt chữ và
									chính tả.
								</p>
							</div>

							<div className="my-5 border-t border-purple-500/10" />

							<div className="flex flex-wrap justify-center gap-3 text-xs text-slate-400">
								<span className="inline-flex items-center gap-1">
									<PenLine size={14} className="text-purple-400" />
									Chính tả
								</span>

								<span className="inline-flex items-center gap-1">
									<Brain size={14} className="text-purple-400" />
									Ghi nhớ sâu
								</span>

								<span className="inline-flex items-center gap-1">
									<Target size={14} className="text-purple-400" />
									Tập trung
								</span>
							</div>

							<div className="mt-6 flex items-center justify-between rounded-full border border-purple-500/30 bg-purple-500/10 px-5 py-3 text-sm font-semibold text-purple-300 transition group-hover:bg-purple-500/20">
								<span>Bắt đầu học</span>
								<span className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-200 text-purple-900">
									→
								</span>
							</div>
						</button>

						{/* Flashcard */}
						<button
							onClick={() =>
								router.push(`/wordlist/${topicId}/learn/flashcard`)
							}
							className="group relative overflow-hidden rounded-3xl border border-emerald-500/30 bg-gradient-to-b from-emerald-500/15 via-[#08201d] to-[#090d19] p-5 text-left transition-all duration-300 hover:-translate-y-1 hover:border-emerald-400/60 hover:shadow-[0_0_35px_rgba(16,185,129,0.18)] sm:p-6"
						>
							{/* Visual */}
							<div className="relative mb-6 flex h-40 items-center justify-center overflow-hidden rounded-2xl bg-emerald-500/5">
								<div className="absolute h-28 w-28 rounded-full bg-emerald-500/20 blur-3xl" />

								<div className="absolute translate-x-5 rotate-6 rounded-2xl border border-emerald-400/20 bg-emerald-500/5 p-8" />

								<div className="absolute -translate-x-3 -rotate-6 rounded-2xl border border-emerald-400/20 bg-emerald-500/5 p-8" />

								<div className="relative rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-5 shadow-2xl">
									<Layers3 className="h-14 w-14 text-emerald-300" />
								</div>
							</div>

							<div className="text-center">
								<h2 className="text-2xl font-bold text-white">Flashcard</h2>

								<p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-slate-400">
									Ôn tập nhanh bằng thẻ lật để tăng khả năng ghi nhớ từ
									vựng.
								</p>
							</div>

							<div className="my-5 border-t border-emerald-500/10" />

							<div className="flex flex-wrap justify-center gap-3 text-xs text-slate-400">
								<span className="inline-flex items-center gap-1">
									<RotateCcw size={14} className="text-emerald-400" />
									Ôn nhanh
								</span>

								<span className="inline-flex items-center gap-1">
									<Layers3 size={14} className="text-emerald-400" />
									Lật thẻ
								</span>

								<span className="inline-flex items-center gap-1">
									<CheckCircle2 size={14} className="text-emerald-400" />
									Hiệu quả
								</span>
							</div>

							<div className="mt-6 flex items-center justify-between rounded-full border border-emerald-500/30 bg-emerald-500/10 px-5 py-3 text-sm font-semibold text-emerald-300 transition group-hover:bg-emerald-500/20">
								<span>Bắt đầu học</span>
								<span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-200 text-emerald-900">
									→
								</span>
							</div>
						</button>

						{/* Quiz */}
						<button
							onClick={() =>
								router.push(`/wordlist/${topicId}/learn/quiz`)
							}
							className="group relative overflow-hidden rounded-3xl border border-cyan-500/30 bg-gradient-to-b from-cyan-500/15 via-[#08192a] to-[#090d19] p-5 text-left transition-all duration-300 hover:-translate-y-1 hover:border-cyan-400/60 hover:shadow-[0_0_35px_rgba(34,211,238,0.18)] sm:p-6"
						>
							{/* Visual */}
							<div className="relative mb-6 flex h-40 items-center justify-center overflow-hidden rounded-2xl bg-cyan-500/5">
								<div className="absolute h-28 w-28 rounded-full bg-cyan-500/20 blur-3xl" />

								<div className="relative rounded-2xl border border-cyan-400/30 bg-cyan-500/10 p-5 shadow-2xl">
									<Brain className="h-14 w-14 text-cyan-300" />
								</div>

								<div className="absolute bottom-5 right-10 flex h-10 w-10 items-center justify-center rounded-full border border-cyan-400/30 bg-cyan-500/10 text-lg font-bold text-cyan-300">
									?
								</div>
							</div>

							<div className="text-center">
								<h2 className="text-2xl font-bold text-white">
									Trắc nghiệm
								</h2>

								<p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-slate-400">
									Kiểm tra khả năng ghi nhớ bằng các câu hỏi nhanh và trực
									quan.
								</p>
							</div>

							<div className="my-5 border-t border-cyan-500/10" />

							<div className="flex flex-wrap justify-center gap-3 text-xs text-slate-400">
								<span className="inline-flex items-center gap-1">
									<CheckCircle2 size={14} className="text-cyan-400" />
									Kiểm tra
								</span>

								<span className="inline-flex items-center gap-1">
									<Target size={14} className="text-cyan-400" />
									Đánh giá
								</span>

								<span className="inline-flex items-center gap-1">
									<Brain size={14} className="text-cyan-400" />
									Thử thách
								</span>
							</div>

							<div className="mt-6 flex items-center justify-between rounded-full border border-cyan-500/30 bg-cyan-500/10 px-5 py-3 text-sm font-semibold text-cyan-300 transition group-hover:bg-cyan-500/20">
								<span>Bắt đầu học</span>
								<span className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-200 text-cyan-900">
									→
								</span>
							</div>
						</button>
					</div>
				</div>

				{/* Footer message */}
				<div className="mt-7 flex justify-center">
					<div className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/50 px-4 py-2 text-xs text-slate-500">
						🛡️ Học mỗi ngày — Tiến bộ từng chút một
					</div>
				</div>
			</div>
		</div>
	);
}