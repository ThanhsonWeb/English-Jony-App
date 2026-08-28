import { ArrowLeft, CheckCircle2, Circle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import TaskAudioScene from "./TaskAudioScene";

function MultipleChoiceTask({
	task,
	lessonId,
	dialogueId,
	nextTask,
	onComplete,
}) {
	const [selected, setSelected] = useState("");
	const [result, setResult] = useState(null);

	function checkAnswer() {
		const isCorrect = selected === task.answer;

		setResult(isCorrect ? "correct" : "wrong");

		if (isCorrect) {
			onComplete?.();
		}
	}

	return (
		<div className="min-h-screen px-4 py-8 text-white sm:px-8">
			<div className="mx-auto max-w-3xl">
				<Link
					href={`/dialogue/${lessonId}`}
					className="inline-flex items-center gap-2 text-slate-400 transition hover:text-white"
				>
					<ArrowLeft size={18} />
					Quay lại
				</Link>

				<p className="mt-8 text-sm text-slate-500">
					Bài {task.id}
				</p>

				<h1 className="mt-2 text-2xl font-bold">
					{task.title}
				</h1>

				{/* Audio / character scene */}
				<TaskAudioScene task={task} />

				{/* Question */}
				<div className="mt-8">
					<p className="text-sm font-semibold text-violet-400">
						Câu hỏi
					</p>

					<h2 className="mt-2 text-lg font-semibold leading-relaxed text-white">
						{task.question}
					</h2>

					{/* Phrase from dialogue */}
					{task.context && (
						<div className="mt-4 rounded-xl border border-slate-800 bg-slate-900/60 px-5 py-4">
							<p className="text-sm text-slate-400">
								Trong đoạn hội thoại:
							</p>

							<p className="mt-2 text-lg font-medium text-white">
								“{task.context}”
							</p>
						</div>
					)}
				</div>

				{/* Answers */}
				<div className="mt-6 overflow-hidden rounded-xl border border-slate-800">
					{task.options.map((option) => {
						const isSelected = selected === option;
						const isCorrectAnswer =
							result === "correct" && option === task.answer;

						return (
							<button
								key={option}
								type="button"
								onClick={() => {
									setSelected(option);
									setResult(null);
								}}
								className={`flex w-full items-start gap-3 border-b border-slate-800 px-5 py-4 text-left transition last:border-b-0 ${
									isCorrectAnswer
										? "bg-emerald-500/10"
										: isSelected
											? "bg-violet-500/10"
											: "bg-slate-950/40 hover:bg-slate-900"
								}`}
							>
								{isSelected ? (
									<CheckCircle2
										size={20}
										className="mt-0.5 shrink-0 text-violet-400"
									/>
								) : (
									<Circle
										size={20}
										className="mt-0.5 shrink-0 text-slate-500"
									/>
								)}

								<span className="leading-relaxed">
									{option}
								</span>
							</button>
						);
					})}
				</div>

				{/* Feedback */}
				{result === "correct" && (
					<div className="mt-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5">
						<p className="font-semibold text-emerald-400">
							✓ Chính xác!
						</p>

						{task.explanation && (
							<p className="mt-2 leading-relaxed text-slate-300">
								{task.explanation}
							</p>
						)}
					</div>
				)}

				{result === "wrong" && (
					<div className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 p-5">
						<p className="font-semibold text-red-400">
							Chưa đúng.
						</p>

						<p className="mt-1 text-sm text-slate-300">
							Hãy nghe lại đoạn hội thoại và thử lại nhé.
						</p>
					</div>
				)}

				{/* Action */}
				<div className="mt-8 flex justify-end">
					{result === "correct" ? (
						<Link
							href={
								nextTask
									? `/dialogue/${lessonId}/${dialogueId}/${nextTask.id}`
									: `/dialogue/${lessonId}`
							}
							className="rounded-xl bg-emerald-600 px-6 py-3 font-semibold transition hover:bg-emerald-500"
						>
							{nextTask
								? "Tiếp tục →"
								: "Hoàn thành hội thoại ✓"}
						</Link>
					) : (
						<button
							type="button"
							onClick={checkAnswer}
							disabled={!selected}
							className="rounded-xl bg-violet-600 px-6 py-3 font-semibold transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
						>
							Kiểm tra
						</button>
					)}
				</div>
			</div>
		</div>
	);
}

export default MultipleChoiceTask;