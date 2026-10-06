"use client";
import Link from "next/link";
import { useBoundaryMessages } from "@/app/_lib/useBoundaryMessages";

export default function NotFound() {
	const { messages: t, homeHref } = useBoundaryMessages();
	return (
		<div className="min-h-screen bg-[#0b0f19] text-slate-100 flex items-center justify-center px-6">
			<div className="text-center max-w-md">
				<div className="text-8xl font-bold text-blue-500 mb-4">
					404 😵‍💫
				</div>

				<h1 className="text-2xl font-semibold text-white mb-3">
					{t.rootNotFoundTitle}
				</h1>

				<p className="text-slate-400 mb-8">
					{t.rootNotFoundBody}
				</p>

				<Link
					href={homeHref}
					className="inline-flex items-center px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors"
				>
					{t.rootHome}
				</Link>
			</div>
		</div>
	);
}

