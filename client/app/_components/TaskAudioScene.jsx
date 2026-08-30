"use client";

import Image from "next/image";
import { Captions, ChevronDown, Languages, Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";

function TaskAudioScene({ task }) {
	const audioRef = useRef(null);

	const [isPlaying, setIsPlaying] = useState(false);
	const [showCaptions, setShowCaptions] = useState(false);
	const [isBlinking, setIsBlinking] = useState(false);
	const [showCharacter, setShowCharacter] = useState(false);
	const [playbackRate, setPlaybackRate] = useState(1);
	const [showSpeedMenu, setShowSpeedMenu] = useState(false);
	const [showTranslation, setShowTranslation] = useState(false);
	const playbackRateRef = useRef(1);

	const characterImage = task.character?.image;

	const characterDirectory = characterImage
		? characterImage.slice(0, characterImage.lastIndexOf("/") + 1)
		: "";

	const isMaria = task.character?.name?.toLowerCase() === "maria";

	const eyesClosed = `${characterDirectory}eyes-closed.png`;

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

		if (!showCharacter) {
			setShowCharacter(true);

			await new Promise((resolve) => {
				window.setTimeout(resolve, 450);
			});
		}

		if (audio.ended || audio.currentTime >= audio.duration) {
			audio.currentTime = 0;
		}

		audio.playbackRate = playbackRateRef.current;

		try {
			await audio.play();
		} catch {
			setIsPlaying(false);
		}
	}

	async function toggleAudio() {
		const audio = audioRef.current;
		if (!audio) return;

		if (audio.paused) {
			await startSpeaking();
		} else {
			audio.pause();
		}
	}

	function handlePlaybackRateChange(newRate) {
		setPlaybackRate(newRate);
		playbackRateRef.current = newRate;
		setShowSpeedMenu(false);

		if (audioRef.current) {
			audioRef.current.playbackRate = newRate;
		}
	}

	function handleTranslate() {
		if (!task.translation) return;

		setShowTranslation((current) => !current);
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

							{showTranslation && task.translation && (
								<p className="mt-2 text-sm text-slate-300">
									{task.translation}
								</p>
							)}
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
						setShowCharacter(false);
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

						<div className="relative">
							<button
								type="button"
								onClick={() => setShowSpeedMenu((current) => !current)}
								aria-label={`Chọn tốc độ phát, hiện tại ${playbackRate}x`}
								aria-expanded={showSpeedMenu}
								title="Tốc độ phát"
								className="flex h-9 min-w-14 items-center justify-center gap-1 rounded-full px-2 text-xs font-semibold text-slate-400 transition hover:bg-white/10 hover:text-white"
							>
								{playbackRate}x
								<ChevronDown
									size={14}
									className={`transition-transform ${
										showSpeedMenu ? "rotate-180" : ""
									}`}
								/>
							</button>

							{showSpeedMenu && (
								<div className="absolute bottom-full left-1/2 z-30 mb-2 w-20 -translate-x-1/2 overflow-hidden rounded-lg border border-slate-700 bg-slate-900 py-1 shadow-xl">
									{[0.5, 0.75, 1, 1.25, 1.5].map((rate) => (
										<button
											key={rate}
											type="button"
											onClick={() => handlePlaybackRateChange(rate)}
											className={`block w-full px-3 py-2 text-center text-xs font-semibold transition hover:bg-white/10 ${
												playbackRate === rate
													? "text-violet-400"
													: "text-slate-300"
											}`}
										>
											{rate}x
										</button>
									))}
								</div>
							)}
						</div>
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
