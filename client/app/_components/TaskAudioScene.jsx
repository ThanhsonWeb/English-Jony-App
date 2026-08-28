"use client";

import Image from "next/image";
import {
	Captions,
	ChevronDown,
	ChevronRight,
	Pause,
	Play,
	RotateCcw,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

function TaskAudioScene({ task }) {
	const audioRef = useRef(null);

	const [isPlaying, setIsPlaying] = useState(false);
	const [showCaptions, setShowCaptions] = useState(true);
	const [showTranscript, setShowTranscript] = useState(false);

	useEffect(() => {
		const audio = audioRef.current;

		if (audio) {
			audio.pause();
			audio.currentTime = 0;
		}

		setIsPlaying(false);
		setShowCaptions(true);
		setShowTranscript(false);
	}, [task.audioUrl]);

	async function toggleAudio() {
		const audio = audioRef.current;
		if (!audio) return;

		if (audio.paused) {
			try {
				await audio.play();
				setIsPlaying(true);
			} catch {
				setIsPlaying(false);
			}
		} else {
			audio.pause();
			setIsPlaying(false);
		}
	}

	async function replayAudio() {
		const audio = audioRef.current;
		if (!audio) return;

		audio.currentTime = 0;

		try {
			await audio.play();
			setIsPlaying(true);
		} catch {
			setIsPlaying(false);
		}
	}

	return (
		<div className="mt-8">
			<div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950">
				{/* Scene */}
				<div className="relative aspect-video overflow-hidden">
					<Image
						src={task.scene}
						alt="Văn phòng"
						fill
						priority
						className="object-cover"
						sizes="(max-width: 768px) 100vw, 768px"
					/>

					{/* Centered character */}
					{task.character?.image && (
						<div className="absolute bottom-0 left-1/2 z-10 h-[94%] w-[65%] -translate-x-1/2 sm:w-[52%]">
							<Image
								src={task.character.image}
								alt={task.character.name}
								fill
								className="object-contain object-bottom"
								sizes="(max-width: 640px) 65vw, 400px"
							/>
						</div>
					)}

					{/* Subtitle overlay */}
					{showCaptions && (
						<div className="absolute inset-x-0 bottom-0 z-20 bg-slate-950/75 px-4 py-3 text-center backdrop-blur-sm sm:px-6">
							<p className="text-sm font-bold text-blue-300">
								{task.character?.name}
							</p>

							<p className="mt-1 text-sm font-medium text-white sm:text-lg">
								{task.transcript}
							</p>
						</div>
					)}
				</div>

				<audio
					ref={audioRef}
					src={task.audioUrl}
					preload="metadata"
					onPlay={() => setIsPlaying(true)}
					onPause={() => setIsPlaying(false)}
					onEnded={() => setIsPlaying(false)}
				/>

				{/* Player controls */}
				<div className="flex items-center justify-between bg-slate-950 px-4 py-3">
					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={toggleAudio}
							aria-label={isPlaying ? "Tạm dừng" : "Phát âm thanh"}
							className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-950 transition hover:bg-slate-200"
						>
							{isPlaying ? (
								<Pause size={18} fill="currentColor" />
							) : (
								<Play size={18} fill="currentColor" />
							)}
						</button>

						<button
							type="button"
							onClick={replayAudio}
							aria-label="Nghe lại"
							className="flex h-10 w-10 items-center justify-center rounded-full text-slate-400 transition hover:bg-white/10 hover:text-white"
						>
							<RotateCcw size={18} />
						</button>
					</div>

					<button
						type="button"
						onClick={() => setShowCaptions((current) => !current)}
						aria-label="Bật hoặc tắt phụ đề"
						aria-pressed={showCaptions}
						className={`flex h-9 w-11 items-center justify-center rounded-md transition ${
							showCaptions
								? "bg-white text-slate-950"
								: "bg-slate-800 text-slate-400 hover:text-white"
						}`}
					>
						<Captions size={21} />
					</button>
				</div>
			</div>

			{/* Transcript */}
			<button
				type="button"
				onClick={() => setShowTranscript((current) => !current)}
				className="mt-4 flex items-center gap-2 font-semibold text-slate-300 transition hover:text-white"
			>
				{showTranscript ? (
					<ChevronDown size={18} />
				) : (
					<ChevronRight size={18} />
				)}
				Transcript
			</button>

			{showTranscript && (
				<div className="mt-3 rounded-lg border border-slate-700 bg-slate-900/70 px-4 py-3 text-slate-200">
					<span className="font-bold text-blue-300">
						{task.character?.name}:
					</span>{" "}
					{task.transcript}
				</div>
			)}
		</div>
	);
}

export default TaskAudioScene;