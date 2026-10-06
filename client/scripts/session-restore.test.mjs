import assert from "node:assert/strict";
import test from "node:test";
import { createAuthSessionGuard } from "../app/_lib/authSessionGuard.mjs";
import { createSessionRestore } from "../app/_lib/sessionRestore.mjs";

const A = { _id: "A", name: "Account A" };
const B = { _id: "B", name: "Account B" };
const tick = () => Promise.resolve();
function setup(user = null) {
	const guard = createAuthSessionGuard();
	if (user) guard.start(user);
	const reads = [], writes = [], loading = [];
	const controller = createSessionRestore({
		guard, onUser: user => writes.push(user), onLoading: value => loading.push(value),
		loadUser: signal => new Promise((resolve, reject) => reads.push({ signal, resolve, reject })),
	});
	function replace(user) { controller.invalidate(); guard.start(user); }
	return { guard, controller, reads, writes, loading, replace };
}
test("OAuth starts first: initial restore and repeated callbacks share one read/write", async () => {
	const c = setup();
	const callback = c.controller.restore("oauth");
	assert.equal(c.controller.restore(), callback);
	assert.equal(c.controller.restore("oauth"), callback);
	await tick(); assert.equal(c.reads.length, 1);
	c.reads[0].resolve(B);
	const result = await callback;
	assert.equal(result.status, "success"); assert.equal(result.user, B);
	assert.equal(c.guard.isCurrent(result.session), true);
	assert.deepEqual(c.writes, [B]); assert.deepEqual(c.loading, [true, false]);
});
test("initial restore starts first: OAuth replaces it before any old HTTP read is sent", async () => {
	const c = setup();
	const initial = c.controller.restore();
	const callback = c.controller.restore("oauth");
	assert.equal(c.controller.restore(), callback);
	await tick(); assert.equal(c.reads.length, 1);
	c.reads[0].resolve(B);
	assert.equal((await initial).status, "stale");
	assert.equal((await callback).status, "success"); assert.deepEqual(c.writes, [B]);
});
for (const order of ["old-first", "oauth-first"]) for (const oldUser of [A, null]) {
	test(`${order}, old ${oldUser ? "account A" : "expired cookie"}: only OAuth B commits`, async () => {
		const c = setup();
		const initial = c.controller.restore(); await tick();
		const callback = c.controller.restore("oauth"); await tick();
		assert.equal(c.reads.length, 2); assert.equal(c.reads[0].signal.aborted, true);
		assert.equal(c.controller.restore(), callback);
		if (order === "old-first") {
			c.reads[0].resolve(oldUser); assert.equal((await initial).status, "stale");
			assert.deepEqual(c.writes, []); assert.deepEqual(c.loading, [true, true]);
			c.reads[1].resolve(B);
		} else {
			c.reads[1].resolve(B); await callback;
			c.reads[0].resolve(oldUser); assert.equal((await initial).status, "stale");
		}
		assert.equal((await callback).user, B); assert.equal(c.guard.getUser(), B);
		assert.deepEqual(c.writes, [B]); assert.deepEqual(c.loading, [true, true, false]);
	});
}
test("already restored A can authenticate B without allowing old A mutations", async () => {
	const c = setup(A), old = c.guard.capture();
	const callback = c.controller.restore("oauth"); await tick(); c.reads[0].resolve(B);
	const result = await callback;
	assert.equal(c.guard.isCurrent(result.session), true);
	assert.equal(c.guard.updateForSession({ ...A, name: "late" }, old), false);
	assert.equal(c.guard.getUser(), B);
});
for (const replacement of [null, B, A]) {
	test(`logout while callback pending → ${replacement?.name || "guest"}: late response is stale`, async () => {
		const c = setup(A);
		const callback = c.controller.restore("oauth"); await tick();
		c.replace(null); if (replacement) c.replace(replacement);
		c.reads[0].resolve(A);
		assert.equal((await callback).status, "stale"); assert.deepEqual(c.writes, []);
		assert.equal(c.guard.getUser(), replacement); assert.equal(c.reads[0].signal.aborted, true);
	});
}
test("committed callback identity becomes invalid before navigation if logout/B login intervenes", async () => {
	const c = setup(); const callback = c.controller.restore("oauth"); await tick();
	c.reads[0].resolve(A); const result = await callback;
	assert.equal(c.guard.isCurrent(result.session), true);
	c.replace(null); c.replace(B);
	assert.equal(c.guard.isCurrent(result.session), false); assert.equal(c.guard.getUser(), B);
});
for (const user of [null, undefined, {}, { _id: 42 }]) {
	test(`invalid/no authenticated user ${JSON.stringify(user)} fails safely and can retry`, async () => {
		const c = setup(); const first = c.controller.restore("oauth"); await tick(); c.reads[0].resolve(user);
		const result = await first;
		assert.equal(result.status, "failed"); assert.equal(c.guard.isCurrent(result.session), true);
		const retry = c.controller.restore("oauth"); await tick(); c.reads[1].resolve(B);
		assert.equal((await retry).status, "success"); assert.deepEqual(c.writes, [null, B]);
	});
}
test("network/JSON failures clear loading and allow a confirmed retry", async () => {
	const c = setup(A); const first = c.controller.restore("oauth"); await tick(); c.reads[0].reject(new Error("private details"));
	assert.equal((await first).status, "failed"); assert.equal(c.guard.getUser(), null);
	const retry = c.controller.restore("oauth"); await tick(); c.reads[1].resolve(B);
	assert.equal((await retry).status, "success"); assert.deepEqual(c.loading, [true, false, true, false]);
});
test("stale request failure cannot clear a newer account or loading state", async () => {
	const c = setup(); const old = c.controller.restore(); await tick();
	const current = c.controller.restore("oauth"); await tick(); c.reads[0].reject(new Error("late failure"));
	assert.equal((await old).status, "stale"); assert.deepEqual(c.loading, [true, true]);
	c.reads[1].resolve(B); await current; assert.deepEqual(c.writes, [B]);
});
test("ordinary session restores deduplicate too, and refresh preserves account identity", async () => {
	const c = setup(A), before = c.guard.capture(); const first = c.controller.restore();
	assert.equal(c.controller.restore(), first); await tick(); c.reads[0].resolve(A);
	await first; assert.equal(c.guard.isCurrent(before), true);
	const refresh = c.controller.restore(); await tick(); c.reads[1].resolve(A);
	await refresh; assert.equal(c.reads.length, 2); assert.equal(c.guard.isCurrent(before), true);
});
