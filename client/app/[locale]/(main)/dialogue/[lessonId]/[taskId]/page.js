"use client";

import Link from "next/link";
import { lessonData } from "../../_data/lessonData";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";

export default function DialogueTaskPage() {
	const { taskId, lessonId } = useParams();
	const lesson = lessonData[lessonId];

	const task = lesson?.tasks.find((task) => task.id === taskId);

	if (!task) {
		return <div className="p-8 text-white">Không tìm thấy bài học.</div>;
	}

	switch (task.type) {
		case "listening":
			return <ListeningTask task={task} />;

		case "fillBlank":
			return <FillBlankTask task={task} />;

		case "multipleChoice":
			return <MultipleChoiceTask task={task} />;

		case "arrangeWords":
			return <ArrangeWordsTask task={task} />;

		case "review":
			return <DialogueReviewTask task={task} />;

		default:
			return null;
	}
}

function ListeningTask({ task }) {
	return (
		<div className="min-h-screen px-4 py-8 text-white sm:px-8">
			<div className="mx-auto max-w-3xl">
				<Link
					href="/dialogue/office-introduction"
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
						href="/dialogue/office-introduction/2"
						className="rounded-xl bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-500"
					>
						Tiếp tục →
					</Link>
				</div>
			</div>
		</div>
	);
}

