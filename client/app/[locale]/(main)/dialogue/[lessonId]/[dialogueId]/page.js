"use client";

import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import DialoguePlayer from "@/app/_components/DialoguePlayer";
import { getLocalizedDialogueValue } from "@/app/_lib/dialogue/localization";
import { lessonData } from "../../_data/lessonData";

export default function DialogueListeningPage() {
	const { lessonId, dialogueId } = useParams();
	const locale = useLocale();
	const t = useTranslations("DialogueFeature");
	const lesson = lessonData[lessonId];
	const dialogue = lesson?.dialogues.find((item) => item.id === dialogueId);

	if (!dialogue?.dialogue?.length) {
		return <div className="p-8 text-white">{t("dialogueNotFound")}</div>;
	}

	return (

			<DialoguePlayer
				task={{ ...dialogue, title: getLocalizedDialogueValue(dialogue, "title", locale), description: getLocalizedDialogueValue(dialogue, "description", locale) }}
				lessonId={lessonId}
				dialogueId={dialogueId}
				nextTask={dialogue.tasks[0]}
			/>

	);
}
