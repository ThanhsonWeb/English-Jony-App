import { useTranslations } from "next-intl";

function DialogueShortcutHint({ showReplay = true }) {
	const t = useTranslations("DialogueFeature");
	return (
		<div className="mt-6 hidden flex-wrap justify-end gap-x-4 gap-y-1 text-sm text-secondary sm:flex">
		<span>
			<kbd className="font-mono font-semibold text-main">↵ Enter</kbd>{" "}
			{t("enterShortcut")}
		</span>
		{showReplay && (
			<span>
				<kbd className="font-mono font-semibold text-main">Ctrl</kbd> {t("replayShortcut")}
			</span>
		)}
		</div>
	);
}

export default DialogueShortcutHint;
