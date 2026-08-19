import { Construction, Headphones, Sparkles } from "lucide-react";

export const metadata = {
	title: "Dictation",
};

function Page() {
	return (
		<main className="min-h-[calc(100vh-80px)] bg-slate-950 flex items-center justify-center px-4">
			<div className="max-w-lg w-full text-center">
				{/* Icon */}
				<div className="relative mx-auto mb-8 w-fit">
					<div className="absolute inset-0 bg-blue-500/20 blur-2xl rounded-full" />

					<div className="relative w-24 h-24 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center shadow-2xl">
						<Headphones className="w-11 h-11 text-blue-400" />
					</div>

					<div className="absolute -right-3 -bottom-3 w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center border-4 border-slate-950">
						<Construction className="w-5 h-5 text-white" />
					</div>
				</div>

				{/* Content */}
				<div className="flex items-center justify-center gap-2 text-blue-400 text-sm font-semibold mb-3">
					<Sparkles className="w-4 h-4" />
					TÍNH NĂNG ĐANG PHÁT TRIỂN
				</div>

				<h1 className="text-3xl sm:text-4xl font-bold text-slate-100 mb-4">
					Luyện nghe Dictation
				</h1>

				<p className="text-slate-400 leading-relaxed">
					Mình đang phát triển tính năng này để mang đến trải nghiệm luyện nghe
					tốt hơn cho bạn.
				</p>

				<p className="text-slate-500 text-sm mt-3">Sẽ sớm ra mắt nhé! 🚀</p>
			</div>
		</main>
	);
}

export default Page;
