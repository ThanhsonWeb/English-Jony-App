import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Fragment, useState } from "react";
import GrammarNote from "./GrammarNote";
import TaskAudioScene from "./TaskAudioScene";

function getExpectedAnswers(task) {
	return Array.isArray(task.answers) ? task.answers : [task.answer];
}

function normalizeAnswer(value) {
	return value
		.trim()
		.toLocaleLowerCase()
		.replace(/[’‘]/g, "'")
		.replace(/\s+/g, " ");
}

function getInputWidth(expectedAnswer) {
	const characterWidth = Math.min(
		Math.max(expectedAnswer.trim().length + 2, 4),
		14,
	);

	return `${characterWidth}ch`;
}

function FillBlankTask({
	task,
	lessonId,
	dialogueId,
	nextTask,
	completionHref,
	onComplete,
	totalTasks,
}) {
	const isMultiBlank = Array.isArray(task.parts) && Array.isArray(task.answers);
	const expectedAnswers = getExpectedAnswers(task);
	const [answerValues, setAnswerValues] = useState(() =>
		expectedAnswers.map(() => ""),
	);
	const [result, setResult] = useState(null);

	function updateAnswer(index, value) {
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
		const isCorrect = expectedAnswers.every(
			(expectedAnswer, index) =>
				normalizeAnswer(answerValues[index] || "") ===
				normalizeAnswer(expectedAnswer),
		);

		setResult(isCorrect ? "correct" : "wrong");
		if (isCorrect) onComplete?.();
	}

	return (
		<div className="min-h-screen px-4 py-8 text-white sm:px-8">
			<div className="mx-auto max-w-6xl">
				{/* <Link
					href={`/dialogue/${lessonId}`}
					className="inline-flex items-center gap-2 text-slate-400 hover:text-white"
				>
					<ArrowLeft size={18} />
					Quay lại
				</Link> */}

				<p className="mt-8 text-sm text-slate-500">
					Bài {task.id}/{totalTasks}
				</p>
				<h1 className="mt-2 text-2xl font-bold">{task.title} ✍️</h1>

				<div className="mt-8 grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
					<TaskAudioScene key={task.audioUrl} task={task} />

					<div>
						<p className="text-sm font-semibold text-violet-400">Câu hỏi</p>
						<p className="mt-2 text-slate-400">
							{task.instruction || "Điền từ đúng vào câu bên dưới."}
						</p>

						<div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
							<p className="text-lg leading-10">
								{isMultiBlank ? (
									task.parts.map((part, index) => (
										<Fragment key={index}>
											{part}
											{index < expectedAnswers.length && (
												<input
													value={answerValues[index] || ""}
													onChange={(event) =>
														updateAnswer(index, event.target.value)
													}
													aria-label={`Chỗ trống ${index + 1}`}
													placeholder="..."
													style={{
														width: getInputWidth(expectedAnswers[index]),
													}}
													className="mx-1 inline-block max-w-full border-b-2 border-blue-500 bg-transparent px-2 py-1 text-center outline-none"
												/>
											)}
										</Fragment>
									))
								) : (
									<>
										{task.sentenceBefore}{" "}
										<input
											value={answerValues[0] || ""}
											onChange={(event) => updateAnswer(0, event.target.value)}
											placeholder="..."
											style={{ width: getInputWidth(expectedAnswers[0]) }}
											className="mx-2 max-w-full border-b-2 border-blue-500 bg-transparent px-2 py-1 text-center outline-none"
										/>{" "}
										{task.sentenceAfter}
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
												disabled={isUsed}
												className="rounded-lg border border-slate-700 bg-slate-950/60 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-violet-500 hover:bg-violet-500/10 disabled:cursor-not-allowed disabled:opacity-35"
											>
												{choice}
											</button>
										);
									})}
								</div>
							)}
						</div>

						{result === "correct" && (
							<div className="mt-5 rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-green-400">
								✅ Chính xác!
							</div>
						)}

						{result === "wrong" && (
							<div className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-400">
								❌ Chưa đúng. Thử lại nhé.
							</div>
						)}

						<div className="mt-8 flex items-start justify-between gap-4">
							{result && <GrammarNote grammar={task.grammar} />}
							<div className="ml-auto shrink-0">
								{result === "correct" ? (
									<Link
									href={
										nextTask
										? `/dialogue/${lessonId}/${dialogueId}/${nextTask.id}`
											: completionHref || `/dialogue/${lessonId}`
									}
									className="rounded-xl bg-green-600 px-6 py-3 font-semibold"
								>
									{nextTask ? "Tiếp tục →" : "Hoàn thành hội thoại ✓"}
									</Link>
								) : (
									<button
									type="button"
									onClick={checkAnswer}
									disabled={answerValues.some((answer) => !answer.trim())}
									className="rounded-xl bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
								>
									Kiểm tra
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
