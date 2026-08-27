const STORAGE_KEY = "studyjony-dialogue-progress";
const PROGRESS_EVENT = "studyjony-dialogue-progress-change";
const EMPTY_PROGRESS = "{}";

export function getDialogueProgressSnapshot() {
	if (typeof window === "undefined") return EMPTY_PROGRESS;
	return window.localStorage.getItem(STORAGE_KEY) || EMPTY_PROGRESS;
}

export function getDialogueProgressServerSnapshot() {
	return EMPTY_PROGRESS;
}

export function subscribeToDialogueProgress(callback) {
	if (typeof window === "undefined") return () => {};

	window.addEventListener("storage", callback);
	window.addEventListener(PROGRESS_EVENT, callback);

	return () => {
		window.removeEventListener("storage", callback);
		window.removeEventListener(PROGRESS_EVENT, callback);
	};
}

export function parseDialogueProgress(snapshot) {
	try {
		return JSON.parse(snapshot);
	} catch {
		return {};
	}
}

export function markDialogueTaskComplete(lessonId, dialogueId, taskId) {
	if (typeof window === "undefined") return;

	const progress = parseDialogueProgress(getDialogueProgressSnapshot());
	const completedTasks = new Set(progress[lessonId]?.[dialogueId] || []);
	completedTasks.add(taskId);

	const nextProgress = {
		...progress,
		[lessonId]: {
			...progress[lessonId],
			[dialogueId]: [...completedTasks],
		},
	};

	window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextProgress));
	window.dispatchEvent(new Event(PROGRESS_EVENT));
}
