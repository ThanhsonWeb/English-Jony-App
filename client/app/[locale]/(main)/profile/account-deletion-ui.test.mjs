import assert from "node:assert/strict";
import { test } from "node:test";
import {
	ACCOUNT_DELETION_CONFIRMATION,
	canRequestPasswordAccountDeletion,
	isAccountDeletionConfirmationValid,
	isAccountDeletionUiEnabled,
	submitAccountDeletionRequest,
} from "../../../_lib/accountDeletionUi.mjs";

test("account deletion UI is opt-in and limited to password accounts", () => {
	assert.equal(isAccountDeletionUiEnabled(undefined), false);
	assert.equal(isAccountDeletionUiEnabled("false"), false);
	assert.equal(isAccountDeletionUiEnabled("true"), true);
	assert.equal(canRequestPasswordAccountDeletion({ canRequestPasswordAccountDeletion: true }), true);
	assert.equal(canRequestPasswordAccountDeletion({ canRequestPasswordAccountDeletion: false }), false);
	assert.equal(canRequestPasswordAccountDeletion({}), false);
});

test("confirmation requires the exact phrase", () => {
	assert.equal(isAccountDeletionConfirmationValid(ACCOUNT_DELETION_CONFIRMATION), true);
	assert.equal(isAccountDeletionConfirmationValid("delete my account"), false);
	assert.equal(isAccountDeletionConfirmationValid(" DELETE MY ACCOUNT "), false);
});

test("request posts the password and explicit confirmation to the protected endpoint", async () => {
	let request;
	const result = await submitAccountDeletionRequest("current-password", async (...args) => {
		request = args;
		return {
			ok: true,
			status: 202,
			json: async () => ({ status: "success", data: { requested: true } }),
		};
	});

	assert.equal(result.ok, true);
	assert.equal(result.status, 202);
	assert.equal(request[0], "/api/v1/users/request-account-deletion");
	assert.deepEqual(request[1], {
		method: "POST",
		credentials: "include",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			confirmation: ACCOUNT_DELETION_CONFIRMATION,
			currentPassword: "current-password",
		}),
	});
});

test("request rejects missing password and unsuccessful or malformed responses", async () => {
	let called = false;
	assert.equal((await submitAccountDeletionRequest("", async () => { called = true; })).ok, false);
	assert.equal(called, false);
	assert.equal((await submitAccountDeletionRequest("password", async () => ({
		ok: false, status: 401, json: async () => ({ status: "fail" }),
	}))).ok, false);
	assert.equal((await submitAccountDeletionRequest("password", async () => ({
		ok: true, status: 202, json: async () => null,
	}))).ok, false);
});
