import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import TaskAudioScene from "./TaskAudioScene";
import TaskTip from "./TaskTip";

function ArrangeWordsTask({
	task,
	lessonId,
	dialogueId,
	nextTask,
	onComplete,
	totalTasks,
}) {
	const [availableWords, setAvailableWords] = useState(task.words);
	const [selectedWords, setSelectedWords] = useState([]);
	const [result, setResult] = useState(null);

	function selectWord(word, index) {
		setSelectedWords((previous) => [...previous, word]);
		setAvailableWords((previous) =>
			previous.filter((_, wordIndex) => wordIndex !== index),
		);
		setResult(null);
	}

	function removeWord(word, index) {
		setAvailableWords((previous) => [...previous, word]);
		setSelectedWords((previous) =>
			previous.filter((_, wordIndex) => wordIndex !== index),
		);
		setResult(null);
	}

	function checkAnswer() {
		const isCorrect = selectedWords.join(" ") === task.answer.join(" ");

		setResult(isCorrect ? "correct" : "wrong");
		if (isCorrect) onComplete?.();
	}

	function resetAnswer() {
		setAvailableWords(task.words);
		setSelectedWords([]);
		setResult(null);
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
				<h1 className="mt-2 text-2xl font-bold">{task.title} 🧩</h1>
				{result === "correct" && <TaskTip tip={task.tip} />}

				<div className="mt-8 grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
					<TaskAudioScene key={task.audioUrl} task={task} />

					<div>
						<p className="text-sm font-semibold text-violet-400">Câu hỏi</p>
						<p className="mt-2 text-slate-400">
							{task.instruction || "Chọn các từ theo đúng thứ tự."}
						</p>

						<div className="mt-6 min-h-24 rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 p-4">
							{selectedWords.length === 0 ? (
								<p className="text-sm text-slate-500">Chọn từ bên dưới...</p>
							) : (
								<div className="flex flex-wrap gap-2">
									{selectedWords.map((word, index) => (
										<button
											key={`${word}-${index}`}
											type="button"
											onClick={() => removeWord(word, index)}
											className="rounded-lg bg-blue-600 px-4 py-2 font-medium hover:bg-blue-500"
										>
											{word}
										</button>
									))}
								</div>
							)}
						</div>

						<div className="mt-6 flex flex-wrap gap-3">
							{availableWords.map((word, index) => (
								<button
									key={`${word}-${index}`}
									type="button"
									onClick={() => selectWord(word, index)}
									className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-slate-200 transition hover:border-blue-500 hover:text-white"
								>
									{word}
								</button>
							))}
						</div>

						{result === "correct" && (
							<div className="mt-6 rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-green-400">
								✅ Chính xác! {task.answer.join(" ")}.
							</div>
						)}

						{result === "wrong" && (
							<div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-400">
								❌ Chưa đúng. Thử lại nhé.
							</div>
						)}

						<div className="mt-8 flex items-center justify-between">
							<button
								type="button"
								onClick={resetAnswer}
								className="text-sm text-slate-400 hover:text-white"
							>
								Làm lại
							</button>

							{result === "correct" ? (
								<Link
									href={
										nextTask
											? `/dialogue/${lessonId}/${dialogueId}/${nextTask.id}`
											: `/dialogue/${lessonId}`
									}
									className="rounded-xl bg-green-600 px-6 py-3 font-semibold hover:bg-green-500"
								>
									{nextTask ? "Tiếp tục →" : "Hoàn thành hội thoại ✓"}
								</Link>
							) : (
								<button
									type="button"
									onClick={checkAnswer}
									disabled={selectedWords.length === 0}
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
	);
}

export default ArrangeWordsTask;
