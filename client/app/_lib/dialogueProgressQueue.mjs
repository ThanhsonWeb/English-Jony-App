import { createDialogueAttemptClient } from "./dialogueProgressSave.mjs";

export const progressQueuePrefix = userId => `studyjony-progress-v1:${encodeURIComponent(userId)}:`;
export const emptyProgressQueue = Object.freeze({ status: "idle", pendingCount: 0, canLeave: true, requiresAttention: false });
const taskPath = /^\/api\/v1\/dialogue-progress\/[a-z0-9-]+\/[a-z0-9-]+\/tasks\/[a-z0-9-]+$/;

// One storage key per task avoids competing tabs overwriting an entire queue.
// Confirmed markers coordinate tabs; a fresh exercise visit can replace a marker.
export function createDialogueProgressQueue({ userId, storage, locks, isCurrent = () => true,
	onSaved = () => {}, now = Date.now, retryDelay = 1000, requestTimeout = 15000 }) {
	const prefix = progressQueuePrefix(userId), records = new Map(), clients = new Map(), listeners = new Set();
	let snapshot = emptyProgressQueue, running = false, active = null, timer, generation = 0, sequence = 0;
	let storageError = false;
	let lockUnavailable = false;
	const lockManager = () => { try { return locks?.(); } catch { return null; } };
	const key = path => prefix + encodeURIComponent(path);
	const pending = () => [...records.values()].filter(record => record.status !== "saved")
		.sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
	function publish() {
		const items = pending();
		snapshot = { status: storageError || items.some(record => record.status === "error") ? "error" : items.length ? "saving" : "idle", storageError,
			pendingCount: items.length, canLeave: !items.length || (!storageError && items.every(record => record.durable)),
			// UI only: ordinary saves and automatic retries need no interruption.
			requiresAttention: storageError || items.some(record => !record.durable ||
				(record.status === "error" && record.nextRetry === Number.MAX_SAFE_INTEGER)) };
		listeners.forEach(listener => listener());
	}
	function persist(record) {
		try {
			const store = storage(), value = JSON.stringify(record);
			store.setItem(key(record.path), value);
			record.durable = store.getItem(key(record.path)) === value && !lockUnavailable && Boolean(lockManager()?.request);
		} catch { record.durable = false; }
	}
	function confirm(record, progress) {
		record.status = "saved";
		// Only written after a server response confirms this specific task.
		try { storage().setItem(key(record.path), JSON.stringify({ id: record.id, path: record.path,
			userId, createdAt: record.createdAt, status: "saved" })); } catch { /* Retrying the old proof remains idempotent. */ }
		// UI observers must never turn a confirmed write into a failed save.
		if (progress) { try { onSaved(progress); } catch { /* Progress is already confirmed. */ } }
		publish();
	}
	function restore() {
		try {
			const store = storage();
			let failed = false;
			for (let index = 0; index < store.length; index++) {
				const name = store.key(index);
				if (!name?.startsWith(prefix)) continue;
				try {
				const record = JSON.parse(store.getItem(name));
				if (record.userId !== userId || !taskPath.test(record.path) || name !== key(record.path) ||
					typeof record.id !== "string" || !Number.isFinite(record.createdAt)) throw new Error("Invalid queued progress");
				const previous = records.get(record.path);
				if (record.status === "saved") {
					if (previous?.id === record.id && previous.status !== "saved") confirm(previous);
					continue;
				}
				if (!record.input || typeof record.input !== "object" || JSON.stringify(record.input).length > 50000) throw new Error("Invalid completion");
				if (!previous || previous.id !== record.id) {
					clients.get(record.path)?.cancel(); clients.delete(record.path);
					records.set(record.path, { ...record, durable: !lockUnavailable && Boolean(lockManager()?.request) });
				} else if (previous.durable) {
					// A waiting tab may have loaded this record before its owner got a proof.
					if (record.attempt && previous.attempt?.attemptId !== record.attempt.attemptId) {
						clients.get(record.path)?.cancel(); clients.delete(record.path);
						previous.attempt = record.attempt;
					}
					if (record.nextRetry > (previous.nextRetry || 0)) {
						previous.nextRetry = record.nextRetry; previous.failures = record.failures; previous.status = record.status;
					}
				}
				} catch { failed = true; }
			}
			storageError = failed;
		} catch { storageError = true; }
		publish();
	}
	function client(path) {
		if (!clients.has(path)) clients.set(path, createDialogueAttemptClient(path, {
			userId,
			initialAttempt: records.get(path)?.status !== "saved" ? records.get(path)?.attempt : undefined,
			onAttempt(attempt) {
				const record = records.get(path);
				if (record && record.status !== "saved") { record.attempt = attempt; persist(record); publish(); }
			},
		}));
		return clients.get(path);
	}
	async function drain(id, signal) {
		restore();
		while (running && id === generation && isCurrent() && !signal.aborted) {
			const record = pending()[0];
			if (!record || record.nextRetry > now()) return;
			record.status = "saving"; publish();
			const request = new AbortController();
			const stop = () => request.abort();
			signal.addEventListener("abort", stop, { once: true });
			const timeout = setTimeout(stop, requestTimeout);
			try {
				const attempt = client(record.path);
				const progress = await attempt.save(request.signal, record.input);
				if (!isCurrent() || signal.aborted || id !== generation) return;
				const ids = record.path.split("/");
				if (!Array.isArray(progress.completedTaskIds) || !progress.completedTaskIds.includes(record.path.split("/").at(-1)) ||
					(progress.user && String(progress.user) !== userId) || (progress.lessonId && progress.lessonId !== ids.at(-4)) ||
					(progress.dialogueId && progress.dialogueId !== ids.at(-3))) throw new Error("Task confirmation is missing or belongs to another account/lesson");
				confirm(record, progress);
			} catch (error) {
				if (!isCurrent() || signal.aborted || id !== generation) return;
				record.status = "error";
				record.failures = (record.failures || 0) + 1;
				const temporary = !error.status || error.status === 408 || error.status === 429 || error.status >= 500;
				record.nextRetry = temporary ? now() + Math.min(30000, retryDelay * 2 ** Math.min(record.failures - 1, 5)) : Number.MAX_SAFE_INTEGER;
				persist(record); publish(); return;
			} finally { clearTimeout(timeout); signal.removeEventListener("abort", stop); }
		}
	}
	function flush() {
		if (!running || active || !isCurrent()) return;
		clearTimeout(timer);
		const id = generation, controller = new AbortController();
		active = controller;
		const work = () => drain(id, controller.signal);
		const manager = lockUnavailable ? null : lockManager();
		Promise.resolve().then(() => manager?.request
			? manager.request(prefix, { signal: controller.signal }, work) : work())
			.catch(() => {
				if (id !== generation || !running || controller.signal.aborted) return;
				// If this browser refuses a lock, require confirmation before navigation.
				lockUnavailable = true;
				for (const record of pending()) { record.durable = false; record.nextRetry = now() + retryDelay; }
				publish();
			})
			.finally(() => {
				if (active !== controller) return;
				active = null;
				const record = pending()[0];
				if (running && record && record.nextRetry !== Number.MAX_SAFE_INTEGER) timer = setTimeout(flush, Math.max(0, (record.nextRetry || 0) - now()));
			});
	}
	return {
		getSnapshot: () => snapshot,
		getTask: path => records.get(path),
		subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
		prepare(path) {
			restore();
			const record = records.get(path);
			// Only the worker holding the cross-tab lock may renew a queued proof.
			if (record && record.status !== "saved") return Promise.resolve(record.attempt);
			return client(path).prepare();
		},
		beginTask(path) {
			if (records.get(path)?.status === "saved") { clients.get(path)?.cancel(); clients.delete(path); }
		},
		enqueue(path, input) {
			if (!isCurrent() || !taskPath.test(path) || !input) return false;
			restore();
			let record = records.get(path);
			if (!record || record.status === "saved") {
				const createdAt = Math.max(now(), sequence + 1, (pending().at(-1)?.createdAt || 0) + 1); sequence = createdAt;
				record = { id: `${createdAt}-${Math.random().toString(36).slice(2)}`, path, userId,
					createdAt, input: JSON.parse(JSON.stringify(input)), status: "saving", attempt: client(path).getAttempt() };
				records.set(path, record); persist(record);
			}
			publish(); flush();
			return record.durable && !storageError;
		},
		waitForTask(path) {
			if (records.get(path)?.status === "saved") return Promise.resolve(true);
			if (!isCurrent() || records.get(path)?.status === "error") return Promise.resolve(false);
			return new Promise(resolve => {
				const unsubscribe = this.subscribe(() => {
					const record = records.get(path);
					if (!running || !isCurrent() || record?.status === "saved" || record?.status === "error") {
						unsubscribe(); resolve(record?.status === "saved" && isCurrent());
					}
				});
			});
		},
		retry() {
			if (active) return;
			restore();
			for (const record of pending()) { record.nextRetry = 0; record.failures = 0; record.status = "saving"; persist(record); }
			publish(); flush();
		},
		sync() { restore(); flush(); },
		start() { running = true; generation++; restore(); this.retry(); },
		stop() {
			running = false; generation++; clearTimeout(timer); active?.abort(); active = null;
			clients.forEach(attempt => attempt.cancel()); clients.clear(); publish();
		},
	};
}
