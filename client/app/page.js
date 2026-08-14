import Link from "next/link";
import { ArrowRight, Headphones, BookOpen, Sparkles } from "lucide-react";

export default function Home() {
	return (
		<div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between">
			{/* Hero Section */}
			<main className="w-full max-w-7xl mx-auto px-6 pt-20 pb-16 flex-1 flex flex-col items-center justify-center text-center">
				{/* Badge */}
				<div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-medium mb-8">
					<Sparkles className="w-4 h-4" />
					<span>Luyện tiếng Anh tự nhiên</span>
				</div>

				{/* Heading */}
				<h1 className="text-4xl md:text-6xl font-extrabold tracking-tight max-w-4xl leading-tight">
					Nâng tầm kỹ năng ngoại ngữ cùng 
					 <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">
						StudyJony
					</span>
				</h1>

				{/* Subtitle */}
				<p className="mt-6 text-lg md:text-xl text-slate-400 max-w-2xl">
					Luyện nghe chép chính tả, mở rộng vốn từ vựng và cải thiện khả năng
					nghe phản xạ với bộ công cụ tương tác chuyên sâu.
				</p>

				{/* Call to Action Buttons */}
				<div className="mt-10 flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
					<Link
						href="/dictation"
						className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-medium px-6 py-3 rounded-xl transition-all shadow-lg shadow-blue-600/25"
					>
						Bắt đầu nghe chép
						<ArrowRight className="w-4 h-4" />
					</Link>

					<Link
						href="/wordlist"
						className="inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 font-medium px-6 py-3 rounded-xl transition-all"
					>
						Khám phá từ vựng
					</Link>
				</div>

				{/* Feature Cards Grid (Expanded to full container width) */}
				<div className="mt-20 grid grid-cols-1 md:grid-cols-2 gap-6 w-full text-left">
					<div className="p-6 bg-slate-900/60 border border-slate-800/80 rounded-2xl hover:border-slate-700 transition-all">
						<div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center text-blue-400 mb-4">
							<Headphones className="w-5 h-5" />
						</div>
						<h2 className="text-xl font-semibold text-slate-100">
							Luyện nghe chép chính tả
						</h2>
						<p className="text-slate-400 mt-2 text-sm">
							Lắng nghe audio thực tế và gõ lại chính xác những gì bạn nghe được
							để rèn luyện đôi tai với ngữ điệu bản xứ.
						</p>
					</div>

					<div className="p-6 bg-slate-900/60 border border-slate-800/80 rounded-2xl hover:border-slate-700 transition-all">
						<div className="w-10 h-10 bg-indigo-500/10 rounded-lg flex items-center justify-center text-indigo-400 mb-4">
							<BookOpen className="w-5 h-5" />
						</div>
						<h2 className="text-xl font-semibold text-slate-100">
							Xây dựng vốn từ vựng
						</h2>
						<p className="text-slate-400 mt-2 text-sm">
							Lưu trữ từ vựng quan trọng, học cách sử dụng trong ngữ cảnh và ôn
							tập bằng thẻ flashcard thông minh.
						</p>
					</div>
				</div>
			</main>

			{/* Simple Footer */}
			<footer className="border-t border-slate-900 py-6 text-center text-slate-500 text-sm">
				© {new Date().getFullYear()} StudyJony. Bảo lưu mọi quyền.
			</footer>
		</div>
	);
}
