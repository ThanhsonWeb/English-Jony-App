import assert from "node:assert/strict";
import test from "node:test";
import { accountLanguage, guestLanguage, languagePath } from "../../../app/_lib/languagePreference.mjs";
import { resolveAccountLanguage, selectedSessionCookies } from "../../../i18n/accountLanguage.mjs";

test("account choices never inherit a browser's guest choice or the old shared cookie", () => {
	assert.equal(accountLanguage({ _id: "a", language: "vi" }), "vi");
	assert.equal(accountLanguage({ _id: "b", language: "en" }), "en");
	assert.equal(accountLanguage({ _id: "legacy" }), "vi");
	assert.equal(guestLanguage("NEXT_LOCALE=vi; sj_guest_language=en"), "en");
	assert.equal(guestLanguage("NEXT_LOCALE=en"), null);
	assert.equal(guestLanguage("sj_guest_language=bad"), null);
	assert.equal(guestLanguage("sj_guest_language=vi"), "vi");
});

test("locale correction preserves the route and cannot generate an external path", () => {
	assert.equal(languagePath("/en/wordlist", "vi"), "/wordlist");
	assert.equal(languagePath("/vi/dialogue", "en"), "/en/dialogue");
	assert.equal(languagePath("/en", "vi"), "/");
	assert.equal(languagePath("/", "en"), "/en");
	assert.equal(languagePath("/en//example.test", "vi"), "/example.test");
});

test("SSR forwards only the actively selected credential, respecting none and legacy", () => {
	const id = "a".repeat(32);
	const cookies = `jwt=older; sj_auth_session=${id}; sj_auth_${id}=active; sj_auth_${"b".repeat(32)}=unselected; NEXT_LOCALE=vi`;
	assert.equal(selectedSessionCookies(cookies), `sj_auth_session=${id}; sj_auth_${id}=active`);
	assert.equal(selectedSessionCookies("sj_auth_session=none; jwt=older"), null);
	assert.equal(selectedSessionCookies(`sj_auth_session=${id}; jwt=older`), null);
	assert.equal(selectedSessionCookies("sj_auth_session=legacy; jwt=legacy"), "jwt=legacy");
	assert.equal(selectedSessionCookies("jwt=legacy; NEXT_LOCALE=en"), "jwt=legacy");
});

test("concurrent SSR requests keep A/B preferences isolated and disable credential caching", async () => {
	const pending = new Map();
	const fetchImpl = (url, options) => {
		assert.equal(url, "https://api.example.test/api/v1/users/me");
		assert.equal(options.cache, "no-store");
		assert.equal(options.redirect, "error");
		assert.deepEqual(Object.keys(options.headers).sort(), ["Cache-Control", "Cookie"]);
		assert.equal(options.headers["X-StudyJony-Credential-Cleanup"], undefined);
		return new Promise(resolve => pending.set(options.headers.Cookie, resolve));
	};
	const a = resolveAccountLanguage("jwt=account-a", "https://api.example.test/", fetchImpl);
	const b = resolveAccountLanguage("jwt=account-b", "https://api.example.test", fetchImpl);
	pending.get("jwt=account-b")(Response.json({ status: "success", data: { user: { _id: "b", language: "en" } } }));
	pending.get("jwt=account-a")(Response.json({ status: "success", data: { user: { _id: "a", language: "vi" } } }));
	assert.deepEqual(await a, { authenticated: true, language: "vi" });
	assert.deepEqual(await b, { authenticated: true, language: "en" });
});

test("guests do not call private APIs; failed account reads never return another preference", async () => {
	await assert.doesNotReject(async () => assert.deepEqual(
		await resolveAccountLanguage("sj_auth_session=none; jwt=old", "https://api.example.test", () => { throw new Error("Unexpected fetch"); }),
		{ authenticated: false },
	));
	assert.deepEqual(await resolveAccountLanguage("jwt=expired", "https://api.example.test", async () => new Response(null, { status: 401 })), { authenticated: false });
	for (const fetchImpl of [async () => { throw new Error("offline"); },
		async () => new Response(null, { status: 500 }),
		async () => Response.json({ status: "success", data: { user: { _id: "", language: "en" } } }),
	]) assert.deepEqual(await resolveAccountLanguage("jwt=token", "https://api.example.test", fetchImpl), { authenticated: null });
});
