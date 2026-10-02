"use client";

import Image from "next/image";
import { Captions, ChevronDown, Languages, Pause, Play } from "lucide-react";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import useDialoguePlaybackRate from "@/app/_hooks/useDialoguePlaybackRate";
import { useAuth } from "@/app/_contexts/AuthContext";
import {
	PLAYBACK_RATES,
	saveDialoguePlaybackRate,
} from "@/app/_lib/dialogue/playbackRate.mjs";

const TaskAudioScene = forwardRef(function TaskAudioScene({ task }, ref) {
	const t = useTranslations("DialogueFeature");
	const { user } = useAuth();
	const userId = user?._id || user?.id || null;
	const audioRef = useRef(null);

	const [isPlaying, setIsPlaying] = useState(false);
	const [showCaptions, setShowCaptions] = useState(false);
	const [isBlinking, setIsBlinking] = useState(false);
	const [showCharacter, setShowCharacter] = useState(false);
	const playbackRate = useDialoguePlaybackRate();
	const [showSpeedMenu, setShowSpeedMenu] = useState(false);
	const [showTranslation, setShowTranslation] = useState(false);
	const [isAudioFinished, setIsAudioFinished] = useState(false);
	const [hasAudioStarted, setHasAudioStarted] = useState(false);
	const [showFinishedCaptionBackground, setShowFinishedCaptionBackground] =
		useState(false);
	const playbackRateRef = useRef(playbackRate);

	useEffect(() => {
		playbackRateRef.current = playbackRate;
		if (audioRef.current) audioRef.current.playbackRate = playbackRate;
	}, [playbackRate]);

	const characterImage = task.character?.image;
	const hasScene = Boolean(task.scene);
	const hasAudio = Boolean(task.audioUrl);

	const characterDirectory = characterImage
		? characterImage.slice(0, characterImage.lastIndexOf("/") + 1)
		: "";

	const isMaria = task.character?.name?.toLowerCase() === "maria";
	const canBlink = Boolean(isMaria && characterImage);
	const eyesClosed = canBlink
		? `${characterDirectory}eyes-closed.png`
		: null;

	// Preload blink image
	useEffect(() => {
		if (!canBlink) return;

		const image = new window.Image();
		image.src = eyesClosed;
	}, [canBlink, eyesClosed]);

	// Random blinking every 2.5–5.5 seconds
	useEffect(() => {
		if (!canBlink) return;

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
	}, [canBlink]);

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
		setIsAudioFinished(false);
		setShowFinishedCaptionBackground(false);

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

	async function replayAudio() {
		const audio = audioRef.current;
		if (!audio) return;

		audio.currentTime = 0;
		audio.playbackRate = playbackRateRef.current;
		setShowCharacter(true);
		setIsAudioFinished(false);
		setShowFinishedCaptionBackground(false);

		try {
			await audio.play();
		} catch {
			setIsPlaying(false);
		}
	}

	useImperativeHandle(ref, () => ({ replay: replayAudio }));

	function handlePlaybackRateChange(newRate) {
		saveDialoguePlaybackRate(newRate, window.localStorage, userId);
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

	function handleCaptionsClick() {
		if (!isAudioFinished) {
			setShowCaptions((current) => !current);
			return;
		}

		if (!showCaptions) {
			setShowCaptions(true);
			setShowFinishedCaptionBackground(true);
			return;
		}

		setShowFinishedCaptionBackground((current) => !current);
	}

	const showSubtitleBackground =
		showCaptions &&
		hasAudioStarted &&
		(!isAudioFinished || showFinishedCaptionBackground);
	const showSubtitleText =
		showCaptions && hasAudioStarted && !isAudioFinished;

	return (
		<div>
			<div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950">
				{/* Scene */}
				<div className="relative aspect-[4/3] overflow-hidden">
					{hasScene && (
						<Image
							src={task.scene}
							alt={t("sceneAlt", { character: task.character?.name || t("sceneCharacter") })}
							fill
							priority
							className="object-cover"
							sizes="(max-width: 768px) 100vw, 768px"
						/>
					)}

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
							{canBlink && isBlinking && (
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
					{showSubtitleBackground && (
						<div className="absolute inset-x-0 bottom-0 z-20 bg-black/55 px-4 py-3 text-center backdrop-blur-md sm:px-6">
							<div className={showSubtitleText ? "" : "invisible"}>
								<p className="dialogue-subtitle-speaker text-sm font-bold">
									{task.character?.name}
								</p>

								<p className="dialogue-subtitle-text mt-1 text-sm font-medium text-white sm:text-lg">
									{task.transcript}
								</p>

								{showTranslation && task.translation && (
									<p className="dialogue-subtitle-translation mt-2 text-sm">
										{task.translation}
									</p>
								)}
							</div>
						</div>
					)}
				</div>

				{hasAudio && (
					<audio
						ref={audioRef}
						src={task.audioUrl}
						preload="metadata"
						onLoadedMetadata={(event) => {
							event.currentTarget.playbackRate = playbackRateRef.current;
						}}
						onPlay={() => {
							setIsPlaying(true);
							setHasAudioStarted(true);
							setIsAudioFinished(false);
						}}
						onPause={() => setIsPlaying(false)}
						onEnded={() => {
							setIsPlaying(false);
							setIsAudioFinished(true);
							setShowFinishedCaptionBackground(false);
							setShowCharacter(false);
						}}
					/>
				)}

				{/* Controls */}
				<div className="flex items-center justify-between bg-slate-950 px-4 py-3">
					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={toggleAudio}
							aria-label={isPlaying ? t("pause") : t("play")}
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
							aria-label={t("translateSentence")}
							title={t("translateSentence")}
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
								aria-label={t("choosePlaybackSpeed", { rate: playbackRate })}
								aria-expanded={showSpeedMenu}
								title={t("playbackSpeed")}
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
									{PLAYBACK_RATES.map((rate) => (
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
						onClick={handleCaptionsClick}
						aria-label={t("toggleSubtitles")}
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
});

TaskAudioScene.displayName = "TaskAudioScene";

export default TaskAudioScene;
