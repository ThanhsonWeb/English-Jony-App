import { Brain, Construction, Sparkles } from "lucide-react";

function Page() {
	return (
		<main className="min-h-[calc(100vh-80px)] bg-[#030616] flex items-center justify-center px-4">
			<div className="w-full max-w-md text-center">
				{/* Icon */}
				<div className="relative mx-auto mb-7 w-fit">
					<div className="absolute inset-0 rounded-full bg-cyan-500/20 blur-3xl" />

					<div className="relative flex h-24 w-24 items-center justify-center rounded-3xl border border-cyan-500/20 bg-cyan-500/10 shadow-2xl">
						<Brain className="h-11 w-11 text-cyan-400" />
					</div>

					<div className="absolute -bottom-2 -right-2 flex h-10 w-10 items-center justify-center rounded-xl border-4 border-[#030616] bg-cyan-500">
						<Construction className="h-5 w-5 text-white" />
					</div>
				</div>

				{/* Badge */}
				<div className="mb-4 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-wider text-cyan-400">
					<Sparkles size={15} />
					Đang phát triển
				</div>

				<h1 className="text-3xl font-bold text-white">Trắc nghiệm</h1>

				<p className="mx-auto mt-4 max-w-sm leading-relaxed text-slate-400">
					Mình đang phát triển tính năng này để giúp bạn kiểm tra và ghi nhớ từ
					vựng hiệu quả hơn.
				</p>

				<p className="mt-3 text-sm text-slate-500">Sắp ra mắt nhé! 🚀</p>
			</div>
		</main>
	);
}

export default Page;
