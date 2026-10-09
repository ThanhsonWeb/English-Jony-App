import { test } from "node:test";
import assert from "node:assert/strict";
import { createAuthSessionGuard } from "../../../app/_lib/authSessionGuard.mjs";
const A = { _id: "A", name: "Account A" };
const B = { _id: "B", name: "Account B" };

for (const field of ["name", "avatar"]) {
	for (const replacement of [null, B, A]) {
		test(`${field}: A mutation → logout → ${replacement?.name || "guest"} → late A response is rejected`, () => {
			const guard = createAuthSessionGuard();
			guard.start(A);
			const oldSession = guard.capture();
			guard.start(null);
			if (replacement) guard.start(replacement);
			assert.equal(guard.updateForSession({ ...A, [field]: "late value" }, oldSession), false);
			assert.deepEqual(guard.getUser(), replacement);
		});
	}
}
test("current-session profile updates work without invalidating concurrent requests; mismatched accounts cannot be committed", () => {
	const guard = createAuthSessionGuard();
	guard.start(A);
	const session = guard.capture();
	assert.equal(guard.updateForSession({ ...A, name: "New name" }, session), true);
	assert.equal(guard.isCurrent(session), true);
	assert.equal(guard.updateForSession({ ...guard.getUser(), avatar: "/avatar.jpg" }, session), true);
	assert.equal(guard.getUser().name, "New name");
	assert.equal(guard.updateForSession(B, session), false);
	guard.update({ ...guard.getUser(), theme: "dark" });
	assert.equal(guard.isCurrent(session), true);
});
test("stale session restore and guest mutation identities fail after a new login", () => {
	const guard = createAuthSessionGuard();
	const guest = guard.capture();
	assert.equal(guard.updateForSession(A, guest), false);
	guard.start(B);
	assert.equal(guard.isCurrent(guest), false);
});
