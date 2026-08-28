"use client";

import Image from "next/image";
import { Captions, Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

function TaskAudioScene({ task }) {
	const audioRef = useRef(null);

	const [isPlaying, setIsPlaying] = useState(false);
	const [showCaptions, setShowCaptions] = useState(false);
	const [isBlinking, setIsBlinking] = useState(false);
	const [showCharacter, setShowCharacter] = useState(false);

	const characterImage = task.character?.image;

	const characterDirectory = characterImage
		? characterImage.slice(0, characterImage.lastIndexOf("/") + 1)
		: "";

	const isMaria = task.character?.name?.toLowerCase() === "maria";

	const eyesClosed = `${characterDirectory}eyes-closed.png`;
	// reset
	useEffect(() => {
		const audio = audioRef.current;

		if (audio) {
			audio.pause();
			audio.currentTime = 0;
		}

		setIsPlaying(false);
		setShowCharacter(false);
		setShowCaptions(false);
	}, [task.audioUrl]);

	// Preload blink image
	useEffect(() => {
		if (!isMaria) return;

		const image = new window.Image();
		image.src = eyesClosed;
	}, [isMaria, eyesClosed]);

	// Random blinking every 2.5–5.5 seconds
	useEffect(() => {
		if (!isMaria) return;

		let blinkTimer;
		let reopenTimer;

		function scheduleBlink() {
			const delay = 2500 + Math.random() * 3000;

			blinkTimer = window.setTimeout(() => {
				setIsBlinking(true);

				reopenTimer = window.setTimeout(() => {
					setIsBlinking(false);
					scheduleBlink();
				}, 130);
			}, delay);
		}

		scheduleBlink();

		return () => {
			window.clearTimeout(blinkTimer);
			window.clearTimeout(reopenTimer);
		};
	}, [isMaria, characterImage]);

	async function startSpeaking() {
		const audio = audioRef.current;
		if (!audio) return;

		setShowCharacter(true);

		await new Promise((resolve) => {
			window.setTimeout(resolve, 450);
		});

		try {
			await audio.play();
		} catch {
			setIsPlaying(false);
			setShowCharacter(false);
		}
	}

	async function toggleAudio() {
		const audio = audioRef.current;
		if (!audio) return;

		if (audio.paused) {
			await startSpeaking();
		} else {
			audio.pause();
			setShowCharacter(false);
		}
	}

	async function replayAudio() {
		const audio = audioRef.current;
		if (!audio) return;

		audio.pause();
		audio.currentTime = 0;

		setShowCharacter(false);

		window.setTimeout(() => {
			startSpeaking();
		}, 200);
	}

	return (
		<div>
			<div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950">
				{/* Scene */}
				<div className="relative aspect-[4/3] overflow-hidden">
					<Image
						src={task.scene}
						alt="Văn phòng"
						fill
						priority
						className="object-cover"
						sizes="(max-width: 768px) 100vw, 768px"
					/>

					{/* Character */}
					{characterImage && (
						<div
							className={`absolute bottom-0 left-1/2 z-10 h-[94%] w-[70%] -translate-x-1/2 transition-all duration-500 ease-out ${
								showCharacter
									? "translate-y-0 opacity-100"
									: "translate-y-8 opacity-0"
							}`}
						>
							{/* Original character */}
							<Image
								src={characterImage}
								alt={task.character.name}
								fill
								priority
								className="object-contain object-bottom"
								sizes="(max-width: 640px) 65vw, 400px"
							/>

							{/* Closed-eye overlay */}
							{isMaria && isBlinking && (
								<Image
									src={eyesClosed}
									alt=""
									fill
									aria-hidden="true"
									className="pointer-events-none object-contain object-bottom"
									sizes="(max-width: 640px) 65vw, 400px"
								/>
							)}
						</div>
					)}

					{/* Subtitle */}
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
					onEnded={() => {
						setIsPlaying(false);

						window.setTimeout(() => {
							setShowCharacter(false);
						}, 150);
					}}
				/>

				{/* Controls */}
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
		</div>
	);
}

export default TaskAudioScene;
