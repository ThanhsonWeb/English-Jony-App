import { Fragment, useEffect, useRef, useState } from "react";
import DialogueShortcutHint from "./DialogueShortcutHint";
import { DialogueTaskNavigation } from "./DialogueExerciseHeader";
import GrammarNote from "./GrammarNote";
import TaskAudioScene from "./TaskAudioScene";
import useDialogueAutoAdvance from "../_hooks/useDialogueAutoAdvance";
import useDialogueShortcuts from "../_hooks/useDialogueShortcuts";
import { fillBlankAnswersMatch } from "../_utils/fillBlankAnswer";
import { useTranslations } from "next-intl";
import { useAuth } from "../_contexts/AuthContext";
import { SUBTITLE_WORD_PATTERN, SUBTITLE_WORD_TOKEN_PATTERN } from "../_lib/dictionary/findPreferredLookup";
import { findVisibleDictationLookup } from "../_lib/dictionary/findVisibleDictationLookup";
import DialogueWordPopup from "./DialogueWordPopup";

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
}) {
	const t = useTranslations("DialogueFeature");
	const { loading: authLoading } = useAuth();
	const isMultiBlank = Array.isArray(task.parts) && Array.isArray(task.answers);
	const expectedAnswers = getExpectedAnswers(task);
	const [answerValues, setAnswerValues] = useState(() =>
		expectedAnswers.map(() => ""),
	);
	const [result, setResult] = useState(null);
	const [selectedLookup, setSelectedLookup] = useState(null);
	const dictionaryPopupRef = useRef(null);
	const autoAdvance = useDialogueAutoAdvance({
		onComplete,
		href: nextTask ? `/dialogue/${lessonId}/${dialogueId}/${nextTask.id}` : completionHref || `/dialogue/${lessonId}`,
	});
	const actionRef = useRef(null);
	const audioSceneRef = useRef(null);
	const inputRefs = useRef([]);
	const visibleParts = isMultiBlank
		? task.parts
		: [task.sentenceBefore || "", task.sentenceAfter || ""];

	useEffect(() => {
		if (!selectedLookup) return;
		function dismiss(event) {
			if (dictionaryPopupRef.current?.contains(event.target) || event.target.closest?.('[data-dictionary-token="true"]')) return;
			setSelectedLookup(null);
		}
		function dismissOnEscape(event) {
			if (event.key === "Escape") setSelectedLookup(null);
		}
		document.addEventListener("pointerdown", dismiss);
		document.addEventListener("keydown", dismissOnEscape);
		window.addEventListener("resize", dismissOnEscape);
		window.addEventListener("scroll", dismissOnEscape, true);
		return () => {
			document.removeEventListener("pointerdown", dismiss);
			document.removeEventListener("keydown", dismissOnEscape);
			window.removeEventListener("resize", dismissOnEscape);
			window.removeEventListener("scroll", dismissOnEscape, true);
		};
	}, [selectedLookup]);

	function renderVisibleWords(part, partIndex) {
		let wordIndex = -1;
		return part.split(SUBTITLE_WORD_PATTERN).map((token, index) => {
			if (!SUBTITLE_WORD_TOKEN_PATTERN.test(token)) return token;
			const clickedWordIndex = ++wordIndex;
			const active = selectedLookup?.partIndex === partIndex &&
				selectedLookup.startWordIndex <= clickedWordIndex &&
				clickedWordIndex <= selectedLookup.endWordIndex;
			return <button key={`${partIndex}-${index}`} type="button" data-dictionary-token="true"
				className={`rounded-sm transition-colors hover:bg-white/10 hover:text-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/70 ${active ? "bg-cyan-400/15 text-cyan-100" : ""}`}
				onClick={(event) => {
					const lookup = findVisibleDictationLookup({ lessonId, dialogueId, line: dialogueLine,
						parts: visibleParts, answers: expectedAnswers, partIndex, clickedWordIndex });
					if (!lookup) { setSelectedLookup(null); return; }
					const bounds = event.currentTarget.getBoundingClientRect();
					const popupWidth = 256;
					setSelectedLookup({ ...lookup, phraseLookup: lookup.wordLookup ? lookup : null,
						partIndex, isMobile: window.innerWidth < 640,
						position: {
							left: Math.min(Math.max(bounds.left + bounds.width / 2 - popupWidth / 2, 12), window.innerWidth - popupWidth - 12),
							top: bounds.top >= 180 ? bounds.top - 10 : bounds.bottom + 10,
							opensAbove: bounds.top >= 180,
						},
					});
				}}>{token}</button>;
		});
	}

	function pronounceLookup() {
		if (!selectedLookup || !("speechSynthesis" in window)) return;
		window.speechSynthesis.cancel();
		const utterance = new SpeechSynthesisUtterance(selectedLookup.result.text);
		utterance.lang = "en-US";
		utterance.rate = 0.9;
		window.speechSynthesis.speak(utterance);
	}

	useEffect(() => {
		// The theme provider keeps inputs invisible during session restoration.
		if (authLoading || task.completed || task.locked) return;

		const focusFrame = requestAnimationFrame(() =>
			inputRefs.current[0]?.focus({ preventScroll: true }),
		);
		return () => cancelAnimationFrame(focusFrame);
	}, [authLoading, task.completed, task.id, task.locked]);

	useDialogueShortcuts({
		onEnter: () => actionRef.current?.click(),
		onReplay: () => audioSceneRef.current?.replay(),
	});

	function updateAnswer(index, value) {
		if (autoAdvance.isSubmitted()) return;
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
		if (autoAdvance.isSubmitted()) return;
		const isCorrect = expectedAnswers.every(
			(expectedAnswer, index) =>
				fillBlankAnswersMatch(answerValues[index] || "", expectedAnswer),
		);

		setResult(isCorrect ? "correct" : "wrong");
		if (isCorrect) autoAdvance.complete({ answers: answerValues });
	}

	function getInputBorderColor(index) {
		if (!result) return "var(--sj-primary)";

		return fillBlankAnswersMatch(
			answerValues[index] || "",
			expectedAnswers[index],
		)
			? "#22c55e"
			: "#ef4444";
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
		<div className="min-h-screen px-4 py-8 text-white sm:px-8">
			<div className="mx-auto max-w-6xl">
				<h1 className="mt-2 text-2xl font-bold">{task.title} ✍️</h1>

				<div className="mt-8 grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
					<TaskAudioScene ref={audioSceneRef} key={task.audioUrl} task={task}
						lessonId={lessonId} dialogueId={dialogueId} dialogueLine={dialogueLine} autoPlay />

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

						<div className="mt-6 min-w-0 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
							<p className="min-w-0 max-w-full whitespace-normal break-words text-lg leading-10">
								{isMultiBlank ? (
									task.parts.map((part, index) => (
										<Fragment key={index}>
											{renderVisibleWords(part, index)}
											{index < expectedAnswers.length && (
												<input
													ref={(input) => {
														inputRefs.current[index] = input;
													}}
													value={answerValues[index] || ""}
													onChange={(event) =>
														updateAnswer(index, event.target.value)
													}
													onKeyDown={(event) =>
														handleInputKeyDown(event, index)
													}
													aria-label={t("blankNumber", { number: index + 1 })}
													readOnly={result === "correct"}
													placeholder="..."
													style={{
														width: getInputWidth(expectedAnswers[index]),
														maxWidth: "100%",
														borderBottomColor: getInputBorderColor(index),
													}}
													className={`mx-1 inline-block max-w-full border-b-2 bg-transparent px-2 py-1 text-center outline-none transition-[border-color] ${result === "correct" ? "text-green-400" : ""}`}
												/>
											)}
										</Fragment>
									))
								) : (
									<>
										{renderVisibleWords(task.sentenceBefore || "", 0)}{" "}
										<input
											ref={(input) => {
												inputRefs.current[0] = input;
											}}
											value={answerValues[0] || ""}
											onChange={(event) => updateAnswer(0, event.target.value)}
											onKeyDown={(event) => handleInputKeyDown(event, 0)}
											readOnly={result === "correct"}
											placeholder="..."
											style={{
												width: getInputWidth(expectedAnswers[0]),
												maxWidth: "100%",
												borderBottomColor: getInputBorderColor(0),
											}}
										className={`mx-2 max-w-full border-b-2 bg-transparent px-2 py-1 text-center outline-none transition-[border-color] ${result === "correct" ? "text-green-400" : ""}`}
										/>{" "}
										{renderVisibleWords(task.sentenceAfter || "", 1)}
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
												disabled={isUsed || result === "correct"}
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
							<div className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-400">
								❌ {t("wrongTryAgain")}
							</div>
						)}

						<span className="sr-only" role="status">{result === "correct" ? t("correct") : ""}</span>
						<DialogueShortcutHint />
						<div className="mt-4 flex items-start justify-between gap-4">
							{result && <GrammarNote grammar={task.grammar} />}
							<div className="ml-auto shrink-0">
								{result !== "correct" && (
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
			<DialogueWordPopup lookup={selectedLookup} popupRef={dictionaryPopupRef}
				onPronounce={pronounceLookup}
				onSwitch={(switchTo) => setSelectedLookup((current) => ({ ...current, ...switchTo }))} />
		</div>
	);
}

export default FillBlankTask;
