import { test } from "node:test";
import assert from "node:assert/strict";
import { createDialogueAttemptClient, createDialogueProgressSaveController } from "../app/_lib/dialogueProgressSave.mjs";
const info = id => ({ attemptId: id.repeat(64), expiresAt: new Date(Date.now() + 600000).toISOString(), readyAfterMs: 0 });
const response = data => ({ ok: true, status: 200, json: async () => ({ data }) });
const proof = { answers: ["find"] };

test("start is coalesced; successful saves send proof with the server-issued attempt", async t => {
	const calls = [];
	t.mock.method(globalThis, "fetch", async (url, options) => {
		calls.push({ url, options });
		return response(url.endsWith("/attempt") ? info("a") : { progress: { completedTaskIds: ["1"] } });
	});
	const attempt = createDialogueAttemptClient("/task"), signal = new AbortController().signal;
	await Promise.all([attempt.prepare(), attempt.prepare(), attempt.prepare()]);
	assert.equal(calls.length, 1);
	assert.deepEqual(await attempt.save(signal, proof), { completedTaskIds: ["1"] });
	assert.deepEqual(JSON.parse(calls[1].options.body), { ...proof, attemptId: "a".repeat(64) });
	assert.equal(calls[0].options.credentials, "include"); assert.equal(calls[1].options.credentials, "include");
});

test("failure/lost response Retry retains the answers and attempt; rapid Retry submits once", async t => {
	let starts = 0, saves = 0;
	const bodies = [];
	t.mock.method(globalThis, "fetch", async (url, options) => {
		if (url.endsWith("/attempt")) { starts++; return response(info("b")); }
		bodies.push(JSON.parse(options.body));
		if (++saves === 1) throw new Error("response lost");
		return response({ progress: { completedTaskIds: ["1"] } });
	});
	const attempt = createDialogueAttemptClient("/task");
	const controller = createDialogueProgressSaveController((signal, input) => attempt.save(signal, input));
	assert.equal(await controller.save(proof), false);
	const first = controller.save(); for (let i = 0; i < 5; i++) assert.equal(controller.save(), first);
	assert.equal(await first, true); assert.equal(starts, 1); assert.equal(saves, 2); assert.deepEqual(bodies[0], bodies[1]);
});

test("expired attempt is renewed once without making the learner repeat their answer", async t => {
	let starts = 0, saves = 0;
	t.mock.method(globalThis, "fetch", async (url, options) => {
		if (url.endsWith("/attempt")) return response(info(++starts === 1 ? "c" : "d"));
		assert.deepEqual(JSON.parse(options.body).answers, proof.answers);
		if (++saves === 1) return { ok: false, status: 409, json: async () => ({ code: "studyAttemptExpired" }) };
		return response({ progress: {} });
	});
	await createDialogueAttemptClient("/task").save(new AbortController().signal, proof);
	assert.equal(starts, 2); assert.equal(saves, 2);
});

test("navigation/account cancellation ignores a late start and never submits completion", async t => {
	let resolve, completions = 0;
	t.mock.method(globalThis, "fetch", (url) => {
		if (!url.endsWith("/attempt")) completions++;
		return new Promise(done => { resolve = done; });
	});
	const attempt = createDialogueAttemptClient("/task"), abort = new AbortController();
	const save = attempt.save(abort.signal, proof);
	abort.abort(); attempt.cancel(); resolve(response(info("a")));
	await assert.rejects(save); assert.equal(completions, 0);
});

test("a failed initial start can retry; malformed attempt confirmations never submit a reward", async t => {
	let calls = 0;
	t.mock.method(globalThis, "fetch", async () => {
		if (++calls === 1) return { ok: false, status: 429 };
		return response({ attemptId: "wrong", expiresAt: "invalid", readyAfterMs: -1 });
	});
	const attempt = createDialogueAttemptClient("/task");
	await assert.rejects(attempt.prepare()); await assert.rejects(attempt.save(new AbortController().signal, proof));
	assert.equal(calls, 2);
});
