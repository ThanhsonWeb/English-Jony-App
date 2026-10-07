const assert = require("node:assert/strict");
const { test } = require("node:test");
const express = require("express");
const { Translate } = require("@google-cloud/translate").v2;
const { createDictionaryLookup, normalizeDictionaryWord } = require("../services/dictionaryLookup");
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const result = word => ({ dictionaryComplete: true, data: { english: word, vietnamese: "meaning", example: "" } });
function fixture(t, options = {}) {
	const dictionary = createDictionaryLookup({ lookup: async word => result(word), ...options });
	t.after(() => dictionary.close()); return dictionary;
}

test("valid English words/short phrases normalize; malformed and oversized input never reaches providers", async t => {
	let calls = 0;
	const d = fixture(t, { lookup: async word => { calls++; return result(word); } });
	assert.equal(normalizeDictionaryWord("  TAKE   off "), "take off");
	for (const word of ["well-known", "don't", "café", "déjà vu"]) assert.equal((await d.lookup(word)).english, word);
	for (const word of [null, {}, [], "", "a".repeat(65), "x ".repeat(100), "http://evil.test", "<script>", "x/y", "$where", "🙂", "one two three four five six seven eight nine",
		"https://u.s.", "www.evil.test", "evil.test", "u.s./path", "mr.<script>", "javascript:alert(1)", "u.s.?x=1", "mr.\u0000",
		".", ".mr", "mr..", "e..g.", "e.g..", "mr .", "m.r.-", "u.s.1"]) await assert.rejects(d.lookup(word), { statusCode: 400 });
	assert.equal(calls, 4);
});

for (const word of ["mr.", "u.s.", "e.g."]) test(`${word}: normalized concurrent lookups and cache hits share one provider job`, async t => {
	let calls = 0;
	const d = fixture(t, { policy: { providerJobs: 1 }, lookup: async key => { calls++; await delay(5); return result(key); } });
	const values = await Promise.all([d.lookup(word), d.lookup(word.toUpperCase()), d.lookup(`  ${word.toUpperCase()}  `)]);
	for (const value of values) assert.deepEqual(value, result(word).data);
	assert.deepEqual(await d.lookup(` ${word.toUpperCase()} `), values[0]);
	assert.equal(calls, 1); assert.equal(d.stats().providerJobs, 1);
});

test("dotted abbreviations retain normalized length, raw length and word-count limits", async t => {
	let calls = 0;
	const d = fixture(t, { lookup: async word => { calls++; return result(word); } });
	const longest = "a".repeat(63) + ".", eightWords = Array(8).fill("mr.").join(" ");
	assert.equal((await d.lookup(longest)).english, longest);
	assert.equal((await d.lookup(eightWords)).english, eightWords);
	assert.equal(normalizeDictionaryWord("  Mr.   Smith "), "mr. smith");
	assert.equal(normalizeDictionaryWord("U.S"), "u.s");
	for (const word of ["a".repeat(64) + ".", Array(9).fill("mr.").join(" "), " ".repeat(126) + "mr."]) {
		await assert.rejects(d.lookup(word), { statusCode: 400 });
	}
	assert.equal(calls, 2);
});

test("three simultaneous normalized same-word misses share one operation; repeats use cache", async t => {
	let calls = 0;
	const d = fixture(t, { lookup: async word => { calls++; await delay(15); return result(word); } });
	const values = await Promise.all([d.lookup("apple"), d.lookup(" APPLE "), d.lookup("Apple")]);
	assert.equal(calls, 1); assert.deepEqual(values[0], values[1]);
	for (let i = 0; i < 10; i++) assert.deepEqual(await d.lookup("apple"), values[0]);
	assert.equal(calls, 1); assert.equal(d.stats().inFlight, 0);
});

