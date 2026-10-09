import { test } from "node:test";
import assert from "node:assert/strict";
import { createLatestDictionaryLookup, lookupDictionaryWord } from "../../../app/_lib/latestDictionaryLookup.mjs";
function deferred() {
	let resolve, reject;
	const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
	return { promise, resolve, reject };
}
function harness() {
	const requests = [], results = [], errors = [], loading = [];
	const controller = createLatestDictionaryLookup({
		lookup(word, signal) { const pending = deferred(); requests.push({ word, signal, ...pending }); return pending.promise; },
		onResult: data => results.push(data), onError: error => errors.push(error), onLoading: state => loading.push(state),
	});
	return { controller, requests, results, errors, loading };
}
for (const order of [[0, 1], [1, 0]]) {
	test(`apple → book responses ${order.join(" then ")}: only book updates all lookup fields`, async () => {
		const h = harness();
		const promises = [h.controller.run("apple"), h.controller.run("book")];
		assert.equal(h.requests[0].signal.aborted, true);
		for (const index of order) {
			h.requests[index].resolve({ vietnamese: `${h.requests[index].word}-meaning`, pronunciation: `${index}-ipa`, example: `${index}-example` });
			await promises[index];
			if (index === 0 && order[0] === 0) assert.equal(h.loading.at(-1), true);
		}
		assert.deepEqual(h.results, [{ vietnamese: "book-meaning", pronunciation: "1-ipa", example: "1-example" }]);
		assert.equal(h.loading.at(-1), false);
		assert.ok(!h.errors.includes(true));
	});
}
test("a stale failure cannot change the latest loading or error state", async () => {
	const h = harness();
	const old = h.controller.run("apple"), latest = h.controller.run("book");
	h.requests[0].reject(new Error("stale failure"));
	await old;
	assert.equal(h.loading.at(-1), true);
	assert.equal(h.errors.at(-1), false);
	h.requests[1].resolve({ vietnamese: "book" });
	await latest;
	assert.equal(h.loading.at(-1), false);
});
test("repeated selection of the same word still uses request identity", async () => {
	const h = harness();
	const old = h.controller.run("apple"), latest = h.controller.run("apple");
	h.requests[1].resolve({ vietnamese: "latest" }); await latest;
	h.requests[0].resolve({ vietnamese: "stale" }); await old;
	assert.deepEqual(h.results, [{ vietnamese: "latest" }]);
});
test("editing the input, closing, or unmounting cancels late field/error updates", async () => {
	for (const notify of [true, false]) {
		const h = harness();
		const old = h.controller.run("apple");
		h.controller.cancel(notify);
		h.requests[0].resolve({ vietnamese: "stale" }); await old;
		assert.deepEqual(h.results, []);
		assert.equal(h.requests[0].signal.aborted, true);
	}
});
test("latest failures show an error and finish loading; repeated selection can recover", async () => {
	const h = harness();
	const failed = h.controller.run("apple");
	h.requests[0].reject(new Error("offline")); await failed;
	assert.equal(h.errors.at(-1), true);
	assert.equal(h.loading.at(-1), false);
	const retry = h.controller.run("apple");
	assert.equal(h.errors.at(-1), false);
	h.requests[1].resolve({ vietnamese: "recovered" }); await retry;
	assert.deepEqual(h.results, [{ vietnamese: "recovered" }]);
});
test("HTTP errors are rejected rather than treated as successful autofill", async t => {
	t.mock.method(globalThis, "fetch", async () => ({ ok: false }));
	await assert.rejects(lookupDictionaryWord("apple"), /lookup failed/);
});
