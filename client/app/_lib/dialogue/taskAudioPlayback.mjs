// Owns pending playback for one sentence, including its character-entry delay.
export function createTaskAudioPlayback(audio, getRate, onBlocked, getFallback = () => null) {
	let disposed = false;
	let generation = 0;
	let timer;
	let finishDelay;
	let fallbackUsed = false;
	let wantsPlayback = false;
	let pending = false;

	function switchToFallback() {
		const fallback = !fallbackUsed && getFallback(audio.src);
		if (!fallback) return false;
		fallbackUsed = true;
		audio.src = fallback;
		return true;
	}

	function cancel() {
		generation += 1;
		pending = false;
		clearTimeout(timer);
		finishDelay?.();
		finishDelay = undefined;
	}

	return {
		async play(delay = 0) {
			cancel();
			if (disposed) return false;
			wantsPlayback = true;
			const request = generation;
			if (delay) await new Promise(resolve => {
				finishDelay = resolve;
				timer = setTimeout(resolve, delay);
			});
			if (disposed || request !== generation) return false;
			finishDelay = undefined;
			audio.playbackRate = getRate();
			const wasFallback = fallbackUsed;
			pending = true;
			try {
				await audio.play();
				return !disposed && request === generation;
			} catch (error) {
				if (!disposed && request === generation && error?.name !== "NotAllowedError" &&
					((!wasFallback && fallbackUsed) || (audio.error && switchToFallback()))) {
					try {
						audio.playbackRate = getRate();
						await audio.play();
						return !disposed && request === generation;
					} catch { /* Keep the play button available. */ }
				}
				// Autoplay can be blocked. Leave the existing Play button available.
				if (!disposed && request === generation) onBlocked();
				return false;
			} finally {
				if (request === generation) pending = false;
			}
		},
		handleError() {
			if (!disposed && switchToFallback() && wantsPlayback && !pending) void this.play();
		},
		finish() { wantsPlayback = false; },
		pause() {
			wantsPlayback = false;
			cancel();
			audio.pause();
		},
		dispose() {
			disposed = true;
			wantsPlayback = false;
			cancel();
			audio.pause();
			audio.currentTime = 0;
		},
	};
}