function FillBlankTask({ task }) {
	const [answer, setAnswer] = useState("");
	const [result, setResult] = useState(null);

	function checkAnswer() {
		const isCorrect = answer.trim().toLowerCase() === task.answer.toLowerCase();

		setResult(isCorrect ? "correct" : "wrong");
	}

	return (
		<div className="min-h-screen px-4 py-8 text-white sm:px-8">
			<div className="mx-auto max-w-3xl">
				<Link
					href="/dialogue/office-introduction"
					className="inline-flex items-center gap-2 text-slate-400 hover:text-white"
				>
					<ArrowLeft size={18} />
					Quay lại
				</Link>

				<p className="mt-8 text-sm text-slate-500">Bài {task.id} / 33</p>

				<h1 className="mt-2 text-2xl font-bold">{task.title} ✍️</h1>

				<p className="mt-2 text-slate-400">Điền từ đúng vào câu bên dưới.</p>

				<div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
					<p className="text-lg">
						{task.sentenceBefore}{" "}
						<input
							value={answer}
							onChange={(e) => {
								setAnswer(e.target.value);
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

				<div className="mt-8 flex justify-end">
					{result === "correct" ? (
						<Link
							href="/dialogue/office-introduction/3"
							className="rounded-xl bg-green-600 px-6 py-3 font-semibold"
						>
							Tiếp tục →
						</Link>
					) : (
						<button
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
	);
}

function MultipleChoiceTask({ task }) {
	const [selected, setSelected] = useState("");
	const [result, setResult] = useState(null);

	function checkAnswer() {
		const isCorrect = selected === task.answer;

		setResult(isCorrect ? "correct" : "wrong");
	}

	return (
		<div className="min-h-screen px-4 py-8 text-white sm:px-8">
			<div className="mx-auto max-w-3xl">
				<Link
					href="/dialogue/office-introduction"
					className="inline-flex items-center gap-2 text-slate-400 hover:text-white"
				>
					<ArrowLeft size={18} />
					Quay lại
				</Link>

				<p className="mt-8 text-sm text-slate-500">Bài {task.id} / 33</p>

				<h1 className="mt-2 text-2xl font-bold">{task.title} 💬</h1>

				<p className="mt-2 text-slate-400">{task.question}</p>

				<div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
					<p className="text-blue-400">Maria</p>

					<p className="mt-2 text-lg">
						Hi, I'm Maria. I'm the product designer here.
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
							href="/dialogue/office-introduction/4"
							className="rounded-xl bg-green-600 px-6 py-3 font-semibold"
						>
							Tiếp tục →
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

function ArrangeWordsTask() {
	const correctAnswer = ["Nice", "to", "meet", "you"];

	const [availableWords, setAvailableWords] = useState([
		"you",
		"meet",
		"Nice",
		"to",
	]);

	const [selectedWords, setSelectedWords] = useState([]);
	const [result, setResult] = useState(null);

	function selectWord(word, index) {
		setSelectedWords((prev) => [...prev, word]);

		setAvailableWords((prev) => prev.filter((_, i) => i !== index));

		setResult(null);
	}

	function removeWord(word, index) {
		setAvailableWords((prev) => [...prev, word]);

		setSelectedWords((prev) => prev.filter((_, i) => i !== index));

		setResult(null);
	}

	function checkAnswer() {
		const isCorrect = selectedWords.join(" ") === correctAnswer.join(" ");

		setResult(isCorrect ? "correct" : "wrong");
	}

	function resetAnswer() {
		setAvailableWords(["you", "meet", "Nice", "to"]);
		setSelectedWords([]);
		setResult(null);
	}

	return (
		<div className="min-h-screen px-4 py-8 text-white sm:px-8">
			<div className="mx-auto max-w-3xl">
				<Link
					href="/dialogue/office-introduction"
					className="inline-flex items-center gap-2 text-slate-400 hover:text-white"
				>
					<ArrowLeft size={18} />
					Quay lại
				</Link>

				<p className="mt-8 text-sm text-slate-500">Bài 4 / 33</p>

				<h1 className="mt-2 text-2xl font-bold">Sắp xếp câu 🧩</h1>

				<p className="mt-2 text-slate-400">Chọn các từ theo đúng thứ tự.</p>

				{/* Context */}
				<div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
					<p className="font-medium text-blue-400">Maria</p>

					<p className="mt-2 text-lg">Hi, I'm Maria.</p>
				</div>

				{/* Answer area */}
				<div className="mt-6 min-h-24 rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 p-4">
					{selectedWords.length === 0 ? (
						<p className="text-sm text-slate-500">Chọn từ bên dưới...</p>
					) : (
						<div className="flex flex-wrap gap-2">
							{selectedWords.map((word, index) => (
								<button
									key={`${word}-${index}`}
									onClick={() => removeWord(word, index)}
									className="rounded-lg bg-blue-600 px-4 py-2 font-medium hover:bg-blue-500"
								>
									{word}
								</button>
							))}
						</div>
					)}
				</div>

				{/* Available words */}
				<div className="mt-6 flex flex-wrap gap-3">
					{availableWords.map((word, index) => (
						<button
							key={`${word}-${index}`}
							onClick={() => selectWord(word, index)}
							className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-slate-200 transition hover:border-blue-500 hover:text-white"
						>
							{word}
						</button>
					))}
				</div>

				{result === "correct" && (
					<div className="mt-6 rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-green-400">
						✅ Chính xác! Nice to meet you.
					</div>
				)}

				{result === "wrong" && (
					<div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-400">
						❌ Chưa đúng. Thử lại nhé.
					</div>
				)}

				<div className="mt-8 flex items-center justify-between">
					<button
						onClick={resetAnswer}
						className="text-sm text-slate-400 hover:text-white"
					>
						Làm lại
					</button>

					{result === "correct" ? (
						<Link
							href="/dialogue/office-introduction/5"
							className="rounded-xl bg-green-600 px-6 py-3 font-semibold hover:bg-green-500"
						>
							Tiếp tục →
						</Link>
					) : (
						<button
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
	);
}
function DialogueReviewTask() {
	const dialogue = [
		{
			speaker: "Maria",
			text: "Hello. You're the new graphic designer, right?",
		},
		{
			speaker: "Tom",
			text: "Yes, that's right. My name is Tom.",
		},
		{
			speaker: "Maria",
			text: "Nice to meet you, Tom. I'm Maria.",
		},
		{
			speaker: "Tom",
			text: "Nice to meet you too.",
		},
	];

	return (
		<div className="min-h-screen px-4 py-8 text-white sm:px-8">
			<div className="mx-auto max-w-3xl">
				<Link
					href="/dialogue/office-introduction"
					className="inline-flex items-center gap-2 text-slate-400 hover:text-white"
				>
					<ArrowLeft size={18} />
					Quay lại
				</Link>

				<p className="mt-8 text-sm text-slate-500">Bài 5 / 33</p>

				<h1 className="mt-2 text-2xl font-bold">Ôn lại hội thoại 📖</h1>

				<p className="mt-2 text-slate-400">
					Đọc lại toàn bộ đoạn hội thoại trước khi tiếp tục.
				</p>

				<div className="mt-8 space-y-4">
					{dialogue.map((line, index) => (
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
						href="/dialogue/office-introduction/6"
						className="rounded-xl bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-500"
					>
						Tiếp tục →
					</Link>
				</div>
			</div>
		</div>
	);
}