test("cache evicts least recently used entries and expires actively without revisiting keys", async t => {
	let time = 0, calls = 0;
	const d = fixture(t, { now: () => time, policy: { maxEntries: 2, cacheTtlMs: 50, cleanupMs: 10 }, lookup: async word => { calls++; return result(word); } });
	await d.lookup("apple"); await d.lookup("book"); await d.lookup("apple"); await d.lookup("water");
	assert.equal(d.stats().cacheSize, 2);
	await d.lookup("book"); assert.equal(calls, 4);
	time = 51; await delay(20); assert.equal(d.stats().cacheSize, 0);
	await d.lookup("apple"); assert.equal(calls, 5);
});

test("provider concurrency and pending queue stay bounded; excess work fails cleanly", async t => {
	let active = 0, peak = 0;
	const d = fixture(t, { policy: { concurrency: 2, maxQueue: 2 }, lookup: async word => {
		active++; peak = Math.max(peak, active); await delay(25); active--; return result(word);
	} });
	const operations = ["apple", "book", "water", "hello"].map(word => d.lookup(word));
	await assert.rejects(d.lookup("orange"), { statusCode: 503 });
	await Promise.all(operations); assert.equal(peak, 2); assert.equal(d.stats().active, 0); assert.equal(d.stats().queued, 0);
});

test("queued work expires; timed-out uncooperative provider keeps its slot until actually finished", async t => {
	let finish;
	const d = fixture(t, { policy: { concurrency: 1, maxQueue: 1, queueTimeoutMs: 10, responseTimeoutMs: 20 }, lookup: word => new Promise(resolve => { finish = () => resolve(result(word)); }) });
	const first = assert.rejects(d.lookup("apple"), { statusCode: 503 });
	const queued = assert.rejects(d.lookup("book"), { statusCode: 503 });
	await Promise.all([first, queued]);
	assert.equal(d.stats().active, 1, "HTTP timeout cannot free a still-running provider slot");
	finish(); await delay(1); assert.equal(d.stats().active, 0);
	assert.equal((await d.lookup("apple")).english, "apple");
});

test("shared expensive-work budget includes enrichment; cache hits work even when budget is full", async t => {
	let time = 0;
	const d = fixture(t, { now: () => time, policy: { providerJobs: 2, budgetWindowMs: 100, failureTtlMs: 1 } });
	await d.lookup("apple"); await d.lookup("book");
	await assert.rejects(d.lookup("water"), { statusCode: 503 });
	assert.equal((await d.lookup("apple")).english, "apple");
	time = 101; assert.equal((await d.lookup("water")).english, "water");
});

test("failed lookup is coalesced and briefly cached; legitimate retry works after expiry", async t => {
	let time = 0, calls = 0;
	const d = fixture(t, { now: () => time, policy: { failureTtlMs: 20 }, lookup: async word => {
		if (++calls === 1) throw new Error("mock provider down"); return result(word);
	} });
	await assert.rejects(d.lookup("apple")); await assert.rejects(d.lookup("apple"), { statusCode: 503 }); assert.equal(calls, 1);
	time = 21; assert.equal((await d.lookup("apple")).english, "apple"); assert.equal(calls, 2);
});

test("background enrichment is shared, keeps original TTL and cannot resurrect expired/evicted entries", async t => {
	let time = 0, finish, enrichCalls = 0;
	const d = fixture(t, { now: () => time, policy: { maxEntries: 1, cacheTtlMs: 30, cleanupMs: 10 },
		lookup: async word => ({ ...result(word), dictionaryComplete: false }),
		enrich: async (word, cached) => { enrichCalls++; return new Promise(resolve => { finish = () => resolve({ ...cached, dictionaryComplete: true }); }); },
	});
	await d.lookup("apple"); await d.lookup("apple"); await d.lookup("apple");
	await delay(1); assert.equal(enrichCalls, 1);
	time = 31; await delay(20); assert.equal(d.stats().cacheSize, 0);
	finish(); await delay(1); assert.equal(d.stats().cacheSize, 0);
});

