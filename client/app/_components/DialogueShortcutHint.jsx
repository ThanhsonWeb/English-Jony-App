function DialogueShortcutHint({ showReplay = true, showBlankAdvance = false }) {
	return (
		<div className="mt-6 flex flex-wrap justify-end gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-500">
		<span>
			<kbd className="font-mono text-slate-400">↵ Enter</kbd>{" "}
			{showBlankAdvance ? " Kiểm tra / Tiếp tục" : "Kiểm tra / Tiếp tục"}
		</span>
		{showReplay && (
			<span>
				<kbd className="font-mono text-slate-400">Ctrl</kbd> Nghe lại
			</span>
		)}
		</div>
	);
}

export default DialogueShortcutHint;
