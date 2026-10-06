export function createDialogueProgressSaveController(saveProgress, { isCurrent = () => true, onSaved = () => {} } = {}) {
	let snapshot = { status: "idle" };
	let pending = null;
	let requestId = 0;
	let abortController;
	const listeners = new Set();
	function publish(status) {
		snapshot = { status };
		listeners.forEach(listener => listener());
	}
	function save() {
		if (!isCurrent()) return Promise.resolve(false);
		if (snapshot.status === "saved") return Promise.resolve(true);
		if (pending) return pending;
		const id = ++requestId;
		abortController = new AbortController();
		const signal = abortController.signal;
		pending = Promise.resolve().then(() => {
			if (id !== requestId || !isCurrent()) throw new Error("Save was cancelled");
			return saveProgress(signal);
		}).then(progress => {
			if (id !== requestId || !isCurrent()) return false;
			publish("saved");
			onSaved(progress);
			return true;
		}).catch(() => {
			if (id === requestId && isCurrent() && snapshot.status !== "saved") publish("error");
			return id === requestId && isCurrent() && snapshot.status === "saved";
		}).finally(() => { if (id === requestId) pending = null; });
		publish("saving");
		return pending;
	}
	return {
		save,
		getSnapshot: () => snapshot,
		subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
		cancel() {
			requestId += 1;
			abortController?.abort();
			pending = null;
			if (snapshot.status === "saving") publish("idle");
		},
	};
}

export async function saveDialogueProgress(path, signal) {
	const response = await fetch(path, { method: "PATCH", credentials: "include", signal });
	if (!response.ok) throw new Error("Progress was not saved");
	const data = await response.json();
	if (!data.data?.progress) throw new Error("Progress confirmation is missing");
	return data.data.progress;
}
