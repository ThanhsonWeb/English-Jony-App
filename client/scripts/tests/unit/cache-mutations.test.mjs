import assert from "node:assert/strict";
import test from "node:test";
import { createResourceCache } from "../../../app/_lib/resourceCache.mjs";
import { createVocabularyMutationClient } from "../../../app/_lib/vocabularyMutation.mjs";
import { cacheStudyProgress } from "../../../app/_lib/cacheStudyProgress.mjs";

function storage() {
	const values = new Map();
	return { get length() { return values.size; }, key: index => [...values.keys()][index],
		getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
}
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }
function fixture() {
	const store = storage(), cache = createResourceCache({ storage: () => store });
	cache.setActiveUserId("account-a");
	cache.write("account-a", "vocab:all", [], { persist: true });
	cache.write("account-a", "vocab:topic:one", [], { persist: true });
	return { cache, store };
}
const ok = word => ({ ok: true, status: 200, json: async () => ({ data: { updatedVocab: word } }) });
const baseWord = { _id: "word-one", english: "hello", vietnamese: "xin chao", topic: "one", user: "account-a", reviewCount: 0 };

test("add/edit/delete use only server-confirmed fields in list, topic and refreshed storage", async () => {
	const { cache, store } = fixture();
	let confirmed = baseWord;
	const mutate = createVocabularyMutationClient({ cache, request: async () => ok(confirmed) });
	await mutate({ method: "POST", body: baseWord });
	confirmed = { ...baseWord, english: "server-trimmed", reviewCount: 3, status: true };
	await mutate({ id: baseWord._id, body: { english: "input  " } });
	for (const key of ["vocab:all", "vocab:topic:one"]) {
		assert.deepEqual(cache.read("account-a", key).data, [confirmed]);
		assert.deepEqual(createResourceCache({ storage: () => store }).read("account-a", key, true).data, [confirmed]);
	}
	await mutate({ id: baseWord._id, method: "DELETE" });
	assert.deepEqual(cache.read("account-a", "vocab:all").data, []);
	assert.deepEqual(cache.read("account-a", "vocab:topic:one").data, []);
});

test("rapid edits and delete of the same word save in invocation order without older responses winning", async () => {
	const { cache } = fixture(), held = deferred(), requests = [];
	const mutate = createVocabularyMutationClient({ cache, request: async (url, options) => {
		requests.push(options.method);
		if (requests.length === 1) await held.promise;
		return ok({ ...baseWord, english: JSON.parse(options.body || "{}").english });
	} });
	const first = mutate({ id: baseWord._id, body: { english: "first" } });
	const second = mutate({ id: baseWord._id, body: { english: "second" } });
	const deleting = mutate({ id: baseWord._id, method: "DELETE" });
	await new Promise(resolve => setImmediate(resolve));
	assert.deepEqual(requests, ["PATCH"]);
	assert.deepEqual(cache.read("account-a", "vocab:all").data, []);
	held.resolve();
	await Promise.all([first, second, deleting]);
	assert.deepEqual(requests, ["PATCH", "PATCH", "DELETE"]);
	assert.deepEqual(cache.read("account-a", "vocab:all").data, []);
});

for (const failure of ["network", "http", "malformed"]) {
	test(`${failure} save never writes an unconfirmed word and does not block a later edit`, async () => {
		const { cache } = fixture();
		let fail = true;
		const mutate = createVocabularyMutationClient({ cache, request: async () => {
			if (!fail) return ok(baseWord);
			if (failure === "network") throw new Error("offline");
			return failure === "http" ? { ok: false, status: 500 } : { ok: true, json: async () => ({ data: {} }) };
		} });
		await assert.rejects(mutate({ method: "POST", body: baseWord }));
		assert.deepEqual(cache.read("account-a", "vocab:all").data, []);
		fail = false;
		await mutate({ method: "POST", body: baseWord });
		assert.deepEqual(cache.read("account-a", "vocab:all").data, [baseWord]);
	});
}

