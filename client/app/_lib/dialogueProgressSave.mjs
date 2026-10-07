export function createDialogueProgressSaveController(saveProgress, { isCurrent = () => true, onSaved = () => {} } = {}) {
	let snapshot = { status: "idle" };
	let pending = null;
	let requestId = 0;
	let abortController;
	let completion;
	const listeners = new Set();
	function publish(status) {
		snapshot = { status };
		listeners.forEach(listener => listener());
	}
	function save(input) {
		if (input !== undefined) completion = input;
		if (!isCurrent()) return Promise.resolve(false);
		if (snapshot.status === "saved") return Promise.resolve(true);
		if (pending) return pending;
		const id = ++requestId;
		abortController = new AbortController();
		const signal = abortController.signal;
		pending = Promise.resolve().then(() => {
			if (id !== requestId || !isCurrent()) throw new Error("Save was cancelled");
			return saveProgress(signal, completion);
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

export async function saveDialogueProgress(path, signal, completion) {
	const response = await fetch(path, { method: "PATCH", credentials: "include", signal,
		headers: { "Content-Type": "application/json" }, body: JSON.stringify(completion) });
	if (response.status === 409) {
		const data = await response.json();
		throw Object.assign(new Error("Progress was not saved"), { code: data.code, retryAfterMs: data.retryAfterMs });
	}
	if (!response.ok) throw new Error("Progress was not saved");
	const data = await response.json();
	if (!data.data?.progress) throw new Error("Progress confirmation is missing");
	return data.data.progress;
}

function wait(ms, signal) {
	return new Promise((resolve, reject) => {
		if (signal?.aborted) return reject(signal.reason);
		const stop = () => { clearTimeout(timer); reject(signal.reason); };
		const timer = setTimeout(() => { signal?.removeEventListener("abort", stop); resolve(); }, ms);
		signal?.addEventListener("abort", stop, { once: true });
	});
}

export function createDialogueAttemptClient(path) {
	let attempt, pending, request, generation = 0;
	function prepare() {
		if (attempt && attempt.expiresAt > Date.now() + 1000) return Promise.resolve(attempt);
		if (pending) return pending;
		const id = ++generation;
		request = new AbortController();
		pending = fetch(`${path}/attempt`, { method: "POST", credentials: "include", signal: request.signal })
			.then(async response => {
				if (!response.ok) throw new Error("Study attempt could not start");
				const { data } = await response.json();
				if (id !== generation || !/^[a-f0-9]{64}$/.test(data?.attemptId) || !Number.isFinite(Date.parse(data.expiresAt)) || !Number.isFinite(data.readyAfterMs) || data.readyAfterMs < 0 || data.readyAfterMs > 2000) throw new Error("Invalid study attempt");
				attempt = { ...data, expiresAt: Date.parse(data.expiresAt), readyAt: Date.now() + data.readyAfterMs + 10 };
				return attempt;
			}).finally(() => { if (id === generation) pending = null; });
		return pending;
	}
	return {
		prepare,
		cancel() { generation += 1; request?.abort(); pending = null; attempt = null; },
		async save(signal, input) {
			for (let retry = 0; retry < 2; retry++) {
				const current = await prepare();
				await wait(Math.max(0, current.readyAt - Date.now()), signal);
				try { return await saveDialogueProgress(path, signal, { ...input, attemptId: current.attemptId }); }
				catch (error) {
					if (signal.aborted || retry === 1) throw error;
					if (error.code === "studyAttemptExpired") attempt = null;
					else if (error.code === "studyAttemptNotReady" && Number.isFinite(error.retryAfterMs) && error.retryAfterMs <= 2000) current.readyAt = Date.now() + Math.max(0, error.retryAfterMs) + 10;
					else throw error;
				}
			}
		},
	};
}
