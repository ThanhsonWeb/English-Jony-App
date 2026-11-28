import { useTranslations } from "next-intl";

function DialogueShortcutHint({ showReplay = true, belowPlayer = false }) {
	const t = useTranslations("DialogueFeature");
	return (
		<div className={`${belowPlayer ? "mt-2 justify-center gap-x-8 text-[17px]" : "mt-6 justify-end gap-x-4 text-sm"} hidden flex-wrap gap-y-1 text-secondary sm:flex`}>
		{showReplay && (
			<span>
				<kbd className="font-mono font-semibold text-main">Ctrl</kbd> {t("replayShortcut")}
			</span>
		)}
		<span>
			<kbd className="font-mono font-semibold text-main">↵ Enter</kbd>{" "}
			{t("enterShortcut")}
		</span>
		</div>
	);
}

export default DialogueShortcutHint;
