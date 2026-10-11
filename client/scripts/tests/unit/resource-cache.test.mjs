import assert from "node:assert/strict";
import test from "node:test";
import { createResourceCache } from "../../../app/_lib/resourceCache.mjs";
import { createAuthSessionGuard } from "../../../app/_lib/authSessionGuard.mjs";
import { createSessionRestore } from "../../../app/_lib/sessionRestore.mjs";
import { cacheVocabularyChange } from "../../../app/_lib/vocabulary.mjs";
import { resourceCache } from "../../../app/_lib/resourceCache.mjs";

function memoryStorage() {
	const values = new Map();
	return {
		get length() { return values.size; },
		key(index) { return [...values.keys()][index] ?? null; },
		getItem(key) { return values.get(key) ?? null; },
		setItem(key, value) { values.set(key, value); },
		removeItem(key) { values.delete(key); },
	};
}

test("navigation reuses one request and stale data stays visible during revalidation", async () => {
	let clock = 1_000;
	let requests = 0;
	let finish;
	const cache = createResourceCache({ now: () => clock, storage: memoryStorage });
	const fetcher = () => { requests++; return Promise.resolve(["word"]); };
	await Promise.all([
		cache.load("account-a", "vocab:all", fetcher, { staleTime: 30_000 }),
		cache.load("account-a", "vocab:all", fetcher, { staleTime: 30_000 }),
	]);
	await cache.load("account-a", "vocab:all", fetcher, { staleTime: 30_000 });
	assert.equal(requests, 1);
	clock += 30_001;
	const revalidation = cache.load("account-a", "vocab:all", () => {
		requests++;
		return new Promise(resolve => { finish = resolve; });
	}, { staleTime: 30_000 });
	await Promise.resolve();
	assert.deepEqual(cache.read("account-a", "vocab:all").data, ["word"]);
	finish(["new word"]);
	await revalidation;
	assert.equal(requests, 2);
	assert.deepEqual(cache.read("account-a", "vocab:all").data, ["new word"]);
});

test("a failed background refresh keeps usable data and a later retry can replace it", async () => {
	let clock = 1_000;
	const cache = createResourceCache({ now: () => clock, storage: memoryStorage });
	cache.write("account-a", "vocab:all", ["saved"]);
	clock += 30_001;
	await assert.rejects(cache.load("account-a", "vocab:all", () => Promise.reject(new Error("offline"))));
	assert.deepEqual(cache.read("account-a", "vocab:all").data, ["saved"]);
	await cache.load("account-a", "vocab:all", () => Promise.resolve(["fresh"]));
	assert.deepEqual(cache.read("account-a", "vocab:all").data, ["fresh"]);
});

test("refresh restores versioned data only after the cookie session confirms the same user", async () => {
	const store = memoryStorage();
	const oldTab = createResourceCache({ storage: () => store });
	oldTab.write("account-a", "progress:course", [{ completedTaskIds: [1] }], { persist: true });
	const refreshed = createResourceCache({ storage: () => store });
	const guard = createAuthSessionGuard();
	let visible = null;
	const restore = createSessionRestore({ guard,
		loadUser: async () => ({ _id: "account-a" }),
		onUser(user) { visible = refreshed.read(user._id, "progress:course", true).data; },
		onLoading() {},
	});
	assert.equal(visible, null);
	await restore.restore();
	assert.deepEqual(visible, [{ completedTaskIds: [1] }]);
	assert.equal(refreshed.read("account-b", "progress:course", true).data, undefined);
});

test("logout removes private storage and an old request cannot refill the next account", async () => {
	const store = memoryStorage();
	const cache = createResourceCache({ storage: () => store });
	cache.write("account-a", "vocab:all", ["private"], { persist: true });
	let finish;
	const oldRequest = cache.load("account-a", "progress:course", () => new Promise(resolve => { finish = resolve; }));
	await Promise.resolve();
	cache.clearUser("account-a");
	finish(["old progress"]);
	await oldRequest;
	assert.equal(cache.read("account-a", "progress:course").data, undefined);
	assert.equal(createResourceCache({ storage: () => store }).read("account-a", "vocab:all", true).data, undefined);
	assert.equal(cache.read("account-b", "vocab:all", true).data, undefined);
});

test("late review responses cannot update a later login, even for the same account", () => {
	const cache = createResourceCache({ storage: memoryStorage });
	cache.setActiveUserId("account-a");
	const oldSession = cache.captureActiveSession();
	cache.clearAllPrivate();
	cache.setActiveUserId("account-a");
	assert.equal(cache.isActiveSession(oldSession), false);
	assert.equal(cache.isActiveSession(cache.captureActiveSession()), true);
});

