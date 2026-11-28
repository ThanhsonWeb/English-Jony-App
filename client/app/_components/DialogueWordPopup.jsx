"use client";

import { createPortal } from "react-dom";
import { Volume2 } from "lucide-react";
import { useTranslations } from "next-intl";

export default function DialogueWordPopup({ lookup, popupRef, onPronounce, onSwitch }) {
	const t = useTranslations("DialogueFeature");
	if (!lookup) return null;
	const switchTo = lookup.result.source === "phrase"
		? lookup.phraseLookup?.wordLookup
		: lookup.phraseLookup;

	return createPortal(
		<div
			ref={popupRef}
			role="dialog"
			aria-label={t("meaningOf", { word: lookup.result.text })}
			className={lookup.isMobile
				? "dialogue-word-popup fixed inset-x-3 bottom-3 z-[100] rounded-2xl border border-stone-200 bg-[#FFFDF9] px-3.5 py-3 text-left text-sm text-stone-800 shadow-lg backdrop-blur-md dark:border-slate-700/80 dark:bg-slate-950/95 dark:text-slate-200 dark:shadow-2xl"
				: `dialogue-word-popup fixed z-[100] w-64 rounded-xl border border-stone-200 bg-[#FFFDF9] px-3.5 py-3 text-left text-sm text-stone-800 shadow-lg backdrop-blur-md dark:border-slate-700/80 dark:bg-slate-950/95 dark:text-slate-200 dark:shadow-2xl ${lookup.position.opensAbove ? "-translate-y-full" : ""}`}
			style={lookup.isMobile ? undefined : { left: lookup.position.left, top: lookup.position.top }}
		>
			<div className="flex flex-wrap items-center gap-x-2 gap-y-1">
				<div className="flex items-center gap-1.5">
					<strong className="text-base text-white">{lookup.result.text}</strong>
					<button type="button" onClick={onPronounce}
						aria-label={t("pronounceWord", { word: lookup.result.text })}
						className="inline-flex h-7 w-7 items-center justify-center rounded-full text-cyan-300 transition hover:bg-cyan-400/15 hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70">
						<Volume2 size={15} />
					</button>
				</div>
				<span className="text-emerald-300">{lookup.result.source === "phrase" ? lookup.result.type : lookup.result.pos?.join(", ")}</span>
			</div>
			{lookup.result.pron?.length > 0 && <p className="mt-1 text-slate-300">{lookup.result.pron.join(", ")}</p>}
			<p className="mt-2 leading-relaxed text-slate-200">{lookup.result.displayMeaning}</p>
			{switchTo && <button type="button" data-dictionary-switch="true"
				aria-label={t("meaningOf", { word: switchTo.result.text })}
				onClick={() => onSwitch(switchTo)}
				className="mt-2 text-cyan-300 underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70">
				{switchTo.result.text}
			</button>}
		</div>,
		document.body,
	);
}
