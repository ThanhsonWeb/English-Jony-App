import { test } from "node:test";
import assert from "node:assert/strict";
import { createDialogueProgressQueue, progressQueuePrefix } from "../../../app/_lib/dialogueProgressQueue.mjs";

const path = id => `/api/v1/dialogue-progress/grateful/helping-in-return/tasks/${id}`;
const proof = { answers: ["thank you"] };
const response = data => ({ ok: true, status: 200, json: async () => ({ data }) });
const attemptInfo = id => ({ attemptId: id.repeat(64), expiresAt: new Date(Date.now() + 600000).toISOString(), readyAfterMs: 0 });
function deferred() {
	let resolve, reject;
	const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
	return { promise, resolve, reject };
}
async function until(condition) {
	const deadline = Date.now() + 3000;
	while (!condition()) {
		assert.ok(Date.now() < deadline, "Timed out waiting for queue state");
		await new Promise(resolve => setTimeout(resolve, 5));
	}
}
function memoryStorage() {
	const items = new Map();
	return { get length() { return items.size; }, key: index => [...items.keys()][index] ?? null,
		getItem: key => items.get(key) ?? null, setItem: (key, value) => items.set(key, value), items };
}
function serialLocks() {
	let tail = Promise.resolve();
	return { request(name, { signal }, work) {
		const result = tail.then(() => { if (signal.aborted) throw new Error("Aborted lock"); return work(); });
		tail = result.catch(() => {});
		return result;
	} };
}
function fixture(t, options = {}) {
	const store = options.store || memoryStorage(), locks = options.manager || serialLocks();
	const queue = createDialogueProgressQueue({ userId: "account-a", storage: () => store, locks: () => locks,
		retryDelay: 20, requestTimeout: 1000, ...options });
	t.after(() => queue.stop());
	queue.start();
	return { queue, store, locks };
}
function fetchStub(t, save) {
	let starts = 0;
	t.mock.method(globalThis, "fetch", async (url, options) => url.endsWith("/attempt")
		? response(attemptInfo((++starts % 16).toString(16))) : save(url, options));
	return () => starts;
}

test("slow network: durable acceptance is immediate; rapid tasks save in order without duplicates", async t => {
	const held = deferred(), writes = [], confirmed = [];
	fetchStub(t, async (url, options) => {
		writes.push({ url, input: JSON.parse(options.body) });
		assert.equal(options.headers["X-StudyJony-Progress-User"], "account-a");
		if (writes.length === 1) await held.promise;
		return response({ progress: { completedTaskIds: [url.split("/").at(-1)] } });
	});
	const { queue, store } = fixture(t, { onSaved: progress => confirmed.push(progress) });
	assert.equal(queue.getSnapshot().requiresAttention, false);
	for (let id = 1; id <= 4; id++) assert.equal(queue.enqueue(path(id), proof), true);
	for (let repeat = 0; repeat < 10; repeat++) queue.enqueue(path(1), proof);
	assert.equal(queue.getSnapshot().pendingCount, 4); assert.equal(queue.getSnapshot().canLeave, true);
	await until(() => writes.length === 1);
	assert.equal(confirmed.length, 0); assert.equal(queue.getTask(path(1)).status, "saving");
	assert.equal(queue.getSnapshot().requiresAttention, false, "A slow durable save stays silent before confirmation");
	assert.deepEqual(JSON.parse(store.getItem(progressQueuePrefix("account-a") + encodeURIComponent(path(1)))).input, proof);
	held.resolve();
	await until(() => queue.getSnapshot().pendingCount === 0);
	assert.deepEqual(writes.map(write => write.url), [1, 2, 3, 4].map(path));
	assert.equal(confirmed.length, 4);
	assert.equal(queue.getSnapshot().requiresAttention, false);
});

