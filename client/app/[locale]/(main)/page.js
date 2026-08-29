import Link from "next/link";
import {
	ArrowRight,
	Headphones,
	BookOpen,
	NotebookTabs,
	MessageCircleMore,
	Sparkles,
} from "lucide-react";

export default function Home() {
	return (
		<div className="min-h-screen text-slate-100">
			<main className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-8">
				{/* Hero */}
				<section className="grid items-center gap-10 py-10 lg:grid-cols-2 lg:py-16">
					<div>
						<div className="mb-8 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-sm font-medium text-blue-400">
							<Sparkles className="h-4 w-4" />
							<span>Học tiếng Anh theo cách thực tế hơn</span>
						</div>
						<h1 className="mt-4 max-w-2xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
							Luyện tiếng Anh qua những{" "}
							<span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
								tình huống
							</span>{" "}
							bạn thực sự gặp
						</h1>

						<p className="mt-5 max-w-xl text-base leading-relaxed text-slate-400 sm:text-lg">
							Luyện hội thoại, học từ vựng và lưu lại những từ quan trọng trong
							một nơi.
						</p>

						<div className="mt-8 flex flex-wrap gap-3">
							<Link
								href="/dialogue"
								className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-5 py-3 font-semibold text-white transition hover:from-blue-500 hover:to-violet-500"
							>
								Bắt đầu học
								<ArrowRight size={17} />
							</Link>

							<Link
								href="/wordlist"
								className="inline-flex items-center rounded-xl border border-slate-800 bg-slate-900/50 px-5 py-3 font-semibold text-slate-300 transition hover:bg-slate-900 hover:text-white"
							>
								Mở sổ tay
							</Link>
						</div>
					</div>

					{/* Visual */}
					<div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/50">
						<img
							src="/hero-img.png"
							alt="Học hội thoại tiếng Anh cùng StudyJony"
							className="aspect-video h-full w-full object-cover"
						/>

						<div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent" />

						<div className="absolute bottom-5 left-5">
							<p className="text-sm text-slate-300">
								Học qua hội thoại thực tế
							</p>

							<p className="mt-1 text-xl font-semibold text-white">
								Nghe. Hiểu. Phản xạ.
							</p>
						</div>
					</div>
				</section>

				{/* Features */}
				<section className="mt-14">
					<div className="flex items-end justify-between gap-4">
						<div>
							<h2 className="text-2xl font-bold">Bạn có thể học gì?</h2>
							<p className="mt-2 text-slate-500">
								Ba phần chính của StudyJony.
							</p>
						</div>
					</div>

					<div className="mt-6 grid gap-4 md:grid-cols-3">
						<Link
							href="/dialogue"
							className="group rounded-2xl border border-slate-800 bg-slate-900/35 p-5 transition hover:-translate-y-1 hover:border-blue-500/30 hover:bg-slate-900/60 hover:shadow-[0_16px_40px_rgba(0,0,0,0.35)]"
						>
							<div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
								<Headphones size={20} />
							</div>

							<h3 className="mt-5 text-lg font-semibold text-white">
								Hội thoại
							</h3>

							<p className="mt-2 text-sm leading-6 text-slate-400">
								Luyện nghe và phản xạ qua những tình huống đời thường.
							</p>

							<div className="mt-6 text-sm font-medium text-blue-400">
								Khám phá →
							</div>
						</Link>

						<Link
							href="/vocabulary"
							className="group rounded-2xl border border-slate-800 bg-slate-900/35 p-5 transition hover:-translate-y-1 hover:border-emerald-500/30 hover:bg-slate-900/60 hover:shadow-[0_16px_40px_rgba(0,0,0,0.35)]"
						>
							<div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
								<BookOpen size={20} />
							</div>

							<h3 className="mt-5 text-lg font-semibold text-white">Từ vựng</h3>

							<p className="mt-2 text-sm leading-6 text-slate-400">
								Hiểu nghĩa, phát âm và cách dùng từ trong ngữ cảnh.
							</p>

							<div className="mt-6 text-sm font-medium text-emerald-400">
								Học từ mới →
							</div>
						</Link>

						<Link
							href="/wordlist"
							className="group rounded-2xl border border-slate-800 bg-slate-900/35 p-5 transition hover:-translate-y-1 hover:border-violet-500/30 hover:bg-slate-900/60 hover:shadow-[0_16px_40px_rgba(0,0,0,0.35)]"
						>
							<div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 text-violet-400">
								<NotebookTabs size={20} />
							</div>

							<h3 className="mt-5 text-lg font-semibold text-white">Sổ tay</h3>

							<p className="mt-2 text-sm leading-6 text-slate-400">
								Lưu từ quan trọng và ôn lại theo tiến độ của riêng bạn.
							</p>

							<div className="mt-6 text-sm font-medium text-violet-400">
								Mở sổ tay →
							</div>
						</Link>
					</div>
				</section>

				{/* Small product message */}
				<section className="mt-14 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/35">
					<div className="flex flex-col gap-6 px-6 py-7 sm:flex-row sm:items-center sm:justify-between sm:px-8">
						<div className="max-w-2xl">
							<div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
								<MessageCircleMore size={20} />
							</div>

							<h2 className="text-xl font-bold text-white sm:text-2xl">
								Học để sử dụng, không chỉ để ghi nhớ
							</h2>

							<p className="mt-2 max-w-xl text-sm leading-6 text-slate-400 sm:text-base">
								Luyện nghe, phản xạ và sử dụng tiếng Anh qua những tình huống
								thực tế.
							</p>
						</div>

						<Link
							href="/dialogue"
							className="inline-flex shrink-0 items-center gap-2 self-start rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-5 py-3 text-sm font-semibold text-white transition hover:from-blue-500 hover:to-violet-500 sm:self-auto"
						>
							Bắt đầu hội thoại
							<ArrowRight size={16} />
						</Link>
					</div>
				</section>
			</main>
		</div>
	);
}
