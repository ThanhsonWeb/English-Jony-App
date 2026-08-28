"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import TaskAudioScene from "./TaskAudioScene";

function FillBlankTask({
	task,
	lessonId,
	dialogueId,
	nextTask,
	onComplete,
}) {
	const [answer, setAnswer] = useState("");
	const [result, setResult] = useState(null);

	useEffect(() => {
		setAnswer("");
		setResult(null);
	}, [task.id]);

	function checkAnswer() {
		const isCorrect =
			answer.trim().toLowerCase() === task.answer.trim().toLowerCase();

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

				<p className="mt-8 text-sm text-slate-500">Bài {task.id}</p>

				<h1 className="mt-2 text-2xl font-bold">{task.title} ✍️</h1>

				<p className="mt-2 text-slate-400">
					{task.instruction || "Nghe và điền từ đúng vào câu bên dưới."}
				</p>

				<TaskAudioScene task={task} />

				<div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
					<p className="text-lg leading-10">
						{task.sentenceBefore}{" "}
						<input
							value={answer}
							onChange={(event) => {
								setAnswer(event.target.value);
								setResult(null);
							}}
							onKeyDown={(event) => {
								if (event.key === "Enter" && answer.trim()) {
									checkAnswer();
								}
							}}
							placeholder="..."
							aria-label="Từ còn thiếu"
							className="mx-2 w-32 border-b-2 border-blue-500 bg-transparent px-2 py-1 text-center outline-none focus:border-blue-300"
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
						❌ Chưa đúng. Hãy nghe lại và thử lần nữa.
					</div>
				)}

				<div className="mt-8 flex justify-end">
					{result === "correct" ? (
						<Link
							href={
								nextTask
									? `/dialogue/${lessonId}/${dialogueId}/${nextTask.id}`
									: `/dialogue/${lessonId}`
							}
							className="rounded-xl bg-green-600 px-6 py-3 font-semibold transition hover:bg-green-500"
						>
							{nextTask ? "Tiếp tục →" : "Hoàn thành hội thoại ✓"}
						</Link>
					) : (
						<button
							type="button"
							onClick={checkAnswer}
							disabled={!answer.trim()}
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

export default FillBlankTask;