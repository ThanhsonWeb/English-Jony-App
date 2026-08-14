"use client";

import { useParams, useRouter } from "next/navigation";
import { Gamepad2, Layers3, Brain, X } from "lucide-react";

export default function LearnPage() {
	const { topicId } = useParams();
	const router = useRouter();

	return (
		<div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
			<div className="relative w-full max-w-4xl rounded-3xl border border-slate-800 bg-slate-900 p-8 shadow-2xl">
				<button
					onClick={() => router.back()}
					className="absolute right-6 top-6 rounded-full border border-slate-700 p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
				>
					<X size={20} />
				</button>

				<p className="text-sm font-semibold uppercase tracking-[0.25em] text-purple-400">
					Chế độ học tập
				</p>

				<h1 className="mt-3 text-3xl font-bold text-white">
					Học đều mỗi ngày, tiến bộ từng chút một. 😊
				</h1>

				<div className="mt-8 grid gap-4 md:grid-cols-3">
					<button
						onClick={() => router.push(`/wordlist/${topicId}/learn/write`)}
						className="rounded-2xl border border-purple-500/20 bg-purple-500/5 p-6 text-left transition hover:-translate-y-1 hover:border-purple-400/50 hover:bg-purple-500/10"
					>
						<Gamepad2 className="mb-5 text-purple-400" />
						<h2 className="text-lg font-bold text-white">Viết tay</h2>
						<p className="mt-2 text-sm text-slate-400">
							Luyện ghi nhớ từ bằng cách tự nhập câu trả lời.
						</p>
					</button>

					<button
						onClick={() => router.push(`/wordlist/${topicId}/learn/flashcard`)}
						className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6 text-left transition hover:-translate-y-1 hover:border-emerald-400/50 hover:bg-emerald-500/10"
					>
						<Layers3 className="mb-5 text-emerald-400" />
						<h2 className="text-lg font-bold text-white">Flashcard</h2>
						<p className="mt-2 text-sm text-slate-400">
							Ôn tập nhanh bằng thẻ lật và ghi nhớ từ vựng.
						</p>
					</button>

					<button
						onClick={() => router.push(`/wordlist/${topicId}/learn/quiz`)}
						className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-6 text-left transition hover:-translate-y-1 hover:border-cyan-400/50 hover:bg-cyan-500/10"
					>
						<Brain className="mb-5 text-cyan-400" />
						<h2 className="text-lg font-bold text-white">Trắc nghiệm</h2>
						<p className="mt-2 text-sm text-slate-400">
							Kiểm tra khả năng ghi nhớ bằng câu hỏi nhanh.
						</p>
					</button>
				</div>
			</div>
		</div>
	);
}
