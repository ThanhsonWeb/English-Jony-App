"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

import DialogueUsefulWords from "@/app/_components/DialogueUsefulWords";
import { lessonData } from "../../../_data/lessonData";

export default function DialogueUsefulWordsPage() {
	const { lessonId, dialogueId } = useParams();
	const router = useRouter();
	const lesson = lessonData[lessonId];
	const dialogue = lesson?.dialogues.find((item) => item.id === dialogueId);
	const usefulWords = dialogue?.usefulWords || [];

	useEffect(() => {
		if (dialogue && usefulWords.length === 0) {
			router.replace(`/dialogue/${lessonId}`);
		}
	}, [dialogue, lessonId, router, usefulWords.length]);

	if (!dialogue) {
		return <div className="p-8 text-white">Không tìm thấy hội thoại.</div>;
	}

	if (usefulWords.length === 0) {
		return (
			<div className="flex min-h-[calc(100vh-80px)] items-center justify-center text-slate-400">
				Đang tiếp tục...
			</div>
		);
	}

	return (
		<DialogueUsefulWords
			words={usefulWords}
			lessonId={lessonId}
			dialogueTitle={dialogue.title}
		/>
	);
}
