"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Languages } from "lucide-react";

import {
	Play,
	Pause,
	ChevronDown,
	MessageSquareText,
	Captions,
} from "lucide-react";

const CHARACTER_ENTRY_DELAY = 700;
const DIALOGUE_LINE_DELAY = 300;
const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5];

export default function DialoguePlayer({
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
	const [playbackRate, setPlaybackRate] = useState(1);
	const [showSpeedMenu, setShowSpeedMenu] = useState(false);
	const [showSubtitles, setShowSubtitles] = useState(true);

	const audioRef = useRef(null);
	const playbackRateRef = useRef(1);
	const startTimeoutRef = useRef(null);
	const lineTimeoutRef = useRef(null);
	const pendingLineRef = useRef(null);

	const activeLine = task.dialogue[currentLine];
	const characters = Object.entries(task.characters || {});
	const characterCount = characters.length;

	function getCharacterPosition(characterIndex) {
		if (characterCount === 1) return "left-1/2 -translate-x-1/2";
		if (characterCount === 2) {
			return characterIndex === 0
				? "left-[10%] sm:left-[16%]"
				: "right-[10%] sm:right-[16%]";
		}

		if (characterIndex === 0) return "left-[2%] sm:left-[4%]";
		if (characterIndex === characterCount - 1) {
			return "right-[3%] sm:right-[6%]";
		}

		return characterIndex % 2 === 1
			? "left-[25%] sm:left-[28%]"
			: "right-[25%] sm:right-[28%]";
	}

	function isRightSideSpeaker(speaker) {
		const characterIndex = characters.findIndex(([name]) => name === speaker);

		return characterCount > 1 && characterIndex === characterCount - 1;
	}

	function getSpeakerColor(speaker) {
		const characterIndex = characters.findIndex(([name]) => name === speaker);
		const colors = [
			"text-violet-400",
			"text-emerald-400",
			"text-sky-400",
			"text-amber-400",
		];

		return colors[Math.max(characterIndex, 0) % colors.length];
	}

	function clearStartTimeout() {
		if (!startTimeoutRef.current) return;

		clearTimeout(startTimeoutRef.current);
		startTimeoutRef.current = null;
	}

	function clearLineTimeout() {
		if (!lineTimeoutRef.current) return;

		clearTimeout(lineTimeoutRef.current);
		lineTimeoutRef.current = null;
	}

	useEffect(() => {
		return () => {
			clearStartTimeout();
			clearLineTimeout();
		};
	}, []);

	// Play one dialogue line
	function playCurrentLine(index = currentLine) {
		const line = task.dialogue[index];

		if (!line?.audioUrl || !audioRef.current) return;

		const audio = audioRef.current;
		clearLineTimeout();
		pendingLineRef.current = null;

		setCurrentLine(index);

		audio.pause();
		audio.src = line.audioUrl;
		audio.currentTime = 0;
		audio.playbackRate = playbackRateRef.current;

		audio.play().catch((error) => {
			console.error("Audio play failed:", error);
			setIsPlaying(false);
		});
	}

	function startDialogueAfterCharacters(index = currentLine) {
		clearStartTimeout();
		clearLineTimeout();
		pendingLineRef.current = null;

		if (audioRef.current) {
			audioRef.current.pause();
		}

		setCurrentLine(index);
		setHasStarted(true);
		setDialogueFinished(false);

		startTimeoutRef.current = setTimeout(() => {
			startTimeoutRef.current = null;
			playCurrentLine(index);
		}, CHARACTER_ENTRY_DELAY);
	}

	// Play / pause
	function handlePlayPause() {
		const audio = audioRef.current;

		if (!audio) return;

		if (startTimeoutRef.current) {
			clearStartTimeout();
			return;
		}

		if (lineTimeoutRef.current) {
			clearLineTimeout();
			setIsPlaying(false);
			return;
		}

		// Currently playing → pause
		if (isPlaying) {
			audio.pause();
			return;
		}

		if (pendingLineRef.current !== null) {
			playCurrentLine(pendingLineRef.current);
			return;
		}

		// First start / restart after characters have left the scene
		if (!hasStarted || dialogueFinished) {
			startDialogueAfterCharacters(currentLine);
			return;
		}

		// Characters are already visible, so start immediately
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

	function handlePlaybackRateChange(newRate) {
		setPlaybackRate(newRate);
		playbackRateRef.current = newRate;
		setShowSpeedMenu(false);

		if (audioRef.current) {
			audioRef.current.playbackRate = newRate;
		}
	}

	function handleTranscriptClick(index) {
		if (!hasStarted || dialogueFinished || startTimeoutRef.current) {
			startDialogueAfterCharacters(index);
			return;
		}

		playCurrentLine(index);
	}

	// Automatically continue through each dialogue line.
	function handleEnded() {
		const nextIndex = currentLine + 1;

		// Continue to next dialogue line
		if (nextIndex < task.dialogue.length) {
			pendingLineRef.current = nextIndex;
			setCurrentLine(nextIndex);
			lineTimeoutRef.current = setTimeout(() => {
				lineTimeoutRef.current = null;
				playCurrentLine(nextIndex);
			}, DIALOGUE_LINE_DELAY);
			return;
		}

		// Whole dialogue finished
		setIsPlaying(false);
		setHasStarted(false);
		setDialogueFinished(true);
		setCurrentLine(0);
		pendingLineRef.current = null;

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
				{/* <Link
					href={`/dialogue/${lessonId}`}
					className="mb-8 inline-flex items-center gap-2 text-slate-400 hover:text-white"
				>
					<ArrowLeft size={18} />
					Quay lại
				</Link> */}

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
						style={
							task.scene
								? { backgroundImage: `url(${task.scene})` }
								: undefined
						}
					>
						{/* Small overlay */}
						<div className="absolute inset-0 bg-black/5" />

						{characters.map(([characterName, imageUrl], characterIndex) => {
							const isRightSide =
								characterCount > 1 && characterIndex === characterCount - 1;
							const isActive = activeLine?.speaker === characterName;
							const characterSize =
								characterCount > 2
									? isActive
										? "h-[300px] scale-105 brightness-110 sm:h-[360px]"
										: "h-[280px] scale-100 brightness-75 sm:h-[340px]"
									: isActive
										? "h-[350px] scale-105 brightness-110 sm:h-[420px]"
										: "h-[330px] scale-100 brightness-75 sm:h-[395px]";

							return (
								<Image
									key={characterName}
									src={imageUrl}
									alt={characterName}
									width={400}
									height={520}
									className={`absolute bottom-0 w-auto object-contain transition-all duration-700 ease-out ${getCharacterPosition(characterIndex)} ${
										hasStarted && !dialogueFinished
											? "translate-x-0 opacity-100"
											: isRightSide
												? "translate-x-24 opacity-0"
												: "-translate-x-24 opacity-0"
									} ${characterSize}`}
								/>
							);
						})}

						{/* Subtitle + controls */}
						<div className="absolute inset-x-0 bottom-0 z-20 bg-black/70 backdrop-blur-[2px]">
							{/* Subtitle - only visible while playing */}
							{hasStarted && showSubtitles && !dialogueFinished && (
								<div
									className={`px-8 pb-3 pt-4 sm:px-12 lg:px-16 ${
										isRightSideSpeaker(activeLine?.speaker)
											? "text-right"
											: "text-left"
									}`}
								>
									{/* Speaker */}
									<p
										className={`text-sm font-bold ${
											getSpeakerColor(activeLine?.speaker)
										}`}
									>
										{activeLine?.speaker}
									</p>

									{/* Sentence + translate */}
								<div
									className={`mt-1 flex items-start gap-2 ${
										isRightSideSpeaker(activeLine?.speaker)
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

								<div className="relative sm:hidden">
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

								<div
									className="hidden h-8 w-52 items-center rounded-lg bg-[#221d2d] p-1 sm:flex"
									aria-label="Tốc độ phát"
								>
									{PLAYBACK_RATES.map((rate) => (
										<button
											key={rate}
											type="button"
											onClick={() => handlePlaybackRateChange(rate)}
											aria-pressed={playbackRate === rate}
											className={`flex h-6 flex-1 items-center justify-center rounded-md text-xs font-medium transition ${
												playbackRate === rate
													? "bg-white text-slate-950 shadow-sm"
													: "text-slate-300 hover:bg-white/10 hover:text-white"
											}`}
										>
											{rate}x
										</button>
									))}
								</div>
							</div>

							<div className="flex items-center gap-3">
								<button
									type="button"
									onClick={() =>
										setShowSubtitles((current) => !current)
									}
									aria-label={showSubtitles ? "Tắt phụ đề" : "Bật phụ đề"}
									title={showSubtitles ? "Tắt phụ đề" : "Bật phụ đề"}
									className={`flex h-11 w-11 items-center justify-center rounded-full transition ${
										showSubtitles
											? "bg-violet-500/15 text-violet-400"
											: "text-slate-400 hover:bg-white/10 hover:text-white"
									}`}
								>
									<Captions size={26} />
								</button>

								<p className="text-xs text-slate-400">
									{currentLine + 1} / {task.dialogue.length}
								</p>
							</div>
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
									onClick={() => handleTranscriptClick(index)}
									className={`w-full rounded-lg p-3 transition ${
										isRightSideSpeaker(line.speaker)
											? "text-right"
											: "text-left"
									} ${
										index === currentLine
											? "bg-violet-500/10"
											: "hover:bg-slate-800/50"
									}`}
								>
									<p
										className={`text-sm font-semibold ${
											getSpeakerColor(line.speaker)
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
