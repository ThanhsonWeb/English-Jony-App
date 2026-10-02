export const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5];

const GUEST_STORAGE_KEY = "studyjony-dialogue-playback-rate";
const CHANGE_EVENT = "studyjony-dialogue-playback-rate-change";

export function getDialoguePlaybackRateStorageKey(userId = null) {
	return userId
		? `${GUEST_STORAGE_KEY}:${encodeURIComponent(String(userId))}`
		: GUEST_STORAGE_KEY;
}

export function subscribeToDialoguePlaybackRate(userId, onChange) {
	if (typeof window === "undefined") return () => {};
	const storageKey = getDialoguePlaybackRateStorageKey(userId);
	const handleStorage = (event) => {
		if (!event.key || event.key === storageKey) onChange();
	};
	const handleChange = (event) => {
		if (!event.detail?.key || event.detail.key === storageKey) onChange();
	};
	window.addEventListener("storage", handleStorage);
	window.addEventListener(CHANGE_EVENT, handleChange);
	return () => {
		window.removeEventListener("storage", handleStorage);
		window.removeEventListener(CHANGE_EVENT, handleChange);
	};
}

export function getDialoguePlaybackRateSnapshot(userId = null) {
	if (typeof window === "undefined") return 1;
	try {
		return readDialoguePlaybackRate(window.localStorage, userId);
	} catch {
		return 1;
	}
}

export function getServerDialoguePlaybackRateSnapshot() {
	return 1;
}

export function readDialoguePlaybackRate(storage, userId = null) {
	try {
		const storedRate = Number(storage?.getItem(getDialoguePlaybackRateStorageKey(userId)));
		return PLAYBACK_RATES.includes(storedRate) ? storedRate : 1;
	} catch {
		return 1;
	}
}

export function saveDialoguePlaybackRate(rate, storage, userId = null) {
	if (!PLAYBACK_RATES.includes(rate)) return false;

	try {
		const storageKey = getDialoguePlaybackRateStorageKey(userId);
		storage?.setItem(storageKey, String(rate));
		if (typeof window !== "undefined" && storage === window.localStorage) {
			window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { key: storageKey } }));
		}
		return Boolean(storage);
	} catch {
		return false;
	}
}