for (const nextAccount of ["account-b", "account-a"]) {
	test(`logout and login as ${nextAccount} rejects late results and queued edits`, async () => {
		const { cache, store } = fixture(), held = deferred();
		let requests = 0;
		const mutate = createVocabularyMutationClient({ cache, request: async () => { requests++; await held.promise; return ok(baseWord); } });
		const first = mutate({ id: baseWord._id, body: baseWord });
		const queued = mutate({ id: baseWord._id, body: baseWord });
		const results = Promise.allSettled([first, queued]);
		await new Promise(resolve => setImmediate(resolve));
		cache.clearAllPrivate();
		cache.setActiveUserId(nextAccount);
		held.resolve();
		assert.ok((await results).every(result => result.status === "rejected"));
		assert.equal(requests, 1);
		assert.equal(cache.read(nextAccount, "vocab:all", true).data, undefined);
		assert.equal(createResourceCache({ storage: () => store }).read("account-a", "vocab:all", true).data, undefined);
	});
}

test("expired session clears private cache while an unrelated late failure cannot clear the new user", async () => {
	const { cache } = fixture(), held = deferred();
	const mutate = createVocabularyMutationClient({ cache, request: async () => { await held.promise; return { ok: false, status: 401 }; } });
	const saving = mutate({ method: "POST", body: baseWord });
	const rejected = assert.rejects(saving);
	await new Promise(resolve => setImmediate(resolve));
	cache.clearAllPrivate(); cache.setActiveUserId("account-b");
	cache.write("account-b", "vocab:all", ["private-b"]);
	held.resolve(); await rejected;
	assert.deepEqual(cache.read("account-b", "vocab:all").data, ["private-b"]);
	await assert.rejects(mutate({ method: "POST", body: baseWord }));
	assert.equal(cache.read("account-b", "vocab:all").data, undefined);
});

test("review confirmation updates review status and invalidates XP/streak/activity without inventing rewards", async () => {
	const { cache } = fixture();
	cache.write("account-a", "leaderboard:month:current", { totalXp: 0, streakDays: 0 });
	cache.write("account-a", "study-activities", []);
	const reviewed = { ...baseWord, reviewCount: 1, status: true, nextReview: "2099-01-01" };
	const mutate = createVocabularyMutationClient({ cache, request: async () => ok(reviewed) });
	await mutate({ id: baseWord._id, method: "POST", review: true, body: { rating: "easy" } });
	assert.deepEqual(cache.read("account-a", "vocab:all").data, [reviewed]);
	assert.equal(cache.read("account-a", "leaderboard:month:current").invalidated, true);
	assert.equal(cache.read("account-a", "study-activities").invalidated, true);
	assert.equal(cache.read("account-a", "leaderboard:month:current").data.totalXp, 0);
});

for (const lessonId of ["asking-for-directions", "grateful"]) {
	test(`${lessonId}: confirmed progress updates catalogue and course, survives refresh and never regresses`, () => {
		const { cache, store } = fixture();
		cache.write("account-a", "progress:catalogue", { [lessonId]: [] }, { persist: true });
		cache.write("account-a", "leaderboard:month:current", { xp: 0 });
		cache.write("account-a", "study-activities", []);
		const progress = { lessonId, dialogueId: "first", completedTaskIds: ["1", "2"], updatedAt: "2026-10-11T02:00:00Z", lastTaskId: "2" };
		cacheStudyProgress("account-a", progress, cache);
		cacheStudyProgress("account-a", { ...progress, completedTaskIds: ["1"], lastTaskId: "1", updatedAt: "2026-10-11T01:00:00Z" }, cache);
		for (const target of [cache, createResourceCache({ storage: () => store })]) {
			assert.deepEqual(target.read("account-a", `progress:${lessonId}`, true).data[0].completedTaskIds, ["1", "2"]);
			assert.equal(target.read("account-a", "progress:catalogue", true).data[lessonId][0].lastTaskId, "2");
		}
		assert.equal(cache.read("account-a", "leaderboard:month:current").invalidated, true);
		assert.equal(cache.read("account-a", "study-activities").invalidated, true);
	});
}
