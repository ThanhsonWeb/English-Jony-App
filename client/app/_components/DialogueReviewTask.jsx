import { Link } from "@/i18n/navigation";
import { useRef } from "react";
import DialogueShortcutHint from "./DialogueShortcutHint";
import { DialogueTaskNavigation } from "./DialogueExerciseHeader";
import useDialogueShortcuts from "../_hooks/useDialogueShortcuts";
import { useTranslations } from "next-intl";

function DialogueReviewTask({
	task,
	lessonId,
	dialogueId,
	previousTask,
	nextTask,
	completionHref,
	totalTasks,
	onComplete,
}) {
	const t = useTranslations("DialogueFeature");
	const actionRef = useRef(null);

	useDialogueShortcuts({
		onEnter: () => actionRef.current?.click(),
	});

	return (
		<div className="min-h-screen px-4 py-8 text-white sm:px-8">
			<div className="mx-auto max-w-3xl">
				<h1 className="mt-2 text-2xl font-bold">{task.title} 📖</h1>

				<DialogueTaskNavigation
					lessonId={lessonId}
					dialogueId={dialogueId}
					taskId={task.id}
					previousTask={previousTask}
					nextTask={nextTask}
					totalTasks={totalTasks}
				/>
				<p className="mt-2 text-slate-400">
					{t("reviewBeforeContinue")}
				</p>

				<div className="mt-8 space-y-4">
					{task.dialogue.map((line, index) => (
						<div
							key={index}
							className="rounded-xl border border-slate-800 bg-slate-900/50 p-4"
						>
							<p
								className={
									line.speaker === "Maria"
										? "font-semibold text-blue-400"
										: "font-semibold text-green-400"
								}
							>
								{line.speaker}
							</p>

							<p className="mt-1 text-slate-200">{line.text}</p>
						</div>
					))}
				</div>

				<DialogueShortcutHint showReplay={false} />
				<div className="mt-4 flex justify-end">
					<Link
						ref={actionRef}
						href={
							nextTask
								? `/dialogue/${lessonId}/${dialogueId}/${nextTask.id}`
									: completionHref || `/dialogue/${lessonId}`
						}
						onClick={onComplete}
						className="rounded-xl bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-500"
					>
						{nextTask ? t("continueArrow") : t("completeDialogue")}
					</Link>
				</div>
			</div>
		</div>
	);
}

export default DialogueReviewTask;