test("temporary failure retries the identical proof and attempt; later tasks cannot overtake it", async t => {
	const writes = [];
	const starts = fetchStub(t, async (url, options) => {
		writes.push({ url, input: JSON.parse(options.body) });
		if (writes.length === 1) throw new Error("Connection lost after commit");
		return response({ progress: { completedTaskIds: [url.split("/").at(-1)] } });
	});
	const { queue } = fixture(t);
	queue.enqueue(path(1), proof); queue.enqueue(path(2), proof);
	await until(() => queue.getSnapshot().status === "error");
	assert.equal(queue.getSnapshot().canLeave, true);
	assert.equal(queue.getSnapshot().requiresAttention, false, "Automatic retries stay silent");
	await until(() => queue.getSnapshot().pendingCount === 0);
	assert.deepEqual(writes.map(write => write.url), [path(1), path(1), path(2)]);
	assert.deepEqual(writes[0].input, writes[1].input); assert.equal(starts(), 2);
});

test("refresh/leaving after a lost response restores the same attempt without a second reward proof", async t => {
	const held = deferred(), writes = [], saved = [];
	const starts = fetchStub(t, async (url, options) => {
		writes.push(JSON.parse(options.body));
		if (writes.length === 1) return held.promise;
		return response({ progress: { completedTaskIds: ["1"] } });
	});
	const first = fixture(t, { onSaved: progress => saved.push(progress) });
	first.queue.enqueue(path(1), proof);
	await until(() => writes.length === 1);
	first.queue.stop();
	held.resolve(response({ progress: { completedTaskIds: ["1"] } }));
	await new Promise(resolve => setTimeout(resolve, 5));
	assert.equal(saved.length, 0, "Late response cannot publish after the session/page stops");
	const second = fixture(t, { store: first.store, manager: first.locks });
	await until(() => second.queue.getSnapshot().pendingCount === 0);
	assert.equal(writes.length, 2); assert.equal(starts(), 1); assert.deepEqual(writes[0], writes[1]);
});

test("completion queued before the provider starts is durable and drains when started", async t => {
	fetchStub(t, async () => response({ progress: { completedTaskIds: ["1"] } }));
	const { queue } = fixture(t); queue.stop();
	assert.equal(queue.enqueue(path(1), proof), true);
	queue.start(); await until(() => queue.getSnapshot().pendingCount === 0);
});

test("terminal failures remain visible and durable; rapid manual retries send one request", async t => {
	let writes = 0, fail = true;
	fetchStub(t, async () => {
		writes++;
		return fail ? { ok: false, status: 403 } : response({ progress: { completedTaskIds: ["1"] } });
	});
	const { queue } = fixture(t);
	queue.enqueue(path(1), proof); await until(() => queue.getSnapshot().status === "error");
	assert.equal(await queue.waitForTask(path(1)), false);
	assert.equal(queue.getSnapshot().requiresAttention, true, "A failure without automatic retry requires attention");
	await new Promise(resolve => setTimeout(resolve, 40)); assert.equal(writes, 1);
	fail = false;
	for (let repeat = 0; repeat < 20; repeat++) queue.retry();
	await until(() => queue.getSnapshot().pendingCount === 0); assert.equal(writes, 2);
	assert.equal(queue.getSnapshot().requiresAttention, false);
});

for (const mode of ["quota", "no-locks", "refused-lock"]) {
	test(`${mode}: fallback requires server confirmation before leaving`, async t => {
		const held = deferred(); let writes = 0;
		fetchStub(t, async () => { writes++; await held.promise; return response({ progress: { completedTaskIds: ["1"] } }); });
		const store = memoryStorage();
		if (mode === "quota") store.setItem = () => { throw new Error("Quota exceeded"); };
		const locks = mode === "no-locks" ? null : mode === "refused-lock" ? { request: async () => { throw new Error("Lock refused"); } } : serialLocks();
		const { queue } = fixture(t, { store, locks: () => locks });
		queue.enqueue(path(1), proof);
		await until(() => writes === 1);
		assert.equal(queue.getSnapshot().canLeave, false);
		assert.equal(queue.getSnapshot().requiresAttention, true, "Unsafe device storage must stay visible");
		const confirmation = queue.waitForTask(path(1));
		held.resolve(); assert.equal(await confirmation, true);
		assert.equal(queue.getSnapshot().canLeave, true);
		assert.equal(queue.getSnapshot().requiresAttention, false);
	});
}

