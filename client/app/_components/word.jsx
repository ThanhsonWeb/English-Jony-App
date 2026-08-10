import {
	Search,
	Plus,
	Edit2,
	Trash2,
	Check,
	ChevronRight,
	Filter,
} from "lucide-react";
function Word({ item, index }) {
	return (
		<div
			key={item.id}
			className="grid grid-cols-12 items-center text-sm p-4 bg-[#161c2e] hover:bg-[#1c243b] border border-slate-800/50 rounded-xl transition-all duration-150"
		>
			{/* Word */}
			<div className="col-span-2 font-serif text-lg text-amber-100/90 font-medium">
				{index + 1}. {item.english}
			</div>

			{/* Pronunciation */}
			<div className="col-span-2 text-slate-400 font-mono text-sm">
				{item.pronunciation}
			</div>

			{/* Definition */}
			<div className="col-span-2 text-slate-300">{item.vietnamese}</div>

			{/* Example */}
			<div className="col-span-3 text-slate-400 italic truncate">
				{item.example}
			</div>

			{/* Status */}
			<div className="col-span-1">
				<span
					className={`inline-flex text-xs px-2.5 py-1 rounded-full border font-medium ${
						item.status === true
							? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
							: "bg-amber-500/10 text-amber-300 border-amber-500/20"
					}`}
				>
					{item.status === true ? "Đã học" : "Chưa học"}
				</span>
			</div>
			{/* Actions */}
			<div className="col-span-2 flex justify-end gap-1">
				<button className="p-1.5 hover:bg-slate-700/50 rounded-md hover:text-slate-200 transition-colors">
					<Edit2 className="w-3.5 h-3.5" />
				</button>
				<button className="p-1.5 hover:bg-slate-700/50 rounded-md hover:text-red-400 transition-colors">
					<Trash2 className="w-3.5 h-3.5" />
				</button>
				<button className="p-1.5 hover:bg-slate-700/50 rounded-md hover:text-blue-400 transition-colors">
					{item.learned ? (
						<ChevronRight className="w-3.5 h-3.5" />
					) : (
						<Check className="w-3.5 h-3.5" />
					)}
				</button>
			</div>
		</div>
	);
}

export default Word;
