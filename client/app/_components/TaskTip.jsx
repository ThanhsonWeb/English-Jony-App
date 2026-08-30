import { Lightbulb } from "lucide-react";

function renderHighlightedPhrases(line) {
	return line.split(/("[^"]+")/g).map((part, index) => {
		if (part.startsWith('"') && part.endsWith('"')) {
			return (
				<code
					key={`${part}-${index}`}
					className="rounded border border-slate-600 bg-slate-900 px-1.5 py-0.5 font-sans text-[0.9em] text-slate-100"
				>
					{part.slice(1, -1)}
				</code>
			);
		}

		return part;
	});
}

function TaskTip({ tip }) {
	if (!tip) return null;

	return (
		<div className="mt-5 border-y border-slate-800 py-4 text-slate-300">
			<h2 className="flex items-center justify-center gap-2 text-center text-sm font-semibold text-slate-100">
				<Lightbulb size={17} className="text-amber-400" />
				<span>{tip.title}</span>
			</h2>
			<div className="mt-3 space-y-1.5 text-sm leading-relaxed">
				{tip.lines.map((line) => (
					<p key={line}>{renderHighlightedPhrases(line)}</p>
				))}
			</div>
		</div>
	);
}

export default TaskTip;
