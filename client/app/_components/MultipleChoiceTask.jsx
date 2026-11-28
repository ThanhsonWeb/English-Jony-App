import { CheckCircle2, Circle, XCircle } from "lucide-react";
import { useRef, useState } from "react";
import DialogueShortcutHint from "./DialogueShortcutHint";
import { DialogueTaskNavigation } from "./DialogueExerciseHeader";
import GrammarNote from "./GrammarNote";
import TaskAudioScene from "./TaskAudioScene";
import useDialogueAutoAdvance from "../_hooks/useDialogueAutoAdvance";
import useDialogueShortcuts from "../_hooks/useDialogueShortcuts";
import { useLocale, useTranslations } from "next-intl";
import { DialogueProgressLink } from "./DialogueProgressSave";

function MultipleChoiceTask({
	task,
	lessonId,
	dialogueId,
	previousTask,
	nextTask,
	completionHref,
	onComplete,
	totalTasks,
	confirmedCompleted = false,
}) {
	const t = useTranslations("DialogueFeature");
	const locale = useLocale();
	const [selected, setSelected] = useState("");
	const [result, setResult] = useState(null);
	const [started, setStarted] = useState(false);
	const selectedIndex = task.options.indexOf(selected);
	const optionFeedback = task.localized?.optionFeedback?.[selectedIndex]?.[locale] ??
		(locale === "vi" ? task.optionFeedback?.[selectedIndex] : undefined);
	const review = confirmedCompleted && !started && !result;
	const autoAdvance = useDialogueAutoAdvance({
		onComplete,
		manual: true,
		href: nextTask ? `/dialogue/${lessonId}/${dialogueId}/${nextTask.id}` : completionHref || `/dialogue/${lessonId}`,
	});
	const actionRef = useRef(null);
	const audioSceneRef = useRef(null);

	useDialogueShortcuts({
		onEnter: () => actionRef.current?.click(),
		onReplay: () => audioSceneRef.current?.replay(),
		onNumber: (optionIndex) => {
			const option = task.options[optionIndex];
			if (option && !result && !review) { setStarted(true); setSelected(option); }
		},
		numberShortcutsDisabled: Boolean(result || review),
	});

	function checkAnswer() {
		if (autoAdvance.isSubmitted() || review) return;
		const isCorrect = selected === task.answer;

		setResult(isCorrect ? "correct" : "wrong");
		if (isCorrect) autoAdvance.complete({ optionIndex: task.options.indexOf(selected) });
	}

	return (
		<div className="px-4 py-3 text-white sm:px-8">
			<div className="mx-auto max-w-6xl">

				<h1 className="sr-only">{task.title}</h1>

				<div className="grid gap-4 sm:gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
					<div><TaskAudioScene ref={audioSceneRef} key={task.audioUrl} task={task} />
						<DialogueShortcutHint belowPlayer /></div>

					<div>
						<DialogueTaskNavigation
							lessonId={lessonId}
							dialogueId={dialogueId}
							taskId={task.id}
							previousTask={previousTask}
							nextTask={nextTask}
							totalTasks={totalTasks}
						/>
						<h2 className="mt-2 text-lg font-semibold leading-relaxed text-white">
							{task.question}
						</h2>
						{locale === "en" && !task.localizedOptions && <p className="mt-2 text-sm text-slate-400">{t("vietnameseChoices")}</p>}

						{task.context && (
							<div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/60 px-5 py-4">
								<p className="text-sm text-slate-400">{t("inDialogue")}</p>
								<p className="mt-2 text-lg font-medium text-white">
									“{task.context}”
								</p>
							</div>
						)}

						<div className="mt-6 overflow-hidden rounded-xl border border-slate-800">
							{task.options.map((option, optionIndex) => {
								const isSelected = review ? option === task.answer : selected === option;
								const isCorrectAnswer =
									(result === "correct" || review) && option === task.answer;
								const isWrongSelection = result === "wrong" && isSelected;

								return (
									<button
										key={option}
										type="button"
										disabled={result === "correct" || review}
										onClick={(event) => {
											if (autoAdvance.isSubmitted() || review) return;
											setStarted(true);
											setSelected(option);
											setResult(null);
											if (event.detail > 0) event.currentTarget.blur();
										}}
										className={`flex w-full items-start gap-3 border-b border-slate-800 px-5 py-4 text-left transition last:border-b-0 ${
											isWrongSelection
												? "bg-red-500/10 ring-1 ring-inset ring-red-500/50"
												: isCorrectAnswer
												? "bg-emerald-500/10"
												: isSelected
													? "bg-violet-500/10"
													: "bg-slate-950/40 hover:bg-slate-900"
										}`}
									>
										{isWrongSelection ? (
											<XCircle size={20} className="mt-0.5 shrink-0 text-red-400" />
										) : isSelected ? (
											<CheckCircle2
												size={20}
												className={`mt-0.5 shrink-0 ${isCorrectAnswer ? "text-emerald-400" : "text-violet-400"}`}
											/>
										) : (
											<Circle
												size={20}
												className="mt-0.5 shrink-0 text-slate-500"
											/>
										)}
										<span className="leading-relaxed">{task.localizedOptions?.[optionIndex] || option}</span>
										{optionIndex < 4 && (
                            <kbd className="ml-auto hidden h-6 min-w-6 shrink-0 items-center justify-center rounded border border-slate-700 bg-slate-900/70 px-1.5 font-mono text-xs text-slate-500 sm:flex">
												{optionIndex + 1}
											</kbd>
										)}
									</button>
								);
							})}
						</div>
						{result === "wrong" && (
							<div className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 p-5">
								<p className="font-semibold text-red-400">{t("wrongTryAgain")}</p>
								{optionFeedback && <p className="mt-2 leading-relaxed text-slate-300">{optionFeedback}</p>}
							</div>
						)}

						<div role="status" aria-live="polite">
							{(result === "correct" || review) && (
								<div className="mt-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5">
									<p className="font-semibold text-emerald-400">{t(review ? "completedCorrectOption" : "correct")}</p>
								</div>
							)}
						</div>
						<div className="mt-4 flex items-start justify-between gap-4">
							{(result || review) && <GrammarNote grammar={task.grammar} />}
							<div className="ml-auto shrink-0">
								{review ? (
									<DialogueProgressLink ref={actionRef} requireSave={false} href={nextTask ? `/dialogue/${lessonId}/${dialogueId}/${nextTask.id}` : completionHref || `/dialogue/${lessonId}`} className="inline-flex rounded-xl bg-violet-600 px-6 py-3 font-semibold text-white hover:bg-violet-500">{t("continue")}</DialogueProgressLink>
								) : result === "correct" ? (
									<button
										ref={actionRef}
										type="button"
										onClick={() => autoAdvance.continue()}
										disabled={!autoAdvance.canContinue}
										className="rounded-xl bg-violet-600 px-6 py-3 font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
									>
										{t("continue")}
									</button>
								) : (
									<button
									ref={actionRef}
									type="button"
									onClick={checkAnswer}
									disabled={!selected}
									className="rounded-xl bg-violet-600 px-6 py-3 font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
								>
									{t("check")}
									</button>
								)}
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}

export default MultipleChoiceTask;