test("confirmed mutation wins over an older response and invalidates affected queries", async () => {
	const store = memoryStorage();
	const cache = createResourceCache({ storage: () => store });
	let finish;
	const oldRequest = cache.load("account-a", "vocab:all", () => new Promise(resolve => { finish = resolve; }));
	await Promise.resolve();
	cache.write("account-a", "vocab:all", ["saved"], { persist: true });
	finish(["stale"]);
	await oldRequest;
	assert.deepEqual(cache.read("account-a", "vocab:all").data, ["saved"]);
	cache.write("account-a", "vocab:topic:one", ["saved"], { persist: true });
	cache.invalidatePrefix("account-a", "vocab:topic:");
	assert.equal(cache.read("account-a", "vocab:topic:one").invalidated, true);
	assert.equal(createResourceCache({ storage: () => store }).read("account-a", "vocab:topic:one", true).data, undefined);
	assert.equal(cache.read("account-a", "vocab:all").invalidated, false);
});

test("confirmed vocabulary changes update both list and topic without another request", () => {
	const userId = "mutation-test-user";
	const topicId = "topic-one";
	const oldWord = { _id: "word-one", english: "old", topic: topicId };
	resourceCache.write(userId, "vocab:all", [oldWord]);
	resourceCache.write(userId, `vocab:topic:${topicId}`, [oldWord]);
	const updatedWord = { ...oldWord, english: "new" };
	cacheVocabularyChange(userId, { word: updatedWord });
	assert.equal(resourceCache.read(userId, "vocab:all").data[0].english, "new");
	assert.equal(resourceCache.read(userId, `vocab:topic:${topicId}`).data[0].english, "new");
	cacheVocabularyChange(userId, { id: "word-one", topicId, remove: true });
	assert.deepEqual(resourceCache.read(userId, "vocab:all").data, []);
	assert.deepEqual(resourceCache.read(userId, `vocab:topic:${topicId}`).data, []);
	resourceCache.clearUser(userId);
});

test("moving vocabulary updates the destination and removes it from all old topic views", () => {
	const userId = "move-test-user";
	const word = { _id: "word-one", english: "before", topic: "topic-one" };
	resourceCache.write(userId, "vocab:all", [word]);
	resourceCache.write(userId, "vocab:topic:topic-one", [word]);
	resourceCache.write(userId, "vocab:topic:topic-two", []);
	cacheVocabularyChange(userId, { topicId: "topic-one", word: { ...word, english: "after", topic: "topic-two" } });
	assert.deepEqual(resourceCache.read(userId, "vocab:topic:topic-one").data, []);
	assert.equal(resourceCache.read(userId, "vocab:topic:topic-two").data[0].english, "after");
	cacheVocabularyChange(userId, { word: { ...word, topic: null } });
	assert.deepEqual(resourceCache.read(userId, "vocab:topic:topic-two").data, []);
	resourceCache.clearUser(userId);
});

test("a superseded GET returns the confirmed mutation rather than stale data to its callers", async () => {
	const cache = createResourceCache({ storage: memoryStorage });
	let finish;
	const reading = cache.load("account-a", "vocab:all", () => new Promise(resolve => { finish = resolve; }));
	await Promise.resolve();
	cache.write("account-a", "vocab:all", ["confirmed"]);
	finish(["old"]);
	assert.deepEqual(await reading, ["confirmed"]);
});

test("mutation invalidation clears an earlier fetch error so mounted views can revalidate", async () => {
	const cache = createResourceCache({ storage: memoryStorage });
	await assert.rejects(cache.load("account-a", "leaderboard:month:current", () => Promise.reject(new Error("offline"))));
	cache.invalidate("account-a", "leaderboard:month:current");
	assert.equal(cache.read("account-a", "leaderboard:month:current").error, null);
	assert.equal(cache.read("account-a", "leaderboard:month:current").invalidated, true);
});

for (const clear of ["clearUser", "clearAllPrivate"]) {
	test(`${clear}: subscribed pages cannot restore private storage or loop while logout clears entries`, () => {
		const store = memoryStorage(), cache = createResourceCache({ storage: () => store });
		cache.write("account-a", "vocab:all", ["private"], { persist: true });
		let notices = 0;
		const observed = [];
		cache.subscribe("account-a", "vocab:all", () => {
			// Bound the old bug so this regression fails instead of hanging Node.
			if (++notices < 4) observed.push(cache.read("account-a", "vocab:all", true).data);
		});
		cache[clear]("account-a");
		assert.equal(notices, 1);
		assert.deepEqual(observed, [undefined]);
		assert.equal(cache.read("account-a", "vocab:all", true).data, undefined);
	});
}
