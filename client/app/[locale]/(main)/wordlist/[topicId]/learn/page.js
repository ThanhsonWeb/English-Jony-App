"use client";

import { useParams, useRouter } from "next/navigation";
import {
	ArrowRight,
	Brain,
	Clock3,
	Layers3,
	PenLine,
	Sparkles,
	X,
} from "lucide-react";

const learningModes = [
	{
		id: "write",
		title: "Viết từ",
		description: "Tự nhập câu trả lời để luyện chính tả và ghi nhớ sâu hơn.",
		detail: "Tập trung cao",
		time: "5–10 phút",
		Icon: PenLine,
		accent: "purple",
	},
	{
		id: "flashcard",
		title: "Flashcard",
		description: "Lật thẻ và ôn tập nhanh theo nhịp độ của riêng bạn.",
		detail: "Dễ bắt đầu",
		time: "3–5 phút",
		Icon: Layers3,
		accent: "emerald",
		recommended: true,
	},
	{
		id: "quiz",
		title: "Trắc nghiệm",
		description: "Kiểm tra khả năng ghi nhớ bằng những câu hỏi ngắn, trực quan.",
		detail: "Kiểm tra nhanh",
		time: "5 phút",
		Icon: Brain,
		accent: "cyan",
	},
];

const modeStyles = {
	purple: {
		card: "hover:border-purple-400/45 hover:shadow-purple-950/25",
		icon: "border-purple-400/20 bg-purple-500/10 text-purple-300",
		glow: "bg-purple-500/10",
		cta: "text-purple-300 group-hover:bg-purple-400 group-hover:text-purple-950",
	},
	emerald: {
		card: "border-emerald-500/30 hover:border-emerald-400/60 hover:shadow-emerald-950/30",
		icon: "border-emerald-400/25 bg-emerald-500/10 text-emerald-300",
		glow: "bg-emerald-500/10",
		cta: "text-emerald-300 group-hover:bg-emerald-400 group-hover:text-emerald-950",
	},
	cyan: {
		card: "hover:border-cyan-400/45 hover:shadow-cyan-950/25",
		icon: "border-cyan-400/20 bg-cyan-500/10 text-cyan-300",
		glow: "bg-cyan-500/10",
		cta: "text-cyan-300 group-hover:bg-cyan-400 group-hover:text-cyan-950",
	},
};

export default function LearnPage() {
	const { topicId } = useParams();
	const router = useRouter();

	return (
		<main className="min-h-[calc(100vh-80px)] bg-[#030616] px-4 py-8 text-white sm:px-6 sm:py-12">
			<div className="mx-auto w-full max-w-6xl">
				<header className="relative mx-auto max-w-3xl text-center">
					<button
						type="button"
						onClick={() => router.back()}
						aria-label="Đóng trang chọn chế độ học"
						className="absolute right-0 top-0 grid h-10 w-10 place-items-center rounded-full border border-slate-800 bg-slate-900/60 text-slate-500 transition hover:border-slate-700 hover:bg-slate-800 hover:text-white sm:-right-12"
					>
						<X className="h-5 w-5" />
					</button>

					<div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-emerald-400/20 bg-emerald-500/10 text-emerald-300">
						<Sparkles className="h-5 w-5" />
					</div>
					<p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">
						Chọn cách học
					</p>
					<h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
						Hôm nay bạn muốn học thế nào?
					</h1>
					<p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-400 sm:text-base">
						Mỗi chế độ rèn một kỹ năng khác nhau. Chọn cách phù hợp với thời
						gian của bạn.
					</p>
				</header>

				<section className="mt-10 grid gap-4 md:grid-cols-3" aria-label="Các chế độ học">
					{learningModes.map((mode) => {
						const styles = modeStyles[mode.accent];
						const Icon = mode.Icon;

						return (
							<button
								key={mode.id}
								type="button"
								onClick={() =>
									router.push(`/wordlist/${topicId}/learn/${mode.id}`)
								}
								className={`group relative overflow-hidden rounded-3xl border border-slate-800 bg-[#0c1423] p-6 text-left shadow-2xl transition duration-300 hover:-translate-y-1 ${styles.card}`}
							>
								<div
									className={`pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full blur-3xl ${styles.glow}`}
								/>

								<div className="relative flex min-h-64 flex-col">
									<div className="flex items-start justify-between gap-3">
										<div className={`grid h-14 w-14 place-items-center rounded-2xl border ${styles.icon}`}>
											<Icon className="h-6 w-6" />
										</div>
										{mode.recommended && (
											<span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
												Gợi ý
											</span>
										)}
									</div>

									<h2 className="mt-7 text-2xl font-bold">{mode.title}</h2>
									<p className="mt-2 min-h-12 text-sm leading-6 text-slate-400">
										{mode.description}
									</p>

									<div className="mt-5 flex items-center gap-4 border-t border-slate-800 pt-4 text-xs text-slate-500">
										<span>{mode.detail}</span>
										<span className="inline-flex items-center gap-1.5">
											<Clock3 className="h-3.5 w-3.5" />
											{mode.time}
										</span>
									</div>

									<div className="mt-auto flex items-center justify-between pt-7 text-sm font-semibold text-slate-200">
										<span>Bắt đầu</span>
										<span className={`grid h-9 w-9 place-items-center rounded-full bg-slate-800 transition duration-300 group-hover:translate-x-1 ${styles.cta}`}>
											<ArrowRight className="h-4 w-4" />
										</span>
									</div>
								</div>
							</button>
						);
					})}
				</section>

				<p className="mt-7 text-center text-xs text-slate-600">
					Bạn có thể đổi chế độ bất cứ lúc nào.
				</p>
			</div>
		</main>
	);
}