test("two tabs use one lock and reuse the stored completion instead of sending duplicates", async t => {
	const held = deferred(); let writes = 0;
	fetchStub(t, async () => { writes++; await held.promise; return response({ progress: { completedTaskIds: ["1"] } }); });
	const first = fixture(t);
	first.queue.enqueue(path(1), proof); await until(() => writes === 1);
	const second = fixture(t, { store: first.store, manager: first.locks });
	second.queue.enqueue(path(1), proof); held.resolve();
	await until(() => first.queue.getSnapshot().pendingCount === 0 && second.queue.getSnapshot().pendingCount === 0);
	assert.equal(writes, 1);
});

test("changing accounts leaves the original queue intact and ignores late confirmation", async t => {
	const held = deferred(); let current = true, confirmed = 0, writes = 0;
	fetchStub(t, async () => { writes++; return held.promise; });
	const first = fixture(t, { isCurrent: () => current, onSaved: () => confirmed++ });
	first.queue.enqueue(path(1), proof); await until(() => writes === 1);
	current = false; first.queue.stop();
	const second = fixture(t, { userId: "account-b", store: first.store });
	assert.equal(second.queue.getSnapshot().pendingCount, 0);
	held.resolve(response({ progress: { completedTaskIds: ["1"] } }));
	await new Promise(resolve => setTimeout(resolve, 10)); assert.equal(confirmed, 0); assert.equal(writes, 1);
	assert.ok([...first.store.items.keys()].every(key => key.startsWith(progressQueuePrefix("account-a"))));
});

test("a 200 response without the specific task/account confirmation is never marked saved", async t => {
	let calls = 0;
	fetchStub(t, async () => response({ progress: ++calls === 1 ? { completedTaskIds: ["2"] } : { user: "account-b", completedTaskIds: ["1"] } }));
	const { queue, store } = fixture(t, { retryDelay: 1000 });
	queue.enqueue(path(1), proof); await until(() => queue.getSnapshot().status === "error");
	assert.notEqual(queue.getTask(path(1)).status, "saved");
	queue.retry(); await until(() => calls === 2 && queue.getSnapshot().status === "error");
	assert.notEqual(JSON.parse([...store.items.values()][0]).status, "saved");
});

test("request timeout retries safely; expired attempts renew while retaining the checked answer", async t => {
	let writes = 0, starts = 0;
	t.mock.method(globalThis, "fetch", async (url, options) => {
		if (url.endsWith("/attempt")) return response(attemptInfo((++starts).toString(16)));
		assert.deepEqual(JSON.parse(options.body).answers, proof.answers);
		if (++writes === 1) return new Promise((resolve, reject) => options.signal.addEventListener("abort", () => reject(new Error("Timed out")), { once: true }));
		if (writes === 2) return { ok: false, status: 409, json: async () => ({ code: "studyAttemptExpired" }) };
		return response({ progress: { completedTaskIds: ["1"] } });
	});
	const { queue } = fixture(t, { requestTimeout: 60 });
	queue.enqueue(path(1), proof); await until(() => queue.getSnapshot().pendingCount === 0);
	assert.equal(starts, 2); assert.equal(writes, 3);
});

test("revisiting a confirmed exercise obtains a fresh attempt while observer errors cannot undo confirmation", async t => {
	const starts = fetchStub(t, async () => response({ progress: { completedTaskIds: ["1"] } }));
	const { queue } = fixture(t, { onSaved: () => { throw new Error("Observer failed"); } });
	queue.enqueue(path(1), proof); await until(() => queue.getSnapshot().pendingCount === 0);
	queue.beginTask(path(1)); await queue.prepare(path(1));
	queue.enqueue(path(1), proof); await until(() => queue.getSnapshot().pendingCount === 0);
	assert.equal(starts(), 2);
});

