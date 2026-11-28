import { useEffect, useMemo, useRef, useState } from "react";
import { Volume2 } from "lucide-react";
import DialogueShortcutHint from "./DialogueShortcutHint";
import { DialogueTaskNavigation } from "./DialogueExerciseHeader";
import useDialogueAutoAdvance from "../_hooks/useDialogueAutoAdvance";
import useDialogueShortcuts from "../_hooks/useDialogueShortcuts";
import { useTranslations } from "next-intl";
import { a2LocalFallback } from "@/app/_lib/dialogue/a2R2Media.mjs";
import styles from "./DialogueClozeReviewTask.module.css";

function shuffleItems(items, seed) {
	const shuffled = [...items];
	// A stable exercise seed gives server and browser the same shuffled order.
	let state = 2166136261;
	for (const character of seed) {
		state = Math.imul(state ^ character.charCodeAt(0), 16777619) >>> 0;
	}

	for (let index = shuffled.length - 1; index > 0; index -= 1) {
		state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
		const randomIndex = Math.floor((state / 4294967296) * (index + 1));
		[shuffled[index], shuffled[randomIndex]] = [
			shuffled[randomIndex],
			shuffled[index],
		];
	}

	const stayedInDialogueOrder = shuffled.every(
		(item, index) => item.id === items[index].id,
	);

	if (stayedInDialogueOrder && shuffled.length > 1) {
		shuffled.push(shuffled.shift());
	}

	return shuffled;
}

function normalizeAnswer(value = "") {
	return value.trim().toLocaleLowerCase("en");
}

function getBlankIndex(lines, lineIndex, partIndex) {
	const previousLineBlanks = lines
		.slice(0, lineIndex)
		.flatMap((line) => line.parts)
		.filter((part) => typeof part === "object").length;

	const previousPartBlanks = lines[lineIndex].parts
		.slice(0, partIndex)
		.filter((part) => typeof part === "object").length;

	return previousLineBlanks + previousPartBlanks;
}

