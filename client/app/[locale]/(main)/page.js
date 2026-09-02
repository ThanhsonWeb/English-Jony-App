import Image from "next/image";
import Link from "next/link";
import {
	ArrowRight,
	BookOpen,
	BookmarkPlus,
	Headphones,
	Languages,
	NotebookTabs,
	Play,
	Volume2,
} from "lucide-react";

const learningFeatures = [
	{
		title: "Hội thoại thực tế",
		description:
			"Luyện nghe và phản xạ qua các tình huống thường gặp trong công việc và cuộc sống.",
			cta: "Học hội thoại",
		href: "/dialogue",
		icon: Headphones,
	},
	{
		title: "Từ vựng theo chủ đề",
		description:
			"Khám phá những từ phổ biến theo chủ đề và lưu lại những từ bạn cần.",
			cta: "Khám phá từ vựng",
		href: "/vocabulary",
		icon: Languages,
	},
	{
		title: "Ôn tập theo cách của bạn",
		description:
			"Ôn lại từ đã lưu bằng Flashcard, Viết từ và Trắc nghiệm.",
			cta: "Mở sổ tay",
		href: "/wordlist",
		icon: NotebookTabs,
	},
];

const learningSteps = [
	{ label: "Nghe hội thoại", icon: Headphones },
	{ label: "Học từ mới", icon: BookOpen },
	{ label: "Lưu vào Sổ tay", icon: BookmarkPlus },
	{ label: "Ôn lại khi cần", icon: NotebookTabs },
];

