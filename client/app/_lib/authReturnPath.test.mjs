import assert from "node:assert/strict";
import test from "node:test";
import {
	clearGoogleOAuthReturnPath,
	getSafeAuthReturnPath,
	readGoogleOAuthReturnPath,
	saveGoogleOAuthReturnPath,
} from "./authReturnPath.mjs";

test("keeps safe local routes and rejects external or ambiguous return paths", () => {
	assert.equal(getSafeAuthReturnPath("/dialogue/coffee-shop/ordering"), "/dialogue/coffee-shop/ordering");
	for (const value of [
		"https://attacker.example",
		"//attacker.example/path",
		"/\\attacker.example",
		"/dialogue/../login",
		"/dialogue?next=https://attacker.example",
		"/dialogue#section",
	]) {
		assert.equal(getSafeAuthReturnPath(value), null, `Expected ${value} to be rejected`);
	}
});

test("stores and clears only a validated Google OAuth return route", () => {
	const values = new Map();
	const storage = {
		getItem: (key) => values.get(key) ?? null,
		setItem: (key, value) => values.set(key, value),
		removeItem: (key) => values.delete(key),
	};

	saveGoogleOAuthReturnPath(storage, "/dialogue/story/lesson/1");
	assert.equal(readGoogleOAuthReturnPath(storage), "/dialogue/story/lesson/1");
	assert.equal(readGoogleOAuthReturnPath(storage), "/dialogue/story/lesson/1", "Repeated callback reads remain stable");
	clearGoogleOAuthReturnPath(storage);
	assert.equal(readGoogleOAuthReturnPath(storage), null, "The return route is cleared after navigation");

	saveGoogleOAuthReturnPath(storage, "//attacker.example");
	assert.equal(readGoogleOAuthReturnPath(storage), null);
});