function DialogueClozeReviewTask({
	task,
	lessonId,
	dialogueId,
	dialogueLines = [],
	previousTask,
	nextTask,
	completionHref,
	totalTasks,
	onComplete,
}) {
	const t = useTranslations("DialogueFeature");
	const expectedAnswers = useMemo(
		() =>
			task.lines.flatMap((line) =>
				line.parts
					.filter((part) => typeof part === "object")
					.map((part) => part.blank),
			),
		[task.lines],
	);
	const [wordBank] = useState(() =>
		shuffleItems(
			expectedAnswers.map((word, index) => ({
				id: `word-${index}`,
				word,
			})),
			`${lessonId}/${dialogueId}/${task.id}/${JSON.stringify(expectedAnswers)}`,
		),
	);
	const [mode, setMode] = useState("select");
	const [answers, setAnswers] = useState(() =>
		Array(expectedAnswers.length).fill(""),
	);
	const [assignments, setAssignments] = useState(() =>
		Array(expectedAnswers.length).fill(null),
	);
	const [blankResults, setBlankResults] = useState(() =>
		Array(expectedAnswers.length).fill(null),
	);
	const [selectedBlankIndex, setSelectedBlankIndex] = useState(0);
	const audioRef = useRef(null);
	const dialogueRef = useRef(null);
	const [audioError, setAudioError] = useState(false);
	const blankRefs = useRef([]);
	const autoAdvance = useDialogueAutoAdvance({
		onComplete,
		manual: true,
		href: nextTask ? `/dialogue/${lessonId}/${dialogueId}/${nextTask.id}` : completionHref || `/dialogue/${lessonId}`,
	});
	const actionRef = useRef(null);

	const isComplete =
		blankResults.length > 0 &&
		blankResults.every((blankResult) => blankResult === "correct");
	const allFilled = answers.every((answer) => answer.trim() !== "");
	const usedWordIds = new Set(assignments.filter(Boolean));
	const remainingWords = wordBank.filter((item) => !usedWordIds.has(item.id));

	useDialogueShortcuts({
		onEnter: () => actionRef.current?.click(),
	});

	useEffect(() => () => { audioRef.current?.pause(); }, []);

	function resetBlankResult(index) {
		setBlankResults((previous) => {
			if (previous[index] !== "wrong") return previous;
			const updated = [...previous];
			updated[index] = null;
			return updated;
		});
	}

	function handleTypedAnswerChange(index, value) {
		if (blankResults[index] === "correct") return;

		setAnswers((previous) => {
			const updated = [...previous];
			updated[index] = value;
			return updated;
		});
		setAssignments((previous) => {
			if (!previous[index]) return previous;
			const updated = [...previous];
			updated[index] = null;
			return updated;
		});
		resetBlankResult(index);
	}

	function selectBlank(index) {
		if (blankResults[index] !== "correct") {
			setSelectedBlankIndex(index);
		}
	}

	function assignWord(item) {
		const firstEmptyIndex = answers.findIndex(
			(answer, index) =>
				!answer.trim() && blankResults[index] !== "correct",
		);
		const targetIndex =
			selectedBlankIndex !== null &&
			blankResults[selectedBlankIndex] !== "correct"
				? selectedBlankIndex
				: firstEmptyIndex;

		if (targetIndex === -1 || targetIndex === null) return;

		setAssignments((previous) => {
			const updated = [...previous];
			const previousOwner = updated.indexOf(item.id);

			if (previousOwner !== -1) {
				updated[previousOwner] = null;
			}

			updated[targetIndex] = item.id;
			return updated;
		});
		const updatedAnswers = [...answers];
		updatedAnswers[targetIndex] = item.word;
		setAnswers(updatedAnswers);
		resetBlankResult(targetIndex);

		let nextEmptyIndex = updatedAnswers.findIndex(
			(answer, index) =>
				index > targetIndex &&
				!answer.trim() &&
				blankResults[index] !== "correct",
		);
		if (nextEmptyIndex === -1) {
			nextEmptyIndex = updatedAnswers.findIndex(
				(answer, index) =>
					!answer.trim() && blankResults[index] !== "correct",
			);
		}
		setSelectedBlankIndex(nextEmptyIndex === -1 ? targetIndex : nextEmptyIndex);
		if (nextEmptyIndex !== -1) requestAnimationFrame(() => {
			const blank = blankRefs.current[nextEmptyIndex];
			const container = dialogueRef.current;
			if (!blank || !container) return;
			blank.focus({ preventScroll: true });
			const bounds = blank.getBoundingClientRect();
			const containerBounds = container.getBoundingClientRect();
			if (bounds.bottom > containerBounds.bottom) container.scrollTop += bounds.bottom - containerBounds.bottom + 12;
			else if (bounds.top < containerBounds.top) container.scrollTop -= containerBounds.top - bounds.top + 12;
		});
	}

	function clearSelectedAnswer(index, event) {
		event.stopPropagation();
		if (blankResults[index] === "correct") return;

		setAnswers((previous) => {
			const updated = [...previous];
			updated[index] = "";
			return updated;
		});
		setAssignments((previous) => {
			const updated = [...previous];
			updated[index] = null;
			return updated;
		});
		resetBlankResult(index);
		setSelectedBlankIndex(index);
	}

	function checkAnswers() {
		if (autoAdvance.isSubmitted()) return;
		const nextResults = expectedAnswers.map((expected, index) =>
			normalizeAnswer(answers[index]) === normalizeAnswer(expected)
				? "correct"
				: "wrong",
		);
		const allCorrect = nextResults.every((result) => result === "correct");

		setBlankResults(nextResults);

		if (allCorrect) {
			autoAdvance.complete({ answers });
			setSelectedBlankIndex(null);
			return;
		}

		setSelectedBlankIndex(
			nextResults.findIndex((result) => result === "wrong"),
		);
	}

	function switchMode(nextMode) {
		if (nextMode === "select") {
			const claimedWordIds = new Set();
			setAssignments(
				answers.map((answer) => {
					const match = wordBank.find(
						(item) =>
							!claimedWordIds.has(item.id) &&
							normalizeAnswer(item.word) === normalizeAnswer(answer),
					);
					if (!match) return null;
					claimedWordIds.add(match.id);
					return match.id;
				}),
			);
		}
		setMode(nextMode);
		if (nextMode === "select" && selectedBlankIndex === null && !isComplete) {
			const firstEditableIndex = blankResults.findIndex(
				(result) => result !== "correct",
			);
			setSelectedBlankIndex(firstEditableIndex);
		}
	}

	function resetAnswers() {
		if (isComplete || autoAdvance.isSubmitted()) return;
		setAnswers(Array(expectedAnswers.length).fill(""));
		setAssignments(Array(expectedAnswers.length).fill(null));
		setBlankResults(Array(expectedAnswers.length).fill(null));
		setSelectedBlankIndex(0);
	}

	function getBlankClass(index) {
		if (blankResults[index] === "correct") {
			return "border-emerald-500 bg-emerald-500/10 text-emerald-300";
		}
		if (blankResults[index] === "wrong") {
			return "border-rose-500 bg-rose-500/10 text-rose-300";
		}
		if (mode === "select" && selectedBlankIndex === index) {
			return "border-teal-400 bg-primary/10 text-main ring-2 ring-teal-400/40 shadow-sm";
		}
		return "border-slate-600 bg-slate-950/40 text-main hover:border-slate-500";
	}

	return (
		<div className="px-4 pb-3 pt-1 text-main sm:px-8">
			<div className="mx-auto max-w-3xl">
				<div className="flex items-center justify-between gap-2">
					<div className="min-w-0 shrink">
						<h1 className="sr-only">
							{task.title || t("dialogueClozeTitle")}
						</h1>
						<p className="sr-only">
							{task.instruction || t("dialogueClozeInstruction")}
						</p>
					</div>
					<div className="flex shrink-0 items-center gap-1 sm:gap-3">
				<div
					className="inline-flex rounded-xl border border-app bg-surface p-1"
					role="group"
					aria-label={t("answerMode")}
				>
					<button
						type="button"
						onClick={() => switchMode("select")}
						aria-pressed={mode === "select"}
						className={`min-h-8 rounded-lg px-2 text-xs font-semibold transition sm:px-3 sm:text-sm ${
							mode === "select"
								? "bg-primary text-white shadow-sm"
								: "text-secondary hover:bg-surface-muted hover:text-main"
						}`}
					>
						{t("chooseWords")}
					</button>
					<button
						type="button"
						onClick={() => switchMode("type")}
						aria-pressed={mode === "type"}
						className={`min-h-8 rounded-lg px-2 text-xs font-semibold transition sm:px-3 sm:text-sm ${
							mode === "type"
								? "bg-primary text-white shadow-sm"
								: "text-secondary hover:bg-surface-muted hover:text-main"
						}`}
					>
						{t("typeAnswer")}
					</button>
				</div>
						<div className="w-28 sm:w-40"><DialogueTaskNavigation compact lessonId={lessonId} dialogueId={dialogueId} taskId={task.id} previousTask={previousTask} nextTask={nextTask} totalTasks={totalTasks} /></div>
					</div>
				</div>

				<div className="mt-2 flex flex-col gap-2">
					{mode === "select" && (
						<aside className="order-2 rounded-2xl border border-app bg-surface p-4">
							<div className="flex items-center justify-between gap-3">
								<h2 className="text-sm font-semibold text-main">{t("wordBank")}</h2>
								<span className="text-xs text-secondary">
									{t("wordsRemaining", { count: remainingWords.length })}
								</span>
								<button type="button" disabled={isComplete} onClick={resetAnswers} className="cursor-pointer rounded-lg px-2 py-1 text-sm font-semibold text-primary hover:bg-surface-muted disabled:opacity-40">{t("resetCloze")}</button>
							</div>
							<div className="mt-3 flex max-h-32 flex-wrap gap-2 overflow-y-auto">
								{wordBank.map((item) => (
									<button
										key={item.id}
										type="button"
										onClick={() => assignWord(item)}
										disabled={isComplete || usedWordIds.has(item.id)}
										className="min-h-10 rounded-lg border border-slate-700 bg-slate-950/40 px-3 py-2 text-left text-sm font-medium text-slate-200 transition hover:border-primary hover:bg-primary/10 hover:text-main disabled:cursor-not-allowed disabled:opacity-40"
									>
										{item.word}
									</button>
								))}
							</div>
						</aside>
					)}

					<section
						ref={dialogueRef}
						className={`${styles.dialogueScroll} order-1 max-h-[min(45vh,max(8rem,calc(100dvh-25rem)))] overflow-y-auto overscroll-contain rounded-2xl border border-app bg-surface/70 p-4 sm:p-6`}
					aria-label={t("reviewDialogue")}
					>
						<div className="space-y-5">
							{task.lines.map((line, lineIndex) => (
								<div key={`${line.speaker}-${lineIndex}`} data-cloze-line>
									<div className="flex items-center gap-2 text-sm font-semibold text-primary">
										<span>{line.speaker}</span>
										{(() => {
											const text = line.parts.map(part => typeof part === "string" ? part : part.blank).join("");
											const source = line.dialogueLineId != null ? dialogueLines.find(item => String(item.id) === String(line.dialogueLineId)) : dialogueLines.find(item => item.speaker === line.speaker && item.text === text);
											return source?.audioUrl ? <button type="button" aria-label={t("playDialogueLine", { number: lineIndex + 1 })} title={t("playDialogueLine", { number: lineIndex + 1 })} onClick={() => { setAudioError(false); const audio = audioRef.current; audio.pause(); audio.src = source.audioUrl; void audio.play().catch(() => setAudioError(true)); }} className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full text-secondary hover:bg-surface-muted hover:text-main"><Volume2 size={16} /></button> : null;
										})()}
									</div>
									<div className="mt-1.5 flex flex-wrap items-center gap-y-2 text-[15px] leading-8 text-slate-200 sm:text-base">
										{line.parts.map((part, partIndex) => {
											if (typeof part === "string") {
												return (
													<span
														key={`text-${lineIndex}-${partIndex}`}
														className="whitespace-pre-wrap"
													>
														{part}
													</span>
												);
											}

											const blankIndex = getBlankIndex(
												task.lines,
												lineIndex,
												partIndex,
											);
											const width = `${Math.max((answers[blankIndex] || "").length + 3, 8)}ch`;

											if (mode === "type") {
												return (
													<input
														key={`blank-${lineIndex}-${partIndex}`}
														type="text"
														value={answers[blankIndex]}
														onChange={(event) =>
															handleTypedAnswerChange(
																blankIndex,
																event.target.value,
															)
														}
														disabled={blankResults[blankIndex] === "correct"}
														autoComplete="off"
														spellCheck="false"
																aria-label={t("blankNumber", { number: blankIndex + 1 })}
														style={{ width }}
																className={`mx-1 inline-block h-8 min-w-[80px] max-w-full rounded-md border px-2 text-center font-semibold outline-none transition ${
															blankResults[blankIndex] === "correct"
																? "border-emerald-500 text-emerald-300"
																: blankResults[blankIndex] === "wrong"
																			? "border-rose-500 bg-rose-500/10 text-rose-300 focus-visible:outline-2 focus-visible:outline-rose-500"
																			: "border-slate-500 bg-slate-950/40 text-main focus:border-teal-400 focus-visible:outline-2 focus-visible:outline-teal-400"
														}`}
													/>
												);
											}

											return (
												<span
													key={`blank-${lineIndex}-${partIndex}`}
															style={{ width }}
															className={`group mx-1 inline-flex min-h-8 min-w-[80px] max-w-full cursor-pointer items-center justify-center rounded-lg border font-semibold outline-none transition ${getBlankClass(
														blankIndex,
													)}`}
												>
													<button
														ref={(element) => { blankRefs.current[blankIndex] = element; }}
														type="button"
																		onClick={(event) => answers[blankIndex] ? clearSelectedAnswer(blankIndex, event) : selectBlank(blankIndex)}
														disabled={blankResults[blankIndex] === "correct"}
																aria-label={t("blankNumber", { number: blankIndex + 1 })}
														aria-pressed={selectedBlankIndex === blankIndex}
														className="min-h-8 flex-1 cursor-pointer px-2 outline-none"
													>
														{answers[blankIndex] || "\u00a0"}
													</button>
												</span>
											);
										})}
									</div>
								</div>
							))}
						</div>
					</section>

					{mode === "type" && (
						<aside className="order-2 rounded-2xl border border-app bg-surface p-4">
							<div className="flex items-center justify-between gap-3">
								<h2 className="text-sm font-semibold text-main">{t("suggestedWords")}</h2>
								<span className="text-xs text-secondary">
									{t("wordCount", { count: wordBank.length })}
								</span>
								<button type="button" disabled={isComplete} onClick={resetAnswers} className="cursor-pointer rounded-lg px-2 py-1 text-sm font-semibold text-primary hover:bg-surface-muted disabled:opacity-40">{t("resetCloze")}</button>
							</div>
							<div className="mt-3 flex max-h-32 flex-wrap gap-2 overflow-y-auto">
								{wordBank.map((item) => (
									<div
										key={item.id}
										className="min-h-10 rounded-lg border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm font-medium text-slate-200"
									>
										{item.word}
									</div>
								))}
							</div>
						</aside>
					)}
				</div>

				<audio ref={audioRef} onError={(event) => { const audio = event.currentTarget; const fallback = a2LocalFallback(audio.src); if (fallback) { audio.src = fallback; void audio.play().catch(() => setAudioError(true)); } else setAudioError(true); }} />
				{audioError && <p role="alert" className="mt-2 text-sm text-rose-400">{t("dialogueAudioPlaybackFailed")}</p>}
				<div className="mt-4 flex flex-wrap items-center justify-between gap-3">
				<div className="text-sm" role="status" aria-live="polite">
					{isComplete && <p className="font-semibold text-emerald-400">{t("clozeCorrect")}</p>}
					{blankResults.includes("wrong") && (
						<p className="font-medium text-red-400">
							✕ {t("clozeWrong")}
						</p>
					)}
				</div>

				<div className="ml-auto flex justify-end">
					{isComplete ? (
						<button
							ref={actionRef}
							type="button"
							onClick={() => autoAdvance.continue()}
							disabled={!autoAdvance.canContinue}
							className="rounded-xl bg-primary px-6 py-3 font-semibold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
						>
							{nextTask ? t("continue") : t("completeDialogue")}
						</button>
					) : (
						<button
							ref={actionRef}
							type="button"
							onClick={checkAnswers}
							disabled={!allFilled}
							className="rounded-xl bg-primary px-6 py-3 font-semibold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
						>
							{t("check")}
						</button>
					)}
				</div>
				</div>
				<DialogueShortcutHint showReplay={false} />
			</div>
		</div>
	);
}

export default DialogueClozeReviewTask;
