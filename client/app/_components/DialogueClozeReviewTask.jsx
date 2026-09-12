import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import DialogueShortcutHint from "./DialogueShortcutHint";
import { DialogueTaskNavigation } from "./DialogueExerciseHeader";
import useDialogueShortcuts from "../_hooks/useDialogueShortcuts";

function shuffleItems(items) {
	const shuffled = [...items];

	for (let index = shuffled.length - 1; index > 0; index -= 1) {
		const randomIndex = Math.floor(Math.random() * (index + 1));
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
	previousTask,
	nextTask,
	completionHref,
	totalTasks,
	onComplete,
}) {
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
		if (
			selectedBlankIndex === null ||
			blankResults[selectedBlankIndex] === "correct"
		) {
			return;
		}

		setAssignments((previous) => {
			const updated = [...previous];
			const previousOwner = updated.indexOf(item.id);

			if (previousOwner !== -1) {
				updated[previousOwner] = null;
			}

			updated[selectedBlankIndex] = item.id;
			return updated;
		});
		setAnswers((previous) => {
			const updated = [...previous];
			updated[selectedBlankIndex] = item.word;
			return updated;
		});
		resetBlankResult(selectedBlankIndex);

		const nextEmptyIndex = answers.findIndex(
			(answer, index) =>
				index > selectedBlankIndex &&
				!answer.trim() &&
				blankResults[index] !== "correct",
		);
		setSelectedBlankIndex(nextEmptyIndex === -1 ? selectedBlankIndex : nextEmptyIndex);
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
		const nextResults = expectedAnswers.map((expected, index) =>
			normalizeAnswer(answers[index]) === normalizeAnswer(expected)
				? "correct"
				: "wrong",
		);
		const allCorrect = nextResults.every((result) => result === "correct");

		setBlankResults(nextResults);

		if (allCorrect) {
			onComplete?.();
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

	function getBlankClass(index) {
		if (blankResults[index] === "correct") {
			return "border-emerald-500 bg-emerald-500/10 text-emerald-300";
		}
		if (blankResults[index] === "wrong") {
			return "border-red-500 bg-red-500/10 text-red-300";
		}
		if (mode === "select" && selectedBlankIndex === index) {
			return "border-primary bg-primary/10 text-main ring-2 ring-primary/20";
		}
		return "border-slate-600 bg-slate-950/40 text-main hover:border-slate-500";
	}

	return (
		<div className="min-h-screen px-4 py-8 text-main sm:px-8">
			<div className="mx-auto max-w-6xl">
				<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
					<div>
						<h1 className="text-2xl font-bold">{task.title} 📖</h1>
						<p className="mt-2 text-sm text-secondary sm:text-base">
							{task.instruction}
						</p>
					</div>
					<div className="w-full shrink-0 sm:w-64">
						<DialogueTaskNavigation
							lessonId={lessonId}
							dialogueId={dialogueId}
							taskId={task.id}
							previousTask={previousTask}
							nextTask={nextTask}
							totalTasks={totalTasks}
						/>
					</div>
				</div>

				<div
					className="mt-5 inline-flex rounded-xl border border-app bg-surface p-1"
					role="group"
					aria-label="Chế độ trả lời"
				>
					<button
						type="button"
						onClick={() => switchMode("select")}
						aria-pressed={mode === "select"}
						className={`min-h-10 rounded-lg px-4 text-sm font-semibold transition ${
							mode === "select"
								? "bg-primary text-white shadow-sm"
								: "text-secondary hover:bg-surface-muted hover:text-main"
						}`}
					>
						Chọn từ
					</button>
					<button
						type="button"
						onClick={() => switchMode("type")}
						aria-pressed={mode === "type"}
						className={`min-h-10 rounded-lg px-4 text-sm font-semibold transition ${
							mode === "type"
								? "bg-primary text-white shadow-sm"
								: "text-secondary hover:bg-surface-muted hover:text-main"
						}`}
					>
						Tự gõ
					</button>
				</div>

				<div
					className={`mt-5 grid items-start gap-5 ${
						mode === "select"
							? "lg:grid-cols-[280px_minmax(0,1fr)]"
							: "lg:grid-cols-[minmax(0,1fr)_280px]"
					}`}
				>
					{mode === "select" && (
						<aside className="rounded-2xl border border-app bg-surface p-4 lg:sticky lg:top-4">
							<div className="flex items-center justify-between gap-3">
								<h2 className="text-sm font-semibold text-main">Ngân hàng từ</h2>
								<span className="text-xs text-secondary">
									Còn {remainingWords.length}
								</span>
							</div>
							<div className="mt-3 grid max-h-52 grid-cols-2 gap-2 overflow-y-auto pr-1 lg:max-h-[calc(65vh-4.75rem)] lg:grid-cols-1">
								{remainingWords.map((item) => (
									<button
										key={item.id}
										type="button"
										onClick={() => assignWord(item)}
										disabled={selectedBlankIndex === null || isComplete}
										className="min-h-10 rounded-lg border border-slate-700 bg-slate-950/40 px-3 py-2 text-left text-sm font-medium text-slate-200 transition hover:border-primary hover:bg-primary/10 hover:text-main disabled:cursor-not-allowed disabled:opacity-40"
									>
										{item.word}
									</button>
								))}
								{remainingWords.length === 0 && (
									<p className="col-span-full py-4 text-center text-sm text-secondary">
										Đã dùng hết các từ.
									</p>
								)}
							</div>
						</aside>
					)}

					<section
						className="max-h-[65vh] overflow-y-auto rounded-2xl border border-app bg-surface/70 p-4 sm:p-6"
						aria-label="Hội thoại ôn tập"
					>
						<div className="space-y-5">
							{task.lines.map((line, lineIndex) => (
								<div key={`${line.speaker}-${lineIndex}`}>
									<p className="text-sm font-semibold text-primary">
										{line.speaker}
									</p>
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
											const width = `${Math.max(part.blank.length + 3, 7)}ch`;

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
														aria-label={`Ô trống ${blankIndex + 1}`}
														style={{ width }}
														className={`mx-1 inline-block min-h-9 border-0 border-b-2 bg-transparent px-1 text-center font-semibold outline-none transition ${
															blankResults[blankIndex] === "correct"
																? "border-emerald-500 text-emerald-300"
																: blankResults[blankIndex] === "wrong"
																	? "border-red-500 text-red-300"
																	: "border-slate-500 text-main focus:border-primary"
														}`}
													/>
												);
											}

											return (
												<span
													key={`blank-${lineIndex}-${partIndex}`}
													style={{ minWidth: width }}
													className={`group mx-1 inline-flex min-h-9 items-center justify-center rounded-lg border font-semibold outline-none transition ${getBlankClass(
														blankIndex,
													)}`}
												>
													<button
														type="button"
														onClick={() => selectBlank(blankIndex)}
														disabled={blankResults[blankIndex] === "correct"}
														aria-label={`Ô trống ${blankIndex + 1}`}
														aria-pressed={selectedBlankIndex === blankIndex}
														className="min-h-8 px-2 outline-none"
													>
														{answers[blankIndex] || "\u00a0"}
													</button>
													{answers[blankIndex] &&
														blankResults[blankIndex] !== "correct" && (
															<button
																type="button"
																onClick={(event) =>
																	clearSelectedAnswer(blankIndex, event)
																}
																className="min-h-8 px-1.5 text-secondary opacity-70 transition hover:text-main group-hover:opacity-100"
																aria-label={`Xóa từ ở ô ${blankIndex + 1}`}
															>
																×
															</button>
														)}
												</span>
											);
										})}
									</div>
								</div>
							))}
						</div>
					</section>

					{mode === "type" && (
						<aside className="rounded-2xl border border-app bg-surface p-4 lg:sticky lg:top-4">
							<div className="flex items-center justify-between gap-3">
								<h2 className="text-sm font-semibold text-main">Từ gợi ý</h2>
								<span className="text-xs text-secondary">
									{wordBank.length} từ
								</span>
							</div>
							<div className="mt-3 grid max-h-52 grid-cols-2 gap-2 overflow-y-auto pr-1 lg:max-h-[calc(65vh-4.75rem)] lg:grid-cols-1">
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

				<div className="mt-4 min-h-6 text-sm" aria-live="polite">
					{isComplete ? (
						<p className="font-medium text-emerald-400">
							✓ Chính xác! Bạn đã hoàn thành toàn bộ hội thoại.
						</p>
					) : blankResults.includes("wrong") ? (
						<p className="font-medium text-red-400">
							✕ Vẫn còn từ chưa đúng. Hãy sửa các ô màu đỏ.
						</p>
					) : null}
				</div>

				<DialogueShortcutHint showReplay={false} />
				<div className="mt-4 flex justify-end">
					{isComplete ? (
						<Link
							ref={actionRef}
							href={
								nextTask
									? `/dialogue/${lessonId}/${dialogueId}/${nextTask.id}`
									: completionHref || `/dialogue/${lessonId}`
							}
							className="rounded-xl bg-emerald-600 px-6 py-3 font-semibold text-white transition hover:bg-emerald-500"
						>
							{nextTask ? "Tiếp tục →" : "Hoàn thành hội thoại ✓"}
						</Link>
					) : (
						<button
							ref={actionRef}
							type="button"
							onClick={checkAnswers}
							disabled={!allFilled}
							className="rounded-xl bg-primary px-6 py-3 font-semibold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
						>
							Kiểm tra
						</button>
					)}
				</div>
			</div>
		</div>
	);
}

export default DialogueClozeReviewTask;
