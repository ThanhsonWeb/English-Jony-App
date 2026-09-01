"use client";

import { useState } from "react";
import { BookOpen, ChevronDown } from "lucide-react";

function GrammarNote({ grammar }) {
	const [isOpen, setIsOpen] = useState(false);

	if (!grammar) return null;

	return (
		<div>
			<button
				type="button"
				onClick={() => setIsOpen((current) => !current)}
				aria-expanded={isOpen}
				className="inline-flex items-center gap-2 rounded-lg border border-blue-500/20 bg-blue-500/5 px-3 py-2 text-sm font-semibold text-blue-300 transition hover:border-blue-500/40 hover:bg-blue-500/10"
			>
				<span>📘 Ngữ pháp</span>
				<ChevronDown
					size={16}
					className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
				/>
			</button>

			{isOpen && (
				<div className="mt-3 max-w-xl rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-slate-300">
					<h2 className="flex items-center gap-2 font-semibold text-slate-100">
						<BookOpen size={18} className="text-blue-400" />
						<span>{grammar.title}</span>
					</h2>
					<p className="mt-2 text-sm leading-relaxed">
						{grammar.explanation}
					</p>
					<p className="mt-3 rounded-lg bg-slate-950/60 px-3 py-2 text-sm leading-relaxed text-slate-200">
						{grammar.example}
					</p>
				</div>
			)}
		</div>
	);
}

export default GrammarNote;
