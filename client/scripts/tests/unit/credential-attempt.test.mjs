import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createAuthSessionGuard } from "../../../app/_lib/authSessionGuard.mjs";
import { createCredentialAttempt } from "../../../app/_lib/credentialAttempt.mjs";
import { createSessionRestore } from "../../../app/_lib/sessionRestore.mjs";
import { submitCredential } from "../../../app/_lib/credentialSubmission.mjs";
import { getAuthErrorMessage } from "../../../app/_lib/authErrorMessage.js";

const A = { _id: "A", name: "Account A" }, B = { _id: "B", name: "Account B" };
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }
function setup() {
	const guard = createAuthSessionGuard(), users = [], selections = [], navigations = [];
	let id = 0;
	const controller = createCredentialAttempt({
		guard, createId: () => (++id).toString(16).padStart(32, "0"),
		selectSession: value => { selections.push(value); return true; }, onUser: user => users.push(user),
	});
	async function finish(attempt, response) {
		const user = await response;
		if (controller.commit(attempt, { user })) navigations.push(user._id);
	}
	return { guard, users, selections, navigations, controller, finish };
}
for (const kind of ["login", "signup"]) {
	test(`${kind}: slow A then successful B; late A never selects a cookie, changes user or navigates`, async () => {
		const c = setup(), a = c.controller.begin(), delayed = deferred(), old = c.finish(a, delayed.promise);
		const b = c.controller.begin();
		assert.equal(a.signal.aborted, true);
		await c.finish(b, Promise.resolve(B));
		delayed.resolve(A); await old;
		assert.equal(c.guard.getUser(), B);
		assert.deepEqual(c.selections, [b.id]); assert.deepEqual(c.users, [B]); assert.deepEqual(c.navigations, ["B"]);
	});
	for (const replacement of ["logout", "Google", "navigation", "new generation"]) {
		test(`${kind}: ${replacement} invalidates A even when a mock ignores AbortSignal`, async () => {
			const c = setup(), a = c.controller.begin(), delayed = deferred(), old = c.finish(a, delayed.promise);
			if (replacement === "navigation") c.controller.cancel(a);
			else if (replacement === "new generation") c.guard.start(B);
			else { c.controller.invalidate(); c.guard.start(replacement === "Google" ? B : null); }
			delayed.resolve(A); await old;
			assert.equal(c.guard.getUser(), ["Google", "new generation"].includes(replacement) ? B : null);
			assert.deepEqual(c.selections, []); assert.deepEqual(c.users, []); assert.deepEqual(c.navigations, []);
		});
	}
}
test("three rapid attempts accept only the latest; an old cancellation cannot cancel the newer form", () => {
	const c = setup(), first = c.controller.begin(), second = c.controller.begin(), last = c.controller.begin();
	c.controller.cancel(first);
	assert.equal(c.controller.commit(first, { user: A }), false);
	assert.equal(c.controller.commit(second, { user: A }), false);
	assert.equal(c.controller.commit(last, { user: B }), true);
	assert.equal(c.controller.commit(last, { user: A }), false);
	assert.deepEqual(c.users, [B]); assert.deepEqual(c.selections, [last.id]);
});
test("cookies blocked: no visible login or navigation can be committed", () => {
	const guard = createAuthSessionGuard(), users = [];
	const controller = createCredentialAttempt({ guard, selectSession: () => false, onUser: user => users.push(user) });
	assert.equal(controller.commit(controller.begin(), { user: A }), false);
	assert.deepEqual(users, []); assert.equal(guard.getUser(), null);
});
test("credential begin invalidates old profile mutations and cancellation keeps the existing account", () => {
	const c = setup(); c.guard.start(B);
	const previous = c.guard.capture(), attempt = c.controller.begin();
	assert.equal(c.guard.updateForSession({ ...B, name: "stale" }, previous), false);
	c.controller.cancel(attempt); assert.equal(c.guard.getUser(), B);
});
test("OAuth restoration can replace pending credentials while retaining the restore generation guards", async () => {
	const c = setup(), a = c.controller.begin();
	const restore = createSessionRestore({ guard: c.guard, loadUser: async () => B, onUser: () => {}, onLoading: () => {} });
	const result = await restore.restore("oauth");
	assert.equal(result.status, "success"); assert.equal(c.guard.isCurrent(result.session), true);
	assert.equal(c.controller.commit(a, { user: A }), false); assert.equal(c.guard.getUser(), B);
});
for (const action of ["new login", "logout", "Google", "newer failed login"]) test(`shared browser intent: another document's ${action} prevents old A from selecting or navigating`, () => {
	let intent;
	const registerIntent = id => { intent = id; return true; }, isCurrentIntent = id => intent === id;
	const selections = [], users = [];
	const first = createCredentialAttempt({ guard: createAuthSessionGuard(), registerIntent, isCurrentIntent,
		selectSession: id => { selections.push(id); return true; }, onUser: user => users.push(user) });
	const other = createCredentialAttempt({ guard: createAuthSessionGuard(), registerIntent, isCurrentIntent,
		selectSession: id => { selections.push(id); return true; }, onUser: user => users.push(user) });
	const a = first.begin();
	if (action.includes("login")) {
		const b = other.begin();
		if (action === "new login") assert.equal(other.commit(b, { user: B }), true);
		else other.cancel(b);
	} else intent = `fresh-${action}`;
	assert.equal(first.commit(a, { user: A }), false);
	assert.deepEqual(users, action === "new login" ? [B] : []);
});
for (const locale of ["vi", "en"]) {
	const messages = JSON.parse(readFileSync(new URL(`../../../messages/${locale}.json`, import.meta.url))).Auth;
	const t = key => messages[key];
	test(`${locale}: generic signup rejection is localized without email disclosure`, () => {
		assert.equal(getAuthErrorMessage({ code: "signupUnavailable", message: "private backend details" }, t, "signupFailed"), t("signupUnavailable"));
		assert.ok(t("signupUnavailable"));
		assert.doesNotMatch(t("signupUnavailable"), /already in use|đã được sử dụng/);
	});
	test(`${locale}: credential signup carries the generic rejection code into its user feedback`, async context => {
		const attempt = setup().controller.begin();
		context.mock.method(globalThis, "fetch", async () => ({ ok: false, status: 400,
			json: async () => ({ status: "fail", code: "signupUnavailable", message: "private details" }) }));
		assert.deepEqual(await submitCredential("signup", {}, t, attempt), { error: t("signupUnavailable") });
	});
	for (const kind of ["login", "signup"]) test(`${locale}: ${kind} uses the isolated route, signal and response identity`, async context => {
		const attempt = setup().controller.begin();
		context.mock.method(globalThis, "fetch", async (url, options) => {
			assert.equal(url, `/api/v1/auth/credentials/${kind}`);
			assert.equal(options.credentials, "include"); assert.equal(options.signal, attempt.signal);
			assert.equal(options.headers["X-StudyJony-Auth-Attempt"], attempt.id);
			return { ok: true, status: 200, json: async () => ({ status: "success", data: { user: A, credentialAttempt: attempt.id } }) };
		});
		assert.deepEqual(await submitCredential(kind, { email: "test@example.test" }, t, attempt), { user: A });
	});
	test(`${locale}: a late failed request cannot surface errors over B's successful attempt`, async context => {
		const c = setup(), old = c.controller.begin(), delayed = deferred(), errors = [];
		context.mock.method(globalThis, "fetch", () => delayed.promise);
		const pending = submitCredential("login", {}, t, old).then(result => {
			if (c.controller.isCurrent(old) && result.error) errors.push(result.error);
		});
		const b = c.controller.begin(); c.controller.commit(b, { user: B });
		delayed.resolve({ ok: false, status: 401, json: async () => ({ status: "fail" }) }); await pending;
		assert.deepEqual(errors, []); assert.equal(c.guard.getUser(), B);
	});
	test(`${locale}: missing/mismatched attempt echo and malformed signup fail safely; retry works`, async context => {
		const attempt = setup().controller.begin();
		let response = { status: "success", data: { user: A, credentialAttempt: "wrong" } };
		context.mock.method(globalThis, "fetch", async () => ({ ok: true, status: 201, json: async () => response }));
		assert.deepEqual(await submitCredential("signup", {}, t, attempt), { error: t("signupFailed") });
		response = null;
		assert.deepEqual(await submitCredential("signup", {}, t, attempt), { error: t("signupFailed") });
		response = { status: "success", data: { user: A, credentialAttempt: attempt.id } };
		assert.deepEqual(await submitCredential("signup", {}, t, attempt), { user: A });
		assert.deepEqual(await submitCredential("login", {}, t), { error: t("loginFailed") });
	});
}
