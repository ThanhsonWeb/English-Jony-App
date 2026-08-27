import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

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
		if (isCorrect) onComplete?.();
	}

	return (
		<div className="min-h-screen px-4 py-8 text-white sm:px-8">
			<div className="mx-auto max-w-3xl">
				<Link
					href={`/dialogue/${lessonId}`}
					className="inline-flex items-center gap-2 text-slate-400 hover:text-white"
				>
					<ArrowLeft size={18} />
					Quay lại
				</Link>

				<p className="mt-8 text-sm text-slate-500">Bài {task.id}</p>

				<h1 className="mt-2 text-2xl font-bold">{task.title} 💬</h1>

				<p className="mt-2 text-slate-400">{task.question}</p>

				<div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
					<p className="text-blue-400">Maria</p>

					<p className="mt-2 text-lg">
						Hi, I&apos;m Maria. I&apos;m the product designer here.
					</p>
				</div>

				<div className="mt-6 space-y-3">
					{task.options.map((option) => (
						<button
							key={option}
							onClick={() => {
								setSelected(option);
								setResult(null);
							}}
							className={`w-full rounded-xl border p-4 text-left transition ${
								selected === option
									? "border-blue-500 bg-blue-500/10"
									: "border-slate-800 bg-slate-900/50 hover:border-slate-700"
							}`}
						>
							{option}
						</button>
					))}
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

				<div className="mt-8 flex justify-end">
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
							onClick={checkAnswer}
							disabled={!selected}
							className="rounded-xl bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
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
