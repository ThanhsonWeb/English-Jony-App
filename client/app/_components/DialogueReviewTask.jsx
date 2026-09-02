import { ArrowLeft } from "lucide-react";
import Link from "next/link";

function DialogueReviewTask({
	task,
	lessonId,
	dialogueId,
	nextTask,
	completionHref,
	onComplete,
}) {
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

				<h1 className="mt-2 text-2xl font-bold">{task.title} 📖</h1>

				<p className="mt-2 text-slate-400">
					Đọc lại toàn bộ đoạn hội thoại trước khi tiếp tục.
				</p>

				<div className="mt-8 space-y-4">
					{task.dialogue.map((line, index) => (
						<div
							key={index}
							className="rounded-xl border border-slate-800 bg-slate-900/50 p-4"
						>
							<p
								className={
									line.speaker === "Maria"
										? "font-semibold text-blue-400"
										: "font-semibold text-green-400"
								}
							>
								{line.speaker}
							</p>

							<p className="mt-1 text-slate-200">{line.text}</p>
						</div>
					))}
				</div>

				<div className="mt-8 flex justify-end">
					<Link
						href={
							nextTask
								? `/dialogue/${lessonId}/${dialogueId}/${nextTask.id}`
									: completionHref || `/dialogue/${lessonId}`
						}
						onClick={onComplete}
						className="rounded-xl bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-500"
					>
						{nextTask ? "Tiếp tục →" : "Hoàn thành hội thoại ✓"}
					</Link>
				</div>
			</div>
		</div>
	);
}

export default DialogueReviewTask;
