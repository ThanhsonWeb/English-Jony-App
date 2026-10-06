import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loginWithPassword } from "../app/_lib/passwordLogin.mjs";
const credentials = { email: "learner@example.com", password: "password-123" };
const internal = "private server details: database password and stack";
for (const locale of ["vi", "en"]) {
	const messages = JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url))).Auth;
	const translate = key => messages[key];
	test(`${locale}: valid password login preserves credentials/cookie contract`, async t => {
		const user = { _id: "A", name: "Learner" };
		t.mock.method(globalThis, "fetch", async (url, options) => {
			assert.equal(url, "/api/v1/auth/login");
			assert.equal(options.method, "POST"); assert.equal(options.credentials, "include");
			assert.deepEqual(JSON.parse(options.body), credentials);
			return { ok: true, status: 200, json: async () => ({ status: "success", data: { user } }) };
		});
		assert.deepEqual(await loginWithPassword(credentials, translate), { user });
	});
	for (const [name, status, data, expected] of [
		["401 credentials", 401, { status: "fail", message: "Email hoặc mật khẩu không chính xác!" }, "invalidCredentials"],
		["400 missing credentials", 400, { status: "fail", message: "Vui lòng nhập đầy đủ email và mật khẩu!" }, "credentialsRequired"],
		["API fail over HTTP 200", 200, { status: "fail", message: "Email hoặc mật khẩu không chính xác!" }, "invalidCredentials"],
		["unknown 403", 403, { status: "fail", message: internal }, "loginFailed"],
		["500 error", 500, { status: "error", message: internal, stack: internal }, "loginFailed"],
		["500 with success body", 500, { status: "success", data: { user: { _id: "A" } } }, "loginFailed"],
		["500 containing a known message", 500, { message: "Email hoặc mật khẩu không chính xác!" }, "loginFailed"],
		["unexpected API status", 200, { status: "unexpected", message: internal }, "loginFailed"],
		["error status over HTTP 200", 200, { status: "error", message: internal }, "loginFailed"],
		["null JSON", 200, null, "loginFailed"],
		["primitive JSON", 200, internal, "loginFailed"],
		["non-string error message", 400, { message: { private: internal } }, "loginFailed"],
		["missing user", 200, { status: "success", data: {} }, "loginFailed"],
		["missing user id", 200, { status: "success", data: { user: {} } }, "loginFailed"],
		["invalid user id", 200, { status: "success", data: { user: { _id: {} } } }, "loginFailed"],
	]) test(`${locale}: ${name} is a safe translated failure`, async t => {
		t.mock.method(globalThis, "fetch", async () => ({ ok: status < 400, status, json: async () => data }));
		assert.deepEqual(await loginWithPassword(credentials, translate), { error: messages[expected] });
	});
	for (const network of [false, true]) test(`${locale}: ${network ? "network" : "malformed JSON"} failure can be retried successfully`, async t => {
		let attempts = 0;
		t.mock.method(globalThis, "fetch", async () => {
			if (++attempts === 1) {
				if (network) throw new Error(internal);
				return { ok: true, status: 200, json: async () => { throw new SyntaxError(internal); } };
			}
			return { ok: true, status: 200, json: async () => ({ status: "success", data: { user: { _id: "A" } } }) };
		});
		assert.deepEqual(await loginWithPassword(credentials, translate), { error: messages.loginFailed });
		assert.deepEqual(await loginWithPassword(credentials, translate), { user: { _id: "A" } });
	});
}
