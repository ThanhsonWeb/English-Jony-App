"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Languages } from "lucide-react";

import {
	Play,
	Pause,
	RotateCcw,
	ChevronDown,
	MessageSquareText,
	ArrowLeft,
} from "lucide-react";

export default function ListeningTask({
	task,
	lessonId,
	dialogueId,
	nextTask,
	onComplete,
}) {
	const [currentLine, setCurrentLine] = useState(0);
	const [isPlaying, setIsPlaying] = useState(false);
	const [showTranslation, setShowTranslation] = useState(false);
	const [translation, setTranslation] = useState("");
	const [isTranscriptOpen, setIsTranscriptOpen] = useState(false);
	const [hasWatched, setHasWatched] = useState(false);
	const [hasStarted, setHasStarted] = useState(false);
	const [dialogueFinished, setDialogueFinished] = useState(false);

	const audioRef = useRef(null);

	const activeLine = task.dialogue[currentLine];

	// Play one dialogue line
	function playCurrentLine(index = currentLine) {
		const line = task.dialogue[index];

		if (!line?.audioUrl || !audioRef.current) return;

		const audio = audioRef.current;

		setCurrentLine(index);

		audio.pause();
		audio.src = line.audioUrl;
		audio.currentTime = 0;

		audio.play().catch((error) => {
			console.error("Audio play failed:", error);
			setIsPlaying(false);
		});
	}

	// Play / pause
	function handlePlayPause() {
		const audio = audioRef.current;

		if (!audio) return;

		if (!hasStarted) {
			setHasStarted(true);
			setDialogueFinished(false);
		}

		// Currently playing → pause
		if (isPlaying) {
			audio.pause();
			return;
		}

		// First time / dialogue finished
		if (!audio.src) {
			setDialogueFinished(false);
			playCurrentLine(currentLine);
			return;
		}

		// Current line finished
		if (audio.ended) {
			setDialogueFinished(false);
			playCurrentLine(currentLine);
			return;
		}

		audio.play().catch((error) => {
			console.error("Audio resume failed:", error);
		});
	}

	// Restart whole conversation
	function handleRestart() {
		if (!audioRef.current) return;

		audioRef.current.pause();
		setDialogueFinished(false);
		setHasStarted(true);
		setCurrentLine(0);

		playCurrentLine(0);
	}

	// Automatically go Maria → Tom → Maria...
	function handleEnded() {
		const nextIndex = currentLine + 1;

		// Continue to next dialogue line
		if (nextIndex < task.dialogue.length) {
			playCurrentLine(nextIndex);
			return;
		}

		// Whole dialogue finished
		setIsPlaying(false);
		setHasStarted(false);
		setDialogueFinished(true);
		setCurrentLine(0);

		if (audioRef.current) {
			audioRef.current.removeAttribute("src");
			audioRef.current.load();
		}
	}

	const handleTranslate = async () => {
		if (showTranslation) {
			setShowTranslation(false);
			return;
		}

		// later call your translation API here
		setTranslation("Đừng lo. Mọi người ở đây rất thân thiện.");
		setShowTranslation(true);
	};

	return (
		<div className="min-h-screen px-4 py-8 text-white sm:px-8">
			<div className="mx-auto max-w-4xl">
				<Link
					href={`/dialogue/${lessonId}`}
					className="mb-8 inline-flex items-center gap-2 text-slate-400 hover:text-white"
				>
					<ArrowLeft size={18} />
					Quay lại
				</Link>

				{/* Header */}
				<div>
					<p className="text-sm font-medium text-violet-400">Hội thoại</p>

					<h1 className="mt-2 text-2xl font-bold sm:text-3xl">
						{task.title} 🎧
					</h1>

					<p className="mt-2 text-slate-400">{task.description}</p>
				</div>

				{/* Player */}
				<div className="mt-8 overflow-hidden rounded-2xl border border-slate-800 bg-[#0b1020] shadow-xl">
					{/* Scene */}
					<div
						className="relative h-[390px] bg-cover bg-center sm:h-[460px]"
						style={{
							backgroundImage: `url(${task.scene})`,
						}}
					>
						{/* Small overlay */}
						<div className="absolute inset-0 bg-black/5" />

						{/* Maria */}

						<Image
							src={task.characters.Maria}
							alt="Maria"
							width={400}
							height={520}
							className={`absolute bottom-0 left-[10%] w-auto object-contain
    transition-all duration-700 ease-out sm:left-[16%]

    ${
			hasStarted && !dialogueFinished
				? "translate-x-0 opacity-100"
				: "-translate-x-24 opacity-0"
		}

    ${
			activeLine?.speaker === "Maria"
				? "h-[350px] scale-105 sm:h-[420px]"
				: "h-[330px] scale-100 brightness-75 sm:h-[395px]"
		}
  `}
						/>
						{/* Tom */}
						<Image
							src={task.characters.Tom}
							alt="Tom"
							width={400}
							height={520}
							className={`absolute bottom-0 right-[10%] w-auto object-contain
    transition-all duration-700 ease-out sm:right-[16%]

    ${
			hasStarted && !dialogueFinished
				? "translate-x-0 opacity-100"
				: "translate-x-24 opacity-0"
		}

    ${
			activeLine?.speaker === "Tom"
				? "h-[350px] scale-105 sm:h-[420px]"
				: "h-[330px] scale-100 brightness-75 sm:h-[395px]"
		}
  `}
						/>

						{/* Subtitle + controls */}
						<div className="absolute inset-x-0 bottom-0 z-20 bg-black/70 backdrop-blur-[2px]">
							{/* Subtitle - only visible while playing */}
							{hasStarted && (
								<div
									className={`px-5 pb-3 pt-4 sm:px-6 ${
										activeLine?.speaker === "Tom" ? "text-right" : "text-left"
									}`}
								>
									{/* Speaker */}
									<p
										className={`text-sm font-bold ${
											activeLine?.speaker === "Maria"
												? "text-violet-400"
												: "text-emerald-400"
										}`}
									>
										{activeLine?.speaker}
									</p>

									{/* Sentence + translate */}
									<div
										className={`mt-1 flex items-start gap-2 ${
											activeLine?.speaker === "Tom"
												? "justify-end"
												: "justify-start"
										}`}
									>
										<p className="max-w-2xl text-base font-medium leading-relaxed text-white sm:text-lg">
											{activeLine?.text}
										</p>
									</div>

									{/* Translation */}
									{showTranslation && activeLine?.translation && (
										<p className="mt-2 text-sm text-slate-300">
											{activeLine.translation}
										</p>
									)}
								</div>
							)}

							{/* Controls */}
							<div className="flex items-center justify-between border-t border-white/10 bg-[#050812]/90 px-4 py-2 sm:px-5">
								<div className="flex items-center gap-2">
									{/* Play */}
									<button
										type="button"
										onClick={handlePlayPause}
										aria-label={isPlaying ? "Tạm dừng" : "Phát"}
										className="relative z-30 flex h-12 w-12 items-center justify-center rounded-full border border-slate-700 bg-[#111827] text-slate-100 shadow-md transition hover:border-violet-500/50 hover:bg-[#1a2235] hover:text-violet-300 active:scale-95 cursor-pointer "
									>
										{isPlaying ? (
											<Pause size={18} fill="currentColor" />
										) : (
											<Play size={18} fill="currentColor" className="ml-0.5" />
										)}
									</button>

									{/* Restart */}
									<button
										type="button"
										onClick={handleRestart}
										title="Phát lại từ đầu"
										className="flex h-10 w-10 items-center justify-center rounded-full text-slate-400 transition hover:bg-white/10 hover:text-white cursor-pointer"
									>
										<RotateCcw size={20} />
									</button>

									<button
										type="button"
										onClick={handleTranslate}
										aria-label="Dịch câu"
										title="Dịch câu"
										className={`flex h-9 w-9 items-center justify-center rounded-full transition ${
											showTranslation
												? "bg-violet-500/15 text-violet-400"
												: "text-slate-400 hover:bg-white/10 hover:text-white"
										}`}
									>
										<Languages size={16} />
									</button>
								</div>

								<p className="text-xs text-slate-400">
									{currentLine + 1} / {task.dialogue.length}
								</p>
							</div>
						</div>
					</div>
				</div>

				{/* IMPORTANT: actual audio player */}
				<audio
					ref={audioRef}
					preload="auto"
					onEnded={handleEnded}
					onPlay={() => setIsPlaying(true)}
					onPause={() => setIsPlaying(false)}
				/>

				{/* Transcript */}
				<div className="mt-5 overflow-hidden rounded-xl border border-slate-800 bg-slate-900/40">
					<button
						type="button"
						onClick={() => setIsTranscriptOpen((current) => !current)}
						className="flex w-full items-center justify-between px-5 py-4 text-left transition hover:bg-slate-800/40"
					>
						<div className="flex items-center gap-2">
							<MessageSquareText size={18} className="text-violet-400" />

							<span className="font-semibold">Transcript</span>
						</div>

						<ChevronDown
							size={18}
							className={`text-slate-500 transition-transform duration-200 ${
								isTranscriptOpen ? "rotate-180" : ""
							}`}
						/>
					</button>

					{isTranscriptOpen && (
						<div className="space-y-1 border-t border-slate-800 p-3">
							{task.dialogue.map((line, index) => (
								<button
									key={index}
									type="button"
									onClick={() => playCurrentLine(index)}
									className={`w-full rounded-lg p-3 transition ${
										line.speaker === "Tom" ? "text-right" : "text-left"
									} ${
										index === currentLine
											? "bg-violet-500/10"
											: "hover:bg-slate-800/50"
									}`}
								>
									<p
										className={`text-sm font-semibold ${
											line.speaker === "Maria"
												? "text-violet-400"
												: "text-emerald-400"
										}`}
									>
										{line.speaker}
									</p>

									<p className="mt-1 text-sm leading-6 text-slate-300">
										{line.text}
									</p>
								</button>
							))}
						</div>
					)}
				</div>

				<button
					type="button"
					onClick={() =>
						setHasWatched((current) => {
							if (!current) onComplete?.();
							return !current;
						})
					}
					className={`mt-6 flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${
						hasWatched
							? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
							: "border-slate-800 bg-slate-900/40 text-slate-300 hover:border-slate-700"
					}`}
				>
					<div
						className={`flex h-5 w-5 items-center justify-center rounded border ${
							hasWatched
								? "border-emerald-500 bg-emerald-500 text-white"
								: "border-slate-600"
						}`}
					>
						{hasWatched && "✓"}
					</div>

					<span>Tôi đã xem xong đoạn hội thoại</span>
				</button>

				{/* Next */}
				{hasWatched && (
					<div className="mt-8 flex justify-end">
						<Link
							href={
								nextTask
									? `/dialogue/${lessonId}/${dialogueId}/${nextTask.id}`
									: `/dialogue/${lessonId}`
							}
							className="rounded-xl border border-violet-500/30 bg-violet-500/10 px-6 py-3 font-semibold text-violet-300 transition hover:border-violet-400/50 hover:bg-violet-500/20 hover:text-white active:scale-[0.98]"
						>
							{nextTask ? "Tiếp tục →" : "Hoàn thành hội thoại ✓"}
						</Link>
					</div>
				)}
			</div>
		</div>
	);
}
