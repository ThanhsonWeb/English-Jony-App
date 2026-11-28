import { Fragment, useEffect, useRef, useState } from "react";
import DialogueShortcutHint from "./DialogueShortcutHint";
import { DialogueTaskNavigation } from "./DialogueExerciseHeader";
import GrammarNote from "./GrammarNote";
import TaskAudioScene from "./TaskAudioScene";
import useDialogueAutoAdvance from "../_hooks/useDialogueAutoAdvance";
import useDialogueShortcuts from "../_hooks/useDialogueShortcuts";
import { fillBlankAnswersMatch } from "../_utils/fillBlankAnswer";
import { useLocale, useTranslations } from "next-intl";
import { useAuth } from "../_contexts/AuthContext";
import { DialogueProgressLink } from "./DialogueProgressSave";
import { CircleX } from "lucide-react";

function getExpectedAnswers(task) {
	return Array.isArray(task.answers) ? task.answers : [task.answer];
}

function getInputWidth(expectedAnswer) {
	const answerLength = String(expectedAnswer ?? "").trim().length;
	const characterWidth = Math.max(answerLength + 2, 8);

	return `clamp(80px, ${characterWidth}ch, 280px)`;
}

function FillBlankTask({
	task,
	dialogueLine,
	lessonId,
	dialogueId,
	previousTask,
	nextTask,
	completionHref,
	onComplete,
	totalTasks,
	confirmedCompleted = false,
	reviewLoading = false,
}) {
	const t = useTranslations("DialogueFeature");
	const locale = useLocale();
	const hint = task.localized?.hint?.[locale] ?? (locale === "vi" ? task.hint : undefined);
	const { loading: authLoading } = useAuth();
	const isMultiBlank = Array.isArray(task.parts) && Array.isArray(task.answers);
	const expectedAnswers = getExpectedAnswers(task);
	const safeHint = typeof hint === "string" && !expectedAnswers.some(answer => typeof answer === "string" && answer.trim() && hint.toLocaleLowerCase().includes(answer.trim().toLocaleLowerCase())) ? hint : null;
	const [answerValues, setAnswerValues] = useState(() =>
		expectedAnswers.map(() => ""),
	);
	const [result, setResult] = useState(null);
	const [started, setStarted] = useState(false);
	const review = confirmedCompleted && !started && result === null;
	const autoAdvance = useDialogueAutoAdvance({
		onComplete,
		manual: true,
		href: nextTask ? `/dialogue/${lessonId}/${dialogueId}/${nextTask.id}` : completionHref || `/dialogue/${lessonId}`,
	});
	const actionRef = useRef(null);
	const audioSceneRef = useRef(null);
	const inputRefs = useRef([]);
	useEffect(() => {
		// The theme provider keeps inputs invisible during session restoration.
		if (authLoading || task.completed || task.locked || review || reviewLoading || started) return;

		const focusFrame = requestAnimationFrame(() =>
			inputRefs.current[0]?.focus({ preventScroll: true }),
		);
		return () => cancelAnimationFrame(focusFrame);
	}, [authLoading, task.completed, task.id, task.locked, review, reviewLoading, started]);

	useEffect(() => {
		if (review && inputRefs.current.includes(document.activeElement)) document.activeElement.blur();
	}, [review]);

	useDialogueShortcuts({
		onEnter: () => actionRef.current?.click(),
		onReplay: () => audioSceneRef.current?.replay(),
	});

	function updateAnswer(index, value) {
		if (autoAdvance.isSubmitted() || review) return;
		setStarted(true);
		setAnswerValues((current) =>
			current.map((answer, answerIndex) =>
				answerIndex === index ? value : answer,
			),
		);
		setResult(null);
	}

	function selectChoice(choice) {
		const emptyIndex = answerValues.findIndex((answer) => !answer.trim());
		if (emptyIndex === -1) return;

		updateAnswer(emptyIndex, choice);
	}

	function checkAnswer() {
		if (autoAdvance.isSubmitted() || review) return;
		const isCorrect = expectedAnswers.every(
			(expectedAnswer, index) =>
				fillBlankAnswersMatch(answerValues[index] || "", expectedAnswer),
		);

		setResult(isCorrect ? "correct" : "wrong");
		if (isCorrect) autoAdvance.complete({ answers: answerValues });
	}

	function getInputBorderColor(index) {
		if (review) return "rgba(148, 163, 184, 0.55)";
		if (!result) return "var(--sj-primary)";

		return fillBlankAnswersMatch(
			answerValues[index] || "",
			expectedAnswers[index],
		)
			? "#22c55e"
			: "#ef4444";
	}

	function isWrongAnswer(index) {
		return result === "wrong" && !fillBlankAnswersMatch(answerValues[index] || "", expectedAnswers[index]);
	}

	function handleInputKeyDown(event, index) {
		const isPlainEnter =
			event.key === "Enter" &&
			!event.ctrlKey &&
			!event.altKey &&
			!event.metaKey &&
			!event.shiftKey;
		if (!isPlainEnter || event.repeat) return;

		event.preventDefault();
		event.stopPropagation();

		if (index < expectedAnswers.length - 1) {
			inputRefs.current[index + 1]?.focus();
			return;
		}

		actionRef.current?.click();
	}

	return (
		<div className="px-4 py-3 text-white sm:px-8">
			<div className="mx-auto max-w-6xl">
				<h1 className="sr-only">{task.title}</h1>

				<div className="grid gap-4 sm:gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
					<div><TaskAudioScene ref={audioSceneRef} key={task.audioUrl} task={task}
						lessonId={lessonId} dialogueId={dialogueId} dialogueLine={dialogueLine} autoPlay />
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
						<p className="mt-2 text-slate-400">
							{task.instruction || t("fillBlankFallback")}
						</p>
						{review && <p role="status" className="mt-3 font-semibold text-emerald-400">{t("completedCorrectAnswers")}</p>}

						<div className="mt-4 min-w-0 rounded-2xl border-2 border-slate-600 bg-slate-900/60 p-4 sm:mt-6 sm:p-6">
							<p className="min-w-0 max-w-full whitespace-normal break-words text-lg leading-10">
								{isMultiBlank ? (
									task.parts.map((part, index) => (
										<Fragment key={index}>
											{part}
											{index < expectedAnswers.length && (
												<input
													ref={(input) => {
														inputRefs.current[index] = input;
													}}
															value={review ? expectedAnswers[index] : answerValues[index] || ""}
													onChange={(event) =>
														updateAnswer(index, event.target.value)
													}
													onKeyDown={(event) =>
														handleInputKeyDown(event, index)
													}
													aria-label={t("blankNumber", { number: index + 1 })}
													aria-invalid={isWrongAnswer(index)}
																	tabIndex={review ? -1 : undefined}
																	onMouseDown={review ? (event) => event.preventDefault() : undefined}
															readOnly={review || result === "correct"}
													placeholder="..."
													style={{
														width: getInputWidth(expectedAnswers[index]),
														maxWidth: "100%",
														borderBottomColor: getInputBorderColor(index),
																		transition: review ? "none" : undefined,
													}}
																	className={`mx-1 inline-block max-w-full border-0 border-b-2 bg-transparent px-2 py-0.5 text-center text-white outline-none focus:outline-none transition-[border-color] ${review ? "cursor-default caret-transparent" : ""} `}
												/>
											)}
										</Fragment>
									))
								) : (
									<>
										{task.sentenceBefore || ""}{" "}
										<input
											ref={(input) => {
												inputRefs.current[0] = input;
											}}
											value={review ? expectedAnswers[0] : answerValues[0] || ""}
											onChange={(event) => updateAnswer(0, event.target.value)}
											onKeyDown={(event) => handleInputKeyDown(event, 0)}
											aria-label={t("blankNumber", { number: 1 })}
											aria-invalid={isWrongAnswer(0)}
											tabIndex={review ? -1 : undefined}
											onMouseDown={review ? (event) => event.preventDefault() : undefined}
											readOnly={review || result === "correct"}
											placeholder="..."
											style={{
												width: getInputWidth(expectedAnswers[0]),
												maxWidth: "100%",
												borderBottomColor: getInputBorderColor(0),
															transition: review ? "none" : undefined,
											}}
										className={`mx-2 max-w-full border-0 border-b-2 bg-transparent px-2 py-0.5 text-center text-white outline-none focus:outline-none transition-[border-color] ${review ? "cursor-default caret-transparent" : ""} `}
										/>{" "}
										{task.sentenceAfter || ""}
									</>
								)}
							</p>

							{isMultiBlank && Array.isArray(task.choices) && (
								<div className="mt-5 flex flex-wrap gap-2">
									{task.choices.map((choice) => {
										const isUsed = answerValues.includes(choice);

										return (
											<button
												key={choice}
												type="button"
												onClick={() => selectChoice(choice)}
												disabled={review || isUsed || result === "correct"}
												className="rounded-lg border border-slate-700 bg-slate-950/60 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-violet-500 hover:bg-violet-500/10 disabled:cursor-not-allowed disabled:opacity-35"
											>
												{choice}
											</button>
										);
									})}
								</div>
							)}
						</div>

						{result === "wrong" && (
							<div className="mt-3" role="status"><p className="flex items-center gap-2 text-sm text-red-400"><CircleX size={15} aria-hidden="true" />{t("wrongTryAgain")}</p>
								{safeHint && <p className="mt-2 rounded-r border-l-2 border-emerald-500 bg-white/5 py-1.5 pl-3 text-sm text-slate-100"><strong className="text-emerald-400">{locale === "vi" ? "Gợi ý:" : "Hint:"}</strong> {safeHint}</p>}
							</div>
						)}

						<div role="status" aria-live="polite">
							{result === "correct" && <p className="mt-5 rounded-xl border border-green-500/30 bg-green-500/10 p-4 font-semibold text-green-400">{t("correct")}</p>}
						</div>
						<div className="mt-4 flex flex-wrap items-start justify-between gap-4">
							{(result === "correct" || review) && <GrammarNote grammar={task.grammar} compact />}
							<div className="ml-auto shrink-0">
								{review ? (
									<DialogueProgressLink ref={actionRef} requireSave={false}
										href={nextTask ? `/dialogue/${lessonId}/${dialogueId}/${nextTask.id}` : completionHref || `/dialogue/${lessonId}`}
										className="inline-flex rounded-xl bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40">
										{t("continue")}
									</DialogueProgressLink>
								) : result === "correct" ? (
									<button
										ref={actionRef}
									type="button"
									onClick={() => autoAdvance.continue()}
									disabled={!autoAdvance.canContinue}
									className="rounded-xl bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
								>
									{t("continue")}
								</button>
								) : (
									<button
									ref={actionRef}
									type="button"
									onClick={checkAnswer}
									disabled={answerValues.some((answer) => !answer.trim())}
									className="rounded-xl bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
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

export default FillBlankTask;
