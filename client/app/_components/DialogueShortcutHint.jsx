import { useTranslations } from "next-intl";

function DialogueShortcutHint({ showReplay = true }) {
	const t = useTranslations("DialogueFeature");
	return (
		<div className="mt-6 hidden flex-wrap justify-end gap-x-4 gap-y-1 text-xs text-slate-500 sm:flex dark:text-slate-500">
		<span>
			<kbd className="font-mono text-slate-400">↵ Enter</kbd>{" "}
			{t("enterShortcut")}
		</span>
		{showReplay && (
			<span>
				<kbd className="font-mono text-slate-400">Ctrl</kbd> {t("replayShortcut")}
			</span>
		)}
		</div>
	);
}

export default DialogueShortcutHint;
