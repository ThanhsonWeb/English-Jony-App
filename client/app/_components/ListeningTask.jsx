import Link from "next/link";

function ListeningTask({ task, lessonId, nextTask }) {
	return (
		<div className="min-h-screen px-4 py-8 text-white sm:px-8">
			<div className="mx-auto max-w-3xl">
				<Link
					href={`/dialogue/${lessonId}`}
					className="text-slate-400 hover:text-white"
				>
					← Quay lại
				</Link>

				<h1 className="mt-8 text-2xl font-bold">{task.title}</h1>

				<p className="mt-2 text-slate-400">{task.description}</p>

				<div className="mt-8 space-y-4">
					{task.dialogue.map((line, index) => (
						<div
							key={index}
							className="rounded-xl border border-slate-800 bg-slate-900/50 p-4"
						>
							<p className="font-semibold text-blue-400">{line.speaker}</p>

							<p className="mt-1 text-slate-200">{line.text}</p>
						</div>
					))}
				</div>

				<div className="mt-8 flex justify-end">
					<Link
						href={`/dialogue/${lessonId}/${nextTask.id}`}
						className="rounded-xl bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-500"
					>
						Tiếp tục →
					</Link>
				</div>
			</div>
		</div>
	);
}

export default ListeningTask;
