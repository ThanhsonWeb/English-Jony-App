"use client";

import Image from "next/image";
import {
	CHARACTER_IMAGE_SIZES,
	DIALOGUE_IMAGE_QUALITY,
	SCENE_IMAGE_SIZES,
	preloadDialogueImage,
} from "@/app/_lib/dialogue/preloadImages";
import { Captions, ChevronDown, Languages, Pause, Play } from "lucide-react";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import useDialoguePlaybackRate from "@/app/_hooks/useDialoguePlaybackRate";
import { createTaskAudioPlayback } from "@/app/_lib/dialogue/taskAudioPlayback.mjs";
import { useAuth } from "@/app/_contexts/AuthContext";
import { findLessonLookup } from "@/app/_lib/dictionary/findLessonLookup";
import DialogueWordPopup from "./DialogueWordPopup";
import renderSubtitleTokens from "./renderSubtitleTokens";
import {
	PLAYBACK_RATES,
	saveDialoguePlaybackRate,
} from "@/app/_lib/dialogue/playbackRate.mjs";

const TaskAudioScene = forwardRef(function TaskAudioScene({ task, autoPlay = false, lessonId, dialogueId, dialogueLine }, ref) {
	const t = useTranslations("DialogueFeature");
	const { user } = useAuth();
	const userId = user?._id || user?.id || null;
	const audioRef = useRef(null);
	const playbackRef = useRef(null);
	const startSpeakingRef = useRef(null);
	const dictionaryPopupRef = useRef(null);

	const [isPlaying, setIsPlaying] = useState(false);
	const [showCaptions, setShowCaptions] = useState(false);
	const [selectedLookup, setSelectedLookup] = useState(null);
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

		void preloadDialogueImage(eyesClosed, CHARACTER_IMAGE_SIZES);
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

		const delay = showCharacter ? 0 : 450;
		setShowCharacter(true);

		if (audio.ended || audio.currentTime >= audio.duration) {
			audio.currentTime = 0;
		}

		audio.playbackRate = playbackRateRef.current;
		setIsAudioFinished(false);
		setShowFinishedCaptionBackground(false);

		await playbackRef.current?.play(delay);
	}

	async function toggleAudio() {
		const audio = audioRef.current;
		if (!audio) return;

		if (audio.paused) {
			await startSpeaking();
		} else {
			playbackRef.current?.pause();
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

		await playbackRef.current?.play();
	}

	useEffect(() => { startSpeakingRef.current = startSpeaking; });
	useEffect(() => {
		const audio = audioRef.current;
		if (!audio) return;
		const playback = createTaskAudioPlayback(audio, () => playbackRateRef.current, () => setIsPlaying(false));
		playbackRef.current = playback;
		// Defer one tick so Strict Mode cleanup can cancel its first setup.
		const timer = autoPlay ? window.setTimeout(() => startSpeakingRef.current?.(), 0) : null;
		return () => {
			window.clearTimeout(timer);
			playback.dispose();
			if (playbackRef.current === playback) playbackRef.current = null;
		};
	}, [autoPlay, task.id, task.audioUrl]);

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
			if (showCaptions) setSelectedLookup(null);
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

	useEffect(() => {
		if (!showSubtitleText || !selectedLookup) return;
		function dismiss(event) {
			if (dictionaryPopupRef.current?.contains(event.target) ||
				event.target.closest?.('[data-dictionary-token="true"]')) return;
			setSelectedLookup(null);
		}
		function dismissOnEscape(event) {
			if (event.key === "Escape") setSelectedLookup(null);
		}
		document.addEventListener("pointerdown", dismiss);
		document.addEventListener("keydown", dismissOnEscape);
		window.addEventListener("resize", dismissOnEscape);
		window.addEventListener("scroll", dismissOnEscape, true);
		return () => {
			document.removeEventListener("pointerdown", dismiss);
			document.removeEventListener("keydown", dismissOnEscape);
			window.removeEventListener("resize", dismissOnEscape);
			window.removeEventListener("scroll", dismissOnEscape, true);
		};
	}, [selectedLookup, showSubtitleText]);

	function handleSubtitleWordClick(clickedWordIndex, event) {
		const line = dialogueLine?.text === task.transcript
			? dialogueLine : { text: task.transcript };
		const lookup = findLessonLookup({ lessonId, dialogueId, line, clickedWordIndex });
		if (!lookup) { setSelectedLookup(null); return; }
		const bounds = event.currentTarget.getBoundingClientRect();
		const popupWidth = 256;
		setSelectedLookup({ ...lookup, phraseLookup: lookup.wordLookup ? lookup : null,
			isMobile: window.innerWidth < 640,
			position: {
				left: Math.min(Math.max(bounds.left + bounds.width / 2 - popupWidth / 2, 12), window.innerWidth - popupWidth - 12),
				top: bounds.top >= 180 ? bounds.top - 10 : bounds.bottom + 10,
				opensAbove: bounds.top >= 180,
			},
		});
	}

	function pronounceLookup() {
		if (!selectedLookup || !("speechSynthesis" in window)) return;
		window.speechSynthesis.cancel();
		const utterance = new SpeechSynthesisUtterance(selectedLookup.result.text);
		utterance.lang = "en-US";
		utterance.rate = 0.9;
		window.speechSynthesis.speak(utterance);
	}

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
							quality={DIALOGUE_IMAGE_QUALITY}
							className="object-cover"
							sizes={SCENE_IMAGE_SIZES}
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
								quality={DIALOGUE_IMAGE_QUALITY}
								className="object-contain object-bottom"
								sizes={CHARACTER_IMAGE_SIZES}
							/>

							{/* Closed-eye overlay */}
							{canBlink && isBlinking && (
								<Image
									src={eyesClosed}
									alt=""
									fill
									aria-hidden="true"
									quality={DIALOGUE_IMAGE_QUALITY}
									className="pointer-events-none object-contain object-bottom"
									sizes={CHARACTER_IMAGE_SIZES}
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
									{lessonId && dialogueId && task.transcript
										? renderSubtitleTokens(task.transcript, handleSubtitleWordClick, selectedLookup)
										: task.transcript}
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
							setSelectedLookup(null);
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
			<DialogueWordPopup lookup={showSubtitleText ? selectedLookup : null}
				popupRef={dictionaryPopupRef} onPronounce={pronounceLookup}
				onSwitch={(switchTo) => setSelectedLookup((current) => ({ ...current, ...switchTo }))} />
		</div>
	);
});

TaskAudioScene.displayName = "TaskAudioScene";

export default TaskAudioScene;
