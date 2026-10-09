import { test } from "node:test";
import assert from "node:assert/strict";
import { createDialogueProgressSaveController, saveDialogueProgress } from "../../../app/_lib/dialogueProgressSave.mjs";
import { readFileSync } from "node:fs";
function deferred() {
	let resolve, reject;
	const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
	return { promise, resolve, reject };
}
test("a slow save stays pending and repeated completions share one request; confirmed saves are not resubmitted", async () => {
	const pending = deferred(); let calls = 0, saved = 0;
	const controller = createDialogueProgressSaveController(() => { calls += 1; return pending.promise; }, { onSaved: () => saved += 1 });
	const first = controller.save();
	assert.equal(controller.getSnapshot().status, "saving");
	for (let index = 0; index < 20; index++) assert.equal(controller.save(), first);
	await Promise.resolve(); assert.equal(calls, 1);
	pending.resolve({ completedTaskIds: ["1"] });
	assert.equal(await first, true);
	assert.equal(controller.getSnapshot().status, "saved");
	assert.equal(await controller.save(), true);
	assert.equal(calls, 1); assert.equal(saved, 1);
});
test("failure → repeated Retry → success exposes persistence state and sends one retry", async () => {
	const retry = deferred(); let calls = 0;
	const controller = createDialogueProgressSaveController(() => ++calls === 1 ? Promise.reject(new Error("offline")) : retry.promise);
	assert.equal(await controller.save(), false);
	assert.equal(controller.getSnapshot().status, "error");
	const request = controller.save();
	for (let index = 0; index < 20; index++) assert.equal(controller.save(), request);
	retry.resolve({});
	assert.equal(await request, true);
	assert.equal(calls, 2);
});
test("leaving a task cancels the request and ignores a late response; cancellation is reusable under Strict Mode", async () => {
	const pending = deferred(); let saved = 0, signal;
	const controller = createDialogueProgressSaveController(value => { signal = value; return pending.promise; }, { onSaved: () => saved += 1 });
	const old = controller.save(); await Promise.resolve();
	controller.cancel(); assert.equal(signal.aborted, true);
	pending.resolve({}); assert.equal(await old, false); assert.equal(saved, 0);
	assert.equal(await controller.save(), true); assert.equal(saved, 1);
});
test("account changes invalidate pending progress UI/events", async () => {
	const pending = deferred(); let current = true, saved = 0;
	const controller = createDialogueProgressSaveController(() => pending.promise, { isCurrent: () => current, onSaved: () => saved += 1 });
	const old = controller.save(); current = false; pending.resolve({});
	assert.equal(await old, false); assert.equal(saved, 0);
	assert.equal(await controller.save(), false);
});
test("HTTP/network/confirmation failures do not report saved progress", async t => {
	for (const response of [{ ok: false }, { ok: true, json: async () => ({ data: {} }) }]) {
		const stub = t.mock.method(globalThis, "fetch", async () => response);
		await assert.rejects(saveDialogueProgress("/progress")); stub.mock.restore();
	}
	t.mock.method(globalThis, "fetch", async (url, options) => {
		assert.equal(options.method, "PATCH"); assert.equal(options.credentials, "include");
		return { ok: true, json: async () => ({ data: { progress: { completedTaskIds: ["1"] } } }) };
	});
	assert.deepEqual(await saveDialogueProgress("/progress"), { completedTaskIds: ["1"] });
});

for (const locale of ["vi", "en"]) {
	test(`${locale}: progress and dictionary persistence states have translated UI messages`, () => {
		const messages = JSON.parse(readFileSync(new URL(`../../../messages/${locale}.json`, import.meta.url)));
		for (const key of ["progressSaving", "progressNotSaved", "progressSaveFailed", "retryProgressSave", "leaveUnsavedProgress"]) {
			assert.ok(messages.DialogueFeature[key]?.trim(), key);
		}
		for (const key of ["lookupLoading", "lookupError"]) assert.ok(messages.WordlistDetail.form[key]?.trim(), key);
		for (const key of ["invalidWord", "lookupError"]) assert.ok(messages.MiniDictionary[key]?.trim(), key);
	});
}