export default function Home() {
	return (
		<main className="overflow-hidden text-slate-100">
			<section className="mx-auto grid w-full max-w-7xl items-center gap-10 px-4 py-12 sm:px-8 sm:py-16 lg:grid-cols-[0.92fr_1.08fr] lg:gap-14 lg:py-20">
				<div className="relative z-10">
					<div className="inline-flex items-center gap-2 rounded-full border border-blue-500/25 bg-blue-500/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-blue-300 sm:text-sm">
						<Headphones className="h-4 w-4" />
						<span>Học tiếng Anh thực tế mỗi ngày</span>
					</div>

					<h1 className="mt-6 max-w-2xl text-4xl font-bold leading-[1.12] tracking-tight text-white sm:text-5xl lg:text-[3.5rem]">
						Học tiếng Anh qua những tình huống bạn{" "}
						<span className="text-blue-400">thực sự gặp</span>
					</h1>

					<p className="mt-5 max-w-xl text-base leading-7 text-slate-400 sm:text-lg sm:leading-8">
						Luyện hội thoại, học từ vựng và lưu lại những từ quan trọng để
						ôn tập theo cách của bạn.
					</p>

					<div className="mt-8 flex flex-col gap-3 sm:flex-row">
						<Link
							href="/dialogue"
							className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-6 py-3 font-semibold text-white shadow-[0_14px_35px_-16px_rgba(59,130,246,0.9)] transition hover:brightness-110 active:scale-[0.98]"
						>
							Bắt đầu học
							<ArrowRight size={18} />
						</Link>

						<Link
							href="/dialogue"
							className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900/50 px-6 py-3 font-semibold text-slate-200 transition hover:border-blue-500/40 hover:bg-blue-500/10 hover:text-white"
						>
							Khám phá hội thoại
						</Link>
					</div>
				</div>

				<div className="relative mx-auto w-full max-w-2xl lg:mx-0">
					<div className="absolute -inset-5 -z-10 rounded-[36px] bg-blue-600/10 blur-3xl" />
					<div className="overflow-hidden rounded-[26px] border border-slate-700/80 bg-[#071022] shadow-[0_28px_80px_-38px_rgba(0,0,0,0.95)]">
						<div className="relative aspect-[16/10] overflow-hidden">
							<Image
								src="/hero-img.png"
								alt="Maria và Tom luyện hội thoại tiếng Anh"
								fill
								priority
								sizes="(max-width: 1024px) 100vw, 56vw"
								className="object-cover"
							/>
							<div className="absolute inset-0 bg-gradient-to-t from-[#030616]/85 via-transparent to-transparent" />

							<div className="absolute inset-x-0 bottom-0 border-t border-white/10 bg-[#030616]/78 px-4 py-4 backdrop-blur-md sm:px-6 sm:py-5">
								<div className="flex items-end justify-between gap-4">
									<div className="min-w-0">
										<p className="text-sm font-semibold text-blue-300">Maria</p>
										<p className="mt-1 truncate text-sm font-medium text-white sm:text-base">
											Hi, I’m Maria. Nice to meet you!
										</p>
									</div>
									<span className="shrink-0 text-xs font-medium text-slate-400">
										1 / 12
									</span>
								</div>
							</div>
						</div>

						<div className="flex items-center justify-between border-t border-slate-800 px-4 py-3 sm:px-5">
							<div className="flex items-center gap-3">
								<div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-950">
									<Play size={17} fill="currentColor" />
								</div>
								<Volume2 className="h-4 w-4 text-slate-400" />
								<span className="text-xs font-medium text-slate-400">1x</span>
							</div>
							<span className="rounded-lg border border-blue-500/20 bg-blue-500/10 px-3 py-1.5 text-xs font-semibold text-blue-300">
								Hội thoại thực tế
							</span>
						</div>
					</div>
				</div>
			</section>

			<section className="border-y border-slate-800/80 bg-slate-950/25">
				<div className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-8 sm:py-18">
					<div className="max-w-2xl">
						<p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-400">
							Bắt đầu từ điều bạn cần
						</p>
						<h2 className="mt-2 text-3xl font-bold tracking-tight text-white">
							Bạn có thể học gì?
						</h2>
						<p className="mt-3 leading-7 text-slate-400">
							Ba cách đơn giản để biến tiếng Anh thành kỹ năng bạn có thể sử
							dụng mỗi ngày.
						</p>
					</div>

					<div className="mt-8 grid gap-4 md:grid-cols-3">
						{learningFeatures.map((feature, index) => {
							const Icon = feature.icon;

							return (
								<Link
									key={feature.title}
									href={feature.href}
									className="group flex min-h-64 flex-col rounded-2xl border border-slate-800 bg-[#081123] p-6 transition hover:-translate-y-1 hover:border-blue-500/35 hover:bg-[#0a152b]"
								>
									<div className="flex items-start justify-between gap-4">
										<div className="flex h-11 w-11 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10 text-blue-300">
											<Icon size={21} />
										</div>
										<span className="text-sm font-semibold text-slate-600">
											0{index + 1}
										</span>
									</div>
									<h3 className="mt-6 text-xl font-bold text-white">
										{feature.title}
									</h3>
									<p className="mt-3 text-sm leading-6 text-slate-400">
										{feature.description}
									</p>
									<span className="mt-auto inline-flex items-center gap-1.5 pt-6 text-sm font-semibold text-blue-300">
										{feature.cta}
										<ArrowRight
											size={16}
											className="transition group-hover:translate-x-1"
										/>
									</span>
								</Link>
							);
						})}
					</div>
				</div>
			</section>

			<section className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-8 sm:py-18 lg:py-20">
				<div className="text-center">
					<p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-400">
						Một vòng học đơn giản
					</p>
					<h2 className="mt-2 text-3xl font-bold tracking-tight text-white">
						Cách StudyJony hoạt động
					</h2>
					<p className="mx-auto mt-3 max-w-2xl leading-7 text-slate-400">
						Nghe cách người thật nói, học từ ngay trong ngữ cảnh rồi lưu lại
						để ôn sau.
					</p>
				</div>

				<div className="relative mx-auto mt-10 grid max-w-5xl gap-3 md:grid-cols-4">
					<div className="absolute left-[12.5%] right-[12.5%] top-7 hidden h-px bg-slate-800 md:block" />
					{learningSteps.map((step, index) => {
						const Icon = step.icon;

						return (
							<div
								key={step.label}
								className="relative flex items-center gap-4 rounded-2xl border border-slate-800/80 bg-[#071022] p-4 md:flex-col md:border-transparent md:bg-transparent md:px-2 md:text-center"
							>
								<div className="relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-blue-500/25 bg-[#0a1730] text-blue-300 shadow-[0_10px_25px_-16px_rgba(59,130,246,0.9)]">
									<Icon size={22} />
								</div>
								<div>
									<p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">
										Bước {index + 1}
									</p>
									<h3 className="mt-1 font-semibold text-white md:mt-2">
										{step.label}
									</h3>
								</div>
							</div>
						);
					})}
				</div>

				<div className="mt-10 text-center">
					<Link
						href="/dialogue"
						className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-6 py-3 font-semibold text-white transition hover:brightness-110 active:scale-[0.98]"
					>
						Bắt đầu với hội thoại
						<ArrowRight size={18} />
					</Link>
				</div>
			</section>
		</main>
	);
}
