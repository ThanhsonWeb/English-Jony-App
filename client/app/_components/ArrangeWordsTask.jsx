import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import DialogueShortcutHint from "./DialogueShortcutHint";
import GrammarNote from "./GrammarNote";
import TaskAudioScene from "./TaskAudioScene";
import useDialogueShortcuts from "../_hooks/useDialogueShortcuts";

function getAnswerText(answer) {
	return Array.isArray(answer) ? answer.join(" ") : String(answer || "");
}

function normalizeAnswer(answer) {
	return getAnswerText(answer)
		.toLowerCase()
		.replace(/[.,!?;:]/g, "")
		.replace(/\s+/g, " ")
		.trim();
}

function shuffleWords(words) {
	const shuffled = [...words];

	for (let index = shuffled.length - 1; index > 0; index -= 1) {
		const randomIndex = Math.floor(Math.random() * (index + 1));
		[shuffled[index], shuffled[randomIndex]] = [
			shuffled[randomIndex],
			shuffled[index],
		];
	}

	if (
		shuffled.length > 1 &&
		shuffled.every((word, index) => word === words[index])
	) {
		[shuffled[0], shuffled[1]] = [shuffled[1], shuffled[0]];
	}

	return shuffled;
}

function mixWordsForInitialRender(words) {
	const oddWords = words.filter((_, index) => index % 2 === 1);
	const evenWords = words.filter((_, index) => index % 2 === 0);
	const mixed = [...oddWords, ...evenWords];

	if (
		mixed.length > 1 &&
		mixed.every((word, index) => word === words[index])
	) {
		[mixed[0], mixed[1]] = [mixed[1], mixed[0]];
	}

	return mixed;
}

function ArrangeWordsTask({
	task,
	lessonId,
	dialogueId,
	nextTask,
	completionHref,
	onComplete,
	totalTasks,
}) {
	const [availableWords, setAvailableWords] = useState(() =>
		mixWordsForInitialRender(task.words || []),
	);
	const [selectedWords, setSelectedWords] = useState([]);
	const [result, setResult] = useState(null);
	const actionRef = useRef(null);
	const audioSceneRef = useRef(null);

	useDialogueShortcuts({
		onEnter: () => actionRef.current?.click(),
		onReplay: () => audioSceneRef.current?.replay(),
	});
	const hasMedia = Boolean(
		task.audioUrl || task.scene || task.character?.image,
	);
	const answerText = getAnswerText(task.answer);

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
		const isCorrect =
			normalizeAnswer(selectedWords) === normalizeAnswer(task.answer);

		setResult(isCorrect ? "correct" : "wrong");
		if (isCorrect) onComplete?.();
	}

	function resetAnswer() {
		setAvailableWords(shuffleWords(task.words || []));
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

				<div
					className={`mt-8 grid gap-8 lg:items-start ${
						hasMedia ? "lg:grid-cols-[0.8fr_1.2fr]" : ""
					}`}
				>
					{hasMedia && (
						<TaskAudioScene ref={audioSceneRef} key={task.audioUrl} task={task} />
					)}

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
								✅ Chính xác! {answerText}
							</div>
						)}

						{result === "wrong" && (
							<div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-400">
								❌ Chưa đúng. Thử lại nhé.
							</div>
						)}

						<DialogueShortcutHint />
						<div className="mt-4 flex items-start justify-between gap-4">
							<div className="flex items-start gap-4">
								<button
									type="button"
									onClick={resetAnswer}
									className="py-2 text-sm text-slate-400 hover:text-white"
								>
									Làm lại
								</button>
								{result && <GrammarNote grammar={task.grammar} />}
							</div>

							<div className="ml-auto shrink-0">
							{result === "correct" ? (
								<Link
									ref={actionRef}
									href={
										nextTask
										? `/dialogue/${lessonId}/${dialogueId}/${nextTask.id}`
											: completionHref || `/dialogue/${lessonId}`
									}
									className="rounded-xl bg-green-600 px-6 py-3 font-semibold hover:bg-green-500"
								>
									{nextTask ? "Tiếp tục →" : "Hoàn thành hội thoại ✓"}
								</Link>
							) : (
								<button
									ref={actionRef}
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
		</div>
	);
}

export default ArrangeWordsTask;
