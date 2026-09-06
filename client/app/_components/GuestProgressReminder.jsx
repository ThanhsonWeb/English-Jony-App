"use client";

import { CircleCheck, X } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

function GuestProgressReminder({ isOpen, onDismiss }) {
	useEffect(() => {
		if (!isOpen) return;

		function handleKeyDown(event) {
			if (event.key === "Escape") onDismiss();
		}

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [isOpen, onDismiss]);

	if (!isOpen) return null;

	return (
		<aside
			className="fixed bottom-[calc(env(safe-area-inset-bottom)+1rem)] left-1/2 z-[100] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-2xl border border-slate-700/80 bg-slate-900/95 p-4 text-white shadow-2xl shadow-black/40 sm:bottom-6 sm:p-5"
			role="status"
			aria-labelledby="guest-progress-title"
			aria-describedby="guest-progress-description"
		>
			<button
				type="button"
				onClick={onDismiss}
				aria-label="Đóng lời nhắc đăng nhập"
				className="absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-white/10 hover:text-white"
			>
				<X size={17} />
			</button>

			<div className="flex items-start gap-3 pr-8">
				<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-emerald-400/25 bg-emerald-400/10 text-emerald-300">
					<CircleCheck size={20} />
				</div>
				<div>
					<h2 id="guest-progress-title" className="font-bold leading-6">
						Lưu tiến độ học tập
					</h2>
					<p
						id="guest-progress-description"
						className="mt-1 text-sm leading-5 text-slate-300"
					>
						Đăng nhập để tiếp tục học từ nơi bạn đã dừng lại.
					</p>
				</div>
			</div>

			<div className="mt-4 flex gap-2 sm:justify-end">
				<Link
					href="/login"
					onClick={onDismiss}
					className="flex min-h-11 flex-1 items-center justify-center rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-400 sm:flex-none"
				>
					Đăng nhập
				</Link>
				<button
					type="button"
					onClick={onDismiss}
					className="min-h-11 flex-1 rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-white/5 hover:text-white sm:flex-none"
				>
					Để sau
				</button>
			</div>
		</aside>
	);
}

export default GuestProgressReminder;
