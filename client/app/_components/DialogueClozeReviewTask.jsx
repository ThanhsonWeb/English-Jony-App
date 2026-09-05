import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import DialogueShortcutHint from "./DialogueShortcutHint";
import useDialogueShortcuts from "../_hooks/useDialogueShortcuts";

function shuffleWords(words) {
	const shuffled = [...words];

	for (let index = shuffled.length - 1; index > 0; index -= 1) {
		const randomIndex = Math.floor(Math.random() * (index + 1));
		[shuffled[index], shuffled[randomIndex]] = [
			shuffled[randomIndex],
			shuffled[index],
		];
	}

	const stayedInDialogueOrder = shuffled.every(
		(word, index) => word === words[index],
	);

	if (stayedInDialogueOrder && shuffled.length > 1) {
		shuffled.push(shuffled.shift());
	}

	return shuffled;
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
	nextTask,
	completionHref,
	totalTasks,
	onComplete,
}) {
	const expectedAnswers = task.lines.flatMap((line) =>
		line.parts
			.filter((part) => typeof part === "object")
			.map((part) => part.blank),
	);

	const [answers, setAnswers] = useState(() =>
		Array(expectedAnswers.length).fill(""),
	);
	const [wordHints] = useState(() => shuffleWords(expectedAnswers));

	const [result, setResult] = useState(null);
	const actionRef = useRef(null);

	useDialogueShortcuts({
		onEnter: () => actionRef.current?.click(),
	});

	function handleAnswerChange(index, value) {
		setAnswers((previous) => {
			const updated = [...previous];
			updated[index] = value;
			return updated;
		});

		setResult(null);
	}

	function checkAnswers() {
		const isCorrect = expectedAnswers.every(
			(expected, index) =>
				answers[index].trim().toLowerCase() === expected.trim().toLowerCase(),
		);

		setResult(isCorrect ? "correct" : "wrong");

		if (isCorrect) {
			onComplete?.();
		}
	}

	const allFilled = answers.every((answer) => answer.trim() !== "");

	return (
		<div className="min-h-screen px-4 py-8 text-white sm:px-8">
			<div className="mx-auto max-w-4xl">
				{/* Back */}
				<Link
					href={`/dialogue/${lessonId}`}
					className="inline-flex items-center gap-2 text-slate-400 transition hover:text-white"
				>
					<ArrowLeft size={18} />
					Quay lại
				</Link>

				{/* Header */}
				<p className="mt-8 text-sm text-slate-500">
					Bài {task.id}/{totalTasks}
				</p>

				<h1 className="mt-2 text-2xl font-bold">{task.title} 📖</h1>

				<p className="mt-2 text-slate-400">{task.instruction}</p>

				{/* Available words */}
				<div className="mt-7 border-y border-slate-800 py-5">
					<p className="text-center text-sm font-medium text-slate-400">
						Các từ cần dùng
					</p>
					<div className="mt-3 flex flex-wrap justify-center gap-2">
						{wordHints.map((word, index) => (
							<span
								key={`${word}-${index}`}
								className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm font-medium text-slate-200"
							>
								{word}
							</span>
						))}
					</div>
				</div>

				{/* Dialogue */}
				<div className="mt-8 space-y-6 rounded-xl border border-slate-800 bg-slate-950/40 p-5 sm:p-6">
					{task.lines.map((line, lineIndex) => (
						<div key={`${line.speaker}-${lineIndex}`}>
							<p
								className={
									line.speaker === "Maria"
										? "text-sm font-semibold text-blue-400"
										: "text-sm font-semibold text-emerald-400"
								}
							>
								{line.speaker}
							</p>

							<div className="mt-1 flex flex-wrap items-baseline leading-9 text-slate-200">
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

									const isWrong =
										result === "wrong" &&
										answers[blankIndex].trim().toLowerCase() !==
											part.blank.toLowerCase();

									return (
										<input
											key={`blank-${lineIndex}-${partIndex}`}
											type="text"
											value={answers[blankIndex]}
											onChange={(e) =>
												handleAnswerChange(blankIndex, e.target.value)
											}
											disabled={result === "correct"}
											autoComplete="off"
											spellCheck="false"
											aria-label={`Ô trống ${blankIndex + 1}`}
											style={{
												width: `${Math.max(part.blank.length + 2, 6)}ch`,
											}}
											className={`mx-1 inline-block border-0 border-b-2 bg-transparent px-1 text-center font-semibold text-white outline-none transition ${
												isWrong
													? "border-red-500 text-red-300"
													: result === "correct"
														? "border-emerald-500 text-emerald-300"
														: "border-blue-500 focus:border-blue-400"
											}`}
										/>
									);
								})}
							</div>
						</div>
					))}
				</div>

				{/* Result */}
				{result === "correct" && (
					<div className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-400">
						✅ Chính xác! Bạn đã hoàn thành toàn bộ hội thoại.
					</div>
				)}

				{result === "wrong" && (
					<div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-400">
						❌ Vẫn còn một vài từ chưa đúng. Hãy kiểm tra lại nhé.
					</div>
				)}

				<DialogueShortcutHint showReplay={false} />
				{/* Action */}
				<div className="mt-4 flex justify-end">
					{result === "correct" ? (
						<Link
							ref={actionRef}
							href={
								nextTask
									? `/dialogue/${lessonId}/${dialogueId}/${nextTask.id}`
										: completionHref || `/dialogue/${lessonId}`
							}
							className="rounded-xl bg-emerald-600 px-6 py-3 font-semibold transition hover:bg-emerald-500"
						>
							{nextTask ? "Tiếp tục →" : "Hoàn thành hội thoại ✓"}
						</Link>
					) : (
						<button
							ref={actionRef}
							type="button"
							onClick={checkAnswers}
							disabled={!allFilled}
							className="rounded-xl bg-blue-600 px-6 py-3 font-semibold transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
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
