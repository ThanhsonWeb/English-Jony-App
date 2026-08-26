"use client";

import { useRef, useState } from "react";
import Link from "next/link";

export default function ListeningTask({ task, lessonId, nextTask }) {
	const [currentLine, setCurrentLine] = useState(0);
	const [isPlaying, setIsPlaying] = useState(false);

	const audioRef = useRef(null);

	function playCurrentLine(index = currentLine) {
		const line = task.dialogue[index];

		if (!line?.audioUrl) return;

		setCurrentLine(index);
		setIsPlaying(true);

		audioRef.current.src = line.audioUrl;
		audioRef.current.play();
	}

	function handleEnded() {
		const nextIndex = currentLine + 1;

		if (nextIndex < task.dialogue.length) {
			playCurrentLine(nextIndex);
		} else {
			setIsPlaying(false);
		}
	}

	return (
		<div className="min-h-screen px-4 py-8 text-white sm:px-8">
			<div className="mx-auto max-w-3xl">
				<h1 className="mt-8 text-2xl font-bold">{task.title} 🎧</h1>

				<p className="mt-2 text-slate-400">{task.description}</p>
				{/* image */}
				<div className="mt-8 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900">
					<div
						className="relative h-[420px] bg-cover bg-center"
						style={{ backgroundImage: `url(${task.scene})` }}
					>
						<img
							src={task.characters.Maria}
							alt="Maria"
							className="absolute bottom-0 left-10 h-[320px] object-contain"
						/>

						<img
							src={task.characters.Tom}
							alt="Tom"
							className="absolute bottom-0 right-10 h-[320px] object-contain"
						/>

						<div className="absolute inset-x-0 bottom-0 bg-black/55 p-4">
							<p className="text-sm font-semibold text-blue-400">
								{task.dialogue[currentLine]?.speaker}
							</p>

							<p className="mt-1 text-lg text-white">
								{task.dialogue[currentLine]?.text}
							</p>
						</div>
					</div>
				</div>

				{/* Audio */}
				<audio ref={audioRef} onEnded={handleEnded} />

				<div className="mt-8">
					<button
						onClick={() => playCurrentLine(0)}
						className="rounded-xl bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-500"
					>
						{isPlaying ? "Đang phát..." : "▶ Phát hội thoại"}
					</button>
				</div>

				{/* Dialogue */}
				<div className="mt-8 space-y-4">
					{task.dialogue.map((line, index) => (
						<div
							key={index}
							className={`rounded-xl border p-4 transition ${
								currentLine === index && isPlaying
									? "border-blue-500 bg-blue-500/10"
									: "border-slate-800 bg-slate-900/50"
							}`}
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

				{/* Next */}
				{nextTask && (
					<div className="mt-8 flex justify-end">
						<Link
							href={`/dialogue/${lessonId}/${nextTask.id}`}
							className="rounded-xl bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-500"
						>
							Tiếp tục →
						</Link>
					</div>
				)}
			</div>
		</div>
	);
}
