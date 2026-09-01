import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import GrammarNote from "./GrammarNote";
import TaskAudioScene from "./TaskAudioScene";

function FillBlankTask({
	task,
	lessonId,
	dialogueId,
	nextTask,
	onComplete,
	totalTasks,
}) {
	const [answer, setAnswer] = useState("");
	const [result, setResult] = useState(null);

	function checkAnswer() {
		const isCorrect = answer.trim().toLowerCase() === task.answer.toLowerCase();

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
							<p className="text-lg">
								{task.sentenceBefore}{" "}
								<input
									value={answer}
									onChange={(event) => {
										setAnswer(event.target.value);
										setResult(null);
									}}
									placeholder="..."
									className="mx-2 w-32 border-b-2 border-blue-500 bg-transparent px-2 py-1 text-center outline-none"
								/>{" "}
								{task.sentenceAfter}
							</p>
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
											: `/dialogue/${lessonId}`
									}
									className="rounded-xl bg-green-600 px-6 py-3 font-semibold"
								>
									{nextTask ? "Tiếp tục →" : "Hoàn thành hội thoại ✓"}
									</Link>
								) : (
									<button
									type="button"
									onClick={checkAnswer}
									disabled={!answer.trim()}
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
