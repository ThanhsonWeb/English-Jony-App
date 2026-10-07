const AppError = require("../utils/appError");

const dictionaryPolicy = Object.freeze({
	maxWordLength: 64, maxWords: 8, maxEntries: 2000,
	cacheTtlMs: 24 * 60 * 60 * 1000, failureTtlMs: 30000,
	enrichmentCooldownMs: 5 * 60 * 1000, cleanupMs: 60000,
	concurrency: 8, maxQueue: 32, queueTimeoutMs: 1500, responseTimeoutMs: 8000,
	providerJobs: 600, budgetWindowMs: 10 * 60 * 1000,
});

function normalizeDictionaryWord(value, policy = dictionaryPolicy) {
	if (typeof value !== "string" || value.length > policy.maxWordLength * 2) throw new AppError("Invalid dictionary word", 400);
	const word = value.normalize("NFKC").trim().toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, " ");
	const words = word.split(" ");
	// Allow trailing-dot abbreviations and dotted initials, not arbitrary domains.
	const validWords = words.every(part =>
		/^[\p{Script=Latin}\p{M}]+(?:['-][\p{Script=Latin}\p{M}]+)*$/u.test(part) ||
		/^(?:[\p{Script=Latin}\p{M}]+\.|(?:\p{Script=Latin}\p{M}*\.)+\p{Script=Latin}\p{M}*\.?)$/u.test(part));
	if (!word || word.length > policy.maxWordLength || words.length > policy.maxWords || !validWords) {
		throw new AppError("Use an English word or short phrase", 400);
	}
	return word;
}

const unavailable = () => new AppError("Dictionary is busy or temporarily unavailable. Please try again.", 503);

function deadline(promise, ms) {
	let timer;
	return Promise.race([promise, new Promise((resolve, reject) => { timer = setTimeout(() => reject(unavailable()), ms); })])
		.finally(() => clearTimeout(timer));
}

// All maps, admission budgets and provider slots are process-local.
function createDictionaryLookup({ lookup, enrich, now = Date.now, policy: overrides = {} }) {
	const policy = { ...dictionaryPolicy, ...overrides };
	const cache = new Map(), inFlight = new Map(), enrichments = new Map(), queue = [];
	let active = 0, admissions = [], closed = false;
	function cleanup() {
		const time = now();
		for (const [key, item] of cache) if (item.expiresAt <= time) cache.delete(key);
		admissions = admissions.filter(timeAdmitted => timeAdmitted > time - policy.budgetWindowMs);
	}
	const interval = setInterval(cleanup, policy.cleanupMs); interval.unref();
	function cached(word) {
		const item = cache.get(word);
		if (!item || item.expiresAt <= now()) { cache.delete(word); return null; }
		cache.delete(word); cache.set(word, item); // Least-recently-used eviction.
		return item;
	}
	function store(word, result, error = false) {
		cleanup();
		while (cache.size >= policy.maxEntries) cache.delete(cache.keys().next().value);
		const item = { result, error, expiresAt: now() + (error ? policy.failureTtlMs : policy.cacheTtlMs), enrichAfter: 0 };
		cache.set(word, item); return item;
	}
	function acquire(background = false) {
		if (closed) return Promise.reject(unavailable());
		if (active < policy.concurrency) { active++; return Promise.resolve(); }
		if (background || queue.length >= policy.maxQueue) return Promise.reject(unavailable());
		return new Promise((resolve, reject) => {
			const entry = { resolve, reject, timer: setTimeout(() => {
				queue.splice(queue.indexOf(entry), 1); reject(unavailable());
			}, policy.queueTimeoutMs) };
			queue.push(entry);
		});
	}
	function release() {
		const next = queue.shift();
		if (next) { clearTimeout(next.timer); next.resolve(); }
		else active--;
	}
	async function run(operation, background = false) {
		await acquire(background);
		try {
			cleanup();
			if (admissions.length >= policy.providerJobs) throw unavailable();
			admissions.push(now());
			// Keep the slot until the actual provider work ends, even if the HTTP
			// caller timed out. An uncooperative SDK cannot create unlimited work.
			return await operation();
		} finally { release(); }
	}
	function enrichCached(word, item) {
		if (!enrich || item.error || enrichments.has(word) || item.enrichAfter > now()) return;
		if (item.result.dictionaryComplete && (!item.result.data.example || item.result.data.exampleVietnamese)) return;
		item.enrichAfter = now() + policy.enrichmentCooldownMs;
		const operation = run(() => enrich(word, item.result), true).then(result => {
			// Never resurrect an evicted/expired entry or extend its original TTL.
			if (cache.get(word) === item && item.expiresAt > now()) item.result = result;
		}).catch(() => {}).finally(() => enrichments.delete(word));
		enrichments.set(word, operation);
	}
	return {
		async lookup(value) {
			const word = normalizeDictionaryWord(value, policy), hit = cached(word);
			if (hit) { if (hit.error) throw unavailable(); enrichCached(word, hit); return hit.result.data; }
			if (inFlight.has(word)) return deadline(inFlight.get(word), policy.responseTimeoutMs);
			if (inFlight.size >= policy.concurrency + policy.maxQueue) throw unavailable();
			const operation = run(async () => {
				try {
					const result = await lookup(word);
					const item = store(word, result); enrichCached(word, item);
					return result.data;
				} catch (error) { store(word, null, true); throw error; }
			}).finally(() => inFlight.delete(word));
			inFlight.set(word, operation);
			return deadline(operation, policy.responseTimeoutMs);
		},
		stats: () => ({ cacheSize: cache.size, inFlight: inFlight.size, active, queued: queue.length, enrichments: enrichments.size, providerJobs: admissions.length }),
		close() { closed = true; clearInterval(interval); cache.clear(); for (const entry of queue.splice(0)) { clearTimeout(entry.timer); entry.reject(unavailable()); } },
	};
}

module.exports = { dictionaryPolicy, normalizeDictionaryWord, createDictionaryLookup };
