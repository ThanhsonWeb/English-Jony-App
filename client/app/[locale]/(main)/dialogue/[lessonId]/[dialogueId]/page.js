"use client";

import { useParams } from "next/navigation";
import ListeningTask from "@/app/_components/ListeningTask";
import { lessonData } from "../../_data/lessonData";

export default function DialogueListeningPage() {
	const { lessonId, dialogueId } = useParams();
	const lesson = lessonData[lessonId];
	const dialogue = lesson?.dialogues.find((item) => item.id === dialogueId);

	if (!dialogue?.dialogue?.length) {
		return <div className="p-8 text-white">Không tìm thấy hội thoại.</div>;
	}

	return (
		<ListeningTask
			task={dialogue}
			lessonId={lessonId}
			dialogueId={dialogueId}
			nextTask={dialogue.tasks[0]}
		/>
	);
}
