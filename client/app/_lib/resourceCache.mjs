// Shared client-side cache for non-sensitive lesson data. Private entries are
// keyed by the server-confirmed account ID and persisted only for this tab.
const PREFIX = "studyjony-resources:v1:";
const EMPTY = Object.freeze({ data: undefined, error: null, updatedAt: 0, invalidated: false, revision: 0 });
const MAX_PERSIST_AGE = 60 * 60 * 1000;

export function createResourceCache({ storage = () => globalThis.sessionStorage, now = Date.now } = {}) {
	const entries = new Map();
	const listeners = new Map();
	const generations = new Map();
	let activeUserId = null;
	let activeSessionVersion = 0;
	function setActiveUserId(userId) {
		const nextId = userId || null;
		if (nextId !== activeUserId) { activeUserId = nextId; activeSessionVersion++; }
	}
	function captureActiveSession() { return { userId: activeUserId, version: activeSessionVersion }; }
	function isActiveSession(session) {
		return Boolean(session?.userId) && session.userId === activeUserId && session.version === activeSessionVersion;
	}
	const storageKey = (userId, key) => `${PREFIX}${encodeURIComponent(userId)}:${encodeURIComponent(key)}`;
	const cacheKey = (userId, key) => `${userId}\u0000${key}`;
	function getStorage() { try { return storage(); } catch { return null; } }
	function notify(id) { for (const listener of listeners.get(id) || []) listener(); }
	function read(userId, key, persist = false) {
		if (!userId || !key) return EMPTY;
		const id = cacheKey(userId, key);
		if (entries.has(id)) return entries.get(id);
		let entry = EMPTY;
		if (persist) {
			try {
				const saved = JSON.parse(getStorage()?.getItem(storageKey(userId, key)) || "null");
				if (saved?.version === 1 && saved.userId === userId && saved.key === key &&
					Number.isFinite(saved.updatedAt) && now() - saved.updatedAt <= MAX_PERSIST_AGE &&
					now() >= saved.updatedAt && saved.data !== undefined) {
					entry = { data: saved.data, error: null, updatedAt: saved.updatedAt, invalidated: false, revision: 1 };
				}
			} catch { /* Storage may be disabled or contain an old format. */ }
		}
		entries.set(id, entry);
		return entry;
	}
	function write(userId, key, data, { persist = false } = {}) {
		const id = cacheKey(userId, key);
		const previous = read(userId, key, persist);
		generations.set(id, (generations.get(id) || 0) + 1);
		pending.delete(id);
		const updatedAt = now();
		entries.set(id, { data, error: null, updatedAt, invalidated: false, revision: previous.revision + 1 });
		if (persist) {
			try { getStorage()?.setItem(storageKey(userId, key), JSON.stringify({ version: 1, userId, key, data, updatedAt })); }
			catch { /* Memory cache remains usable when tab storage is full. */ }
		}
		notify(id);
	}
	const pending = new Map();
	async function load(userId, key, fetcher, { persist = false, staleTime = 30_000, force = false } = {}) {
		if (!userId || !key) return undefined;
		const id = cacheKey(userId, key);
		const current = read(userId, key, persist);
		if (!force && !current.invalidated && current.data !== undefined && now() - current.updatedAt < staleTime) return current.data;
		if (pending.has(id)) return pending.get(id);
		const generation = generations.get(id) || 0;
		const request = Promise.resolve().then(fetcher).then(data => {
			if ((generations.get(id) || 0) === generation) {
				write(userId, key, data, { persist });
				return data;
			}
			// Callers must not receive an old GET after a mutation or logout either.
			const latest = entries.get(id);
			return latest?.invalidated ? load(userId, key, fetcher, { persist, staleTime, force: true }) : latest?.data;
		}).catch(error => {
			if ((generations.get(id) || 0) === generation) {
				const previous = read(userId, key, persist);
				entries.set(id, { ...previous, error, revision: previous.revision + 1 });
				notify(id);
			}
			throw error;
		}).finally(() => { if (pending.get(id) === request) pending.delete(id); });
		pending.set(id, request);
		return request;
	}
	function invalidate(userId, key) {
		if (!userId || !key) return;
		const id = cacheKey(userId, key);
		const previous = read(userId, key);
		generations.set(id, (generations.get(id) || 0) + 1);
		pending.delete(id);
		entries.set(id, { ...previous, error: null, invalidated: true, revision: previous.revision + 1 });
		try { getStorage()?.removeItem(storageKey(userId, key)); } catch { /* Memory entry remains invalidated. */ }
		notify(id);
	}
	function invalidatePrefix(userId, prefix) {
		if (!userId) return;
		for (const id of entries.keys()) {
			if (id.startsWith(`${userId}\u0000${prefix}`)) invalidate(userId, id.slice(userId.length + 1));
		}
		const store = getStorage();
		try {
			const storagePrefix = `${PREFIX}${encodeURIComponent(userId)}:${encodeURIComponent(prefix)}`;
			for (let i = store.length - 1; i >= 0; i--) {
				const key = store.key(i);
				if (key?.startsWith(storagePrefix)) store.removeItem(key);
			}
		} catch { /* In-memory entries are still invalidated. */ }
	}
	function clearUser(userId) {
		if (!userId) return;
		if (activeUserId === userId) setActiveUserId(null);
		const cleared = [...entries.keys()].filter(id => id.startsWith(`${userId}\u0000`));
		for (const id of cleared) {
			generations.set(id, (generations.get(id) || 0) + 1);
			entries.delete(id); pending.delete(id);
		}
		const store = getStorage();
		const prefix = `${PREFIX}${encodeURIComponent(userId)}:`;
		try { for (let i = (store?.length || 0) - 1; i >= 0; i--) { const key = store.key(i); if (key?.startsWith(prefix)) store.removeItem(key); } }
		catch { /* Clearing memory still prevents showing old account data. */ }
		for (const id of cleared) notify(id);
	}
	function clearAllPrivate() {
		setActiveUserId(null);
		const cleared = [...entries.keys()];
		for (const id of cleared) {
			generations.set(id, (generations.get(id) || 0) + 1);
			entries.delete(id); pending.delete(id);
		}
		const store = getStorage();
		try { for (let i = (store?.length || 0) - 1; i >= 0; i--) { const key = store.key(i); if (key?.startsWith(PREFIX)) store.removeItem(key); } }
		catch { /* Storage can be disabled. */ }
		for (const id of cleared) notify(id);
	}
	function subscribe(userId, key, listener) {
		const id = cacheKey(userId, key);
		let set = listeners.get(id);
		if (!set) { set = new Set(); listeners.set(id, set); }
		set.add(listener);
		return () => { set.delete(listener); if (!set.size) listeners.delete(id); };
	}
	function keys(userId, prefix = "") {
		const found = new Set();
		for (const id of entries.keys()) {
			if (id.startsWith(`${userId}\u0000${prefix}`)) found.add(id.slice(userId.length + 1));
		}
		try {
			const store = getStorage(), start = `${PREFIX}${encodeURIComponent(userId)}:`;
			for (let index = 0; index < store.length; index++) {
				const name = store.key(index);
				if (!name?.startsWith(start)) continue;
				const key = decodeURIComponent(name.slice(start.length));
				if (key.startsWith(prefix)) found.add(key);
			}
		} catch { /* Memory keys are available even when storage is disabled. */ }
		return [...found];
	}
	return { read, write, load, invalidate, invalidatePrefix, clearUser, clearAllPrivate, subscribe, keys,
		setActiveUserId, captureActiveSession, isActiveSession };
}

export const resourceCache = createResourceCache();
export const emptyResource = EMPTY;