test("a corrupt saved record is reported while other completed tasks still recover", async t => {
	const held = deferred();
	fetchStub(t, async () => { await held.promise; return response({ progress: { completedTaskIds: ["1"] } }); });
	const first = fixture(t); first.queue.stop(); first.queue.enqueue(path(1), proof);
	const store = memoryStorage();
	store.setItem(progressQueuePrefix("account-a") + "bad-record", "{broken");
	for (const [key, value] of first.store.items) store.setItem(key, value);
	const { queue } = fixture(t, { store });
	assert.equal(queue.getSnapshot().storageError, true);
	assert.equal(queue.getSnapshot().requiresAttention, true);
	assert.equal(queue.getSnapshot().pendingCount, 1);
	assert.equal(queue.getSnapshot().canLeave, false);
	held.resolve(); await until(() => queue.getSnapshot().pendingCount === 0);
	assert.equal(queue.getTask(path(1)).status, "saved");
	assert.equal(queue.getSnapshot().status, "error", "Unrecoverable stored work must remain visible");
	assert.equal(queue.getSnapshot().requiresAttention, true);
});

test("opening a queued task in another tab cannot create or overwrite its pending attempt", async t => {
	const held = deferred(); let starts = 0;
	t.mock.method(globalThis, "fetch", async url => {
		if (url.endsWith("/attempt")) { starts++; await held.promise; return response(attemptInfo("a")); }
		return response({ progress: { completedTaskIds: ["1"] } });
	});
	const first = fixture(t);
	const prepared = first.queue.prepare(path(1)); first.queue.enqueue(path(1), proof);
	const second = fixture(t, { store: first.store, manager: first.locks });
	await second.queue.prepare(path(1)); assert.equal(starts, 1);
	held.resolve(); await prepared;
	await until(() => first.queue.getSnapshot().pendingCount === 0 && second.queue.getSnapshot().pendingCount === 0);
	assert.equal(starts, 1);
});

test("tasks from another tab remain FIFO even when the clock moves backwards", async t => {
	const held = deferred(), writes = [];
	fetchStub(t, async url => {
		writes.push(url); if (writes.length === 1) await held.promise;
		return response({ progress: { completedTaskIds: [url.split("/").at(-1)] } });
	});
	const first = fixture(t, { now: () => 1000 });
	first.queue.enqueue(path(1), proof); first.queue.enqueue(path(2), proof);
	await until(() => writes.length === 1);
	const second = fixture(t, { store: first.store, manager: first.locks, now: () => 500 });
	second.queue.enqueue(path(3), proof); held.resolve();
	await until(() => writes.length === 3 && second.queue.getSnapshot().pendingCount === 0);
	assert.deepEqual(writes, [path(1), path(2), path(3)]);
});

test("a waiting tab reloads a proof created after it read the queue, including lost-response retries", async t => {
	const held = deferred(), writes = []; let starts = 0;
	t.mock.method(globalThis, "fetch", async (url, options) => {
		if (url.endsWith("/attempt")) { starts++; await held.promise; return response(attemptInfo(starts.toString(16))); }
		writes.push(JSON.parse(options.body));
		if (writes.length === 1) throw new Error("Reply lost after commit");
		return response({ progress: { completedTaskIds: ["1"] } });
	});
	const first = fixture(t, { retryDelay: 1000 });
	first.queue.enqueue(path(1), proof);
	await until(() => starts === 1);
	const second = fixture(t, { store: first.store, manager: first.locks });
	assert.equal(second.queue.getTask(path(1)).attempt, undefined);
	held.resolve(); await until(() => first.queue.getSnapshot().status === "error");
	first.queue.stop();
	await until(() => second.queue.getSnapshot().pendingCount === 0);
	assert.equal(starts, 1); assert.equal(writes.length, 2); assert.deepEqual(writes[0], writes[1]);
});