test("public controller coalesces real provider adapter calls, aborts losers, bounds data, and sets native Google timeout/no retries", async t => {
	let translations = 0, dictionaryCalls = 0, aborted = 0;
	const nativeFetch = global.fetch;
	t.mock.method(Translate.prototype, "translate", async function () {
		assert.equal(this.timeout, 3000); assert.equal(this.options.autoRetry, false); assert.equal(this.options.maxRetries, 0);
		translations++; await delay(20); return ["meaning"];
	});
	t.mock.method(global, "fetch", async (url, options) => {
		if (String(url).startsWith("http://127.0.0.1:")) return nativeFetch(url, options);
		assert.ok(/^https:\/\/(api.dictionaryapi.dev|freedictionaryapi.com)\//.test(url), "No external calls");
		dictionaryCalls++;
		if (String(url).includes("freedictionaryapi")) return new Promise((resolve, reject) => {
			options.signal.addEventListener("abort", () => { aborted++; reject(new Error("cancelled loser")); }, { once: true });
		});
		await delay(5);
		return new Response(JSON.stringify([{ phonetic: "/apple/", meanings: [{ partOfSpeech: "noun", definitions: [] }] }]));
	});
	const app = express(); app.use("/dictionary", require("../routes/dictionaryRoutes"));
	app.use((error, req, res, next) => res.status(error.statusCode || 500).json({ message: error.message }));
	const server = await new Promise(resolve => { const listener = app.listen(0, "127.0.0.1", () => resolve(listener)); });
	t.after(() => new Promise(resolve => server.close(resolve)));
	const base = `http://127.0.0.1:${server.address().port}/dictionary`;
	for (const word of ["apple", "mr.", "u.s.", "e.g."]) {
		const before = translations;
		const responses = await Promise.all([word, word.toUpperCase(), ` ${word} `].map(async input => {
			const response = await fetch(`${base}/${encodeURIComponent(input)}`); assert.equal(response.status, 200); return response.json();
		}));
		assert.equal(responses[0].data.english, word);
		assert.equal(responses[0].data.pronunciation, "/apple/"); assert.deepEqual(responses[0], responses[1]); assert.deepEqual(responses[0], responses[2]);
		assert.equal(translations, before + 1);
		assert.equal((await fetch(`${base}/${encodeURIComponent(word.toUpperCase())}`)).status, 200); assert.equal(translations, before + 1);
	}
	assert.equal(translations, 4); assert.equal(dictionaryCalls, 8); assert.equal(aborted, 4);
	for (const word of ["a".repeat(65), "mr..", "e..g.", "https://u.s.", "u.s./path", "mr.<script>"]) {
		assert.equal((await fetch(`${base}/${encodeURIComponent(word)}`)).status, 400);
	}
	assert.equal(translations, 4); assert.equal(dictionaryCalls, 8);
});

test("actual dictionary HTTP adapters abort on timeout and return a controlled retryable error", async t => {
	const nativeFetch = global.fetch;
	let aborted = 0;
	t.mock.method(Translate.prototype, "translate", async () => [""]);
	t.mock.method(global, "fetch", (url, options) => {
		if (String(url).startsWith("http://127.0.0.1:")) return nativeFetch(url, options);
		return new Promise((resolve, reject) => options.signal.addEventListener("abort", () => {
			aborted++; reject(new Error("mock timeout"));
		}, { once: true }));
	});
	const app = express(); app.use("/dictionary", require("../routes/dictionaryRoutes"));
	app.use((error, req, res, next) => res.status(error.statusCode || 500).json({ message: error.message }));
	const server = await new Promise(resolve => { const listener = app.listen(0, "127.0.0.1", () => resolve(listener)); });
	t.after(() => new Promise(resolve => server.close(resolve)));
	const started = Date.now();
	const response = await fetch(`http://127.0.0.1:${server.address().port}/dictionary/timeoutword`);
	assert.equal(response.status, 503); assert.equal(response.headers.get("retry-after"), "5");
	assert.equal(aborted, 2); assert.ok(Date.now() - started < 3000);
	assert.equal((await response.json()).message, "Dictionary is temporarily unavailable");
});
