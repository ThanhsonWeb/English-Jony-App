"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Play, Square } from "lucide-react";
import { createTaskAudioPlayback } from "@/app/_lib/dialogue/taskAudioPlayback.mjs";
import styles from "./home.module.css";

export default function HomeAudioPreview({ urls }) {
	const t = useTranslations("Home");
	const audioRef = useRef(null);
	const playbackRef = useRef(null);
	const timerRef = useRef(null);
	const limitReachedRef = useRef(false);
	const indexRef = useRef(0);
	const [playing, setPlaying] = useState(false);
	const [error, setError] = useState(false);

	useEffect(() => {
		const audio = audioRef.current;
		const playback = createTaskAudioPlayback(audio, () => 1, () => {
			clearTimeout(timerRef.current);
			setPlaying(false);
			setError(true);
		});
		playbackRef.current = playback;
		return () => { clearTimeout(timerRef.current); playback.dispose(); };
	}, []);

	function stop() {
		clearTimeout(timerRef.current);
		playbackRef.current?.pause();
		setPlaying(false);
	}

	function start() {
		setError(false);
		indexRef.current = 0;
		limitReachedRef.current = false;
		audioRef.current.src = urls[0];
		setPlaying(true);
		timerRef.current = setTimeout(() => { limitReachedRef.current = true; }, 10000);
		void playbackRef.current.play();
	}

	function next() {
		if (limitReachedRef.current) { stop(); return; }
		indexRef.current += 1;
		if (indexRef.current >= urls.length) { stop(); return; }
		audioRef.current.src = urls[indexRef.current];
		void playbackRef.current.play();
	}

	return <div>
		<button type="button" className={styles.audioPreview} onClick={playing ? stop : start} aria-pressed={playing}>
			<span className={styles.audioPreviewIcon}>{playing ? <Square size={12} fill="currentColor" aria-hidden="true" /> : <Play size={12} fill="currentColor" aria-hidden="true" />}</span>
			<span>{t(playing ? "stopPreview" : "listenPreview")}</span>
			<span className={styles.audioPreviewWave} aria-hidden="true"><i /><i /><i /><i /><i /></span>
		</button>
		{error && <p className={styles.audioError} role="status">{t("previewError")}</p>}
		<audio ref={audioRef} preload="none" onEnded={next} onError={() => { stop(); setError(true); }} />
	</div>;
}
