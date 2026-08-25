"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";

export default function DialogueTaskPage() {
	const { taskId } = useParams();

	if (taskId === "1") {
		return <ListeningTask />;
	}

	if (taskId === "2") {
		return <FillBlankTask />;
	}

	return (
		<div className="min-h-screen p-8 text-white">
			Task {taskId}
		</div>
	);
}

function ListeningTask() {
	return (
		<div className="min-h-screen px-4 py-8 text-white sm:px-8">
			<div className="mx-auto max-w-3xl">
				<Link
					href="/dialogue/office-introduction"
					className="text-slate-400 hover:text-white"
				>
					← Quay lại
				</Link>

				<h1 className="mt-8 text-2xl font-bold">
					Nghe đoạn hội thoại 🎧
				</h1>

				<div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-6">
					<p className="text-blue-400">Maria</p>
					<p>Hello. You're the new graphic designer, right?</p>

					<p className="mt-5 text-green-400">Tom</p>
					<p>Yes, that's right. My name is Tom.</p>
				</div>

				<div className="mt-8 flex justify-end">
					<Link
						href="/dialogue/office-introduction/2"
						className="rounded-xl bg-blue-600 px-6 py-3 font-semibold"
					>
						Tiếp tục →
					</Link>
				</div>
			</div>
		</div>
	);
}

function FillBlankTask() {
	const [answer, setAnswer] = useState("");
	const [result, setResult] = useState(null);

	function checkAnswer() {
		if (answer.trim().toLowerCase() === "you're") {
			setResult("correct");
		} else {
			setResult("wrong");
		}
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

				<p className="mt-8 text-sm text-slate-500">
					Bài 2 / 33
				</p>

				<h1 className="mt-2 text-2xl font-bold">
					Điền từ còn thiếu ✍️
				</h1>

				<p className="mt-2 text-slate-400">
					Điền từ đúng vào câu bên dưới.
				</p>

				<div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
					<p className="text-lg">
						Hello.{" "}
						<input
							value={answer}
							onChange={(e) => {
								setAnswer(e.target.value);
								setResult(null);
							}}
							placeholder="..."
							className="mx-2 w-32 border-b-2 border-blue-500 bg-transparent px-2 py-1 text-center outline-none"
						/>
						the new graphic designer, right?
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
							className="rounded-xl bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-500"
						>
							Kiểm tra
						</button>
					)}
				</div>
			</div>
		</div>
	);
}