// Owns pending playback for one sentence, including its character-entry delay.
export function createTaskAudioPlayback(audio, getRate, onBlocked) {
	let disposed = false;
	let generation = 0;
	let timer;
	let finishDelay;

	function cancel() {
		generation += 1;
		clearTimeout(timer);
		finishDelay?.();
		finishDelay = undefined;
	}

	return {
		async play(delay = 0) {
			cancel();
			if (disposed) return false;
			const request = generation;
			if (delay) await new Promise(resolve => {
				finishDelay = resolve;
				timer = setTimeout(resolve, delay);
			});
			if (disposed || request !== generation) return false;
			finishDelay = undefined;
			audio.playbackRate = getRate();
			try {
				await audio.play();
				return !disposed && request === generation;
			} catch {
				// Autoplay can be blocked. Leave the existing Play button available.
				if (!disposed && request === generation) onBlocked();
				return false;
			}
		},
		pause() {
			cancel();
			audio.pause();
		},
		dispose() {
			disposed = true;
			cancel();
			audio.pause();
			audio.currentTime = 0;
		},
	};
}
