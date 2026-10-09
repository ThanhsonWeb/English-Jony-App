import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { getAuthErrorMessage } from "../../../app/_lib/authErrorMessage.js";
const require = createRequire(import.meta.url);
const { securityHeaders } = require("../../../security-headers.cjs");

for (const development of [false, true]) test(`${development ? "development" : "production"}: bounded CSP permits required providers and rejects framing/eval appropriately`, () => {
	const headers = Object.fromEntries(securityHeaders(development).map(item => [item.key, item.value]));
	const directives = Object.fromEntries(headers["Content-Security-Policy"].split("; ").map(value => { const [key, ...sources] = value.split(" "); return [key, sources]; }));
	assert.deepEqual(directives["frame-ancestors"], ["'none'"]); assert.equal(headers["X-Frame-Options"], "DENY");
	assert.deepEqual(directives["object-src"], ["'none'"]);
	assert.ok(directives["script-src"].includes("https://accounts.google.com/gsi/client"));
	assert.ok(directives["script-src"].includes("https://va.vercel-scripts.com"));
	assert.equal(directives["script-src"].includes("'unsafe-eval'"), development);
	assert.ok(directives["connect-src"].includes("https://vitals.vercel-insights.com"));
	assert.ok(directives["img-src"].includes("https://res.cloudinary.com"));
	assert.ok(directives["media-src"].includes("https://api.dictionaryapi.dev"));
	assert.deepEqual(directives["font-src"], ["'self'"]);
	for (const sources of Object.values(directives)) for (const source of sources) assert.ok(!["*", "https:", "http:"].includes(source), source);
	assert.equal(headers["Referrer-Policy"], "strict-origin-when-cross-origin");
});

test("Next configuration attaches security headers to every locale without changing API rewrites", async () => {
	const config = require("../../../next.config.js");
	const [rule] = await config.headers(); assert.equal(rule.source, "/:path*"); assert.equal(rule.locale, false);
	assert.ok(rule.headers.some(header => header.key === "Content-Security-Policy"));
	assert.equal((await config.rewrites())[0].source, "/api/v1/:path*");
});

for (const locale of ["vi", "en"]) test(`${locale}: password byte-limit feedback is translated for code and validation-message responses`, () => {
	const messages = JSON.parse(readFileSync(new URL(`../../../messages/${locale}.json`, import.meta.url))).Auth;
	assert.ok(messages.passwordTooLong.includes("72"));
	for (const data of [{ code: "passwordTooLong" }, { message: "Password must be at most 72 UTF-8 bytes" }]) assert.equal(getAuthErrorMessage(data, key => messages[key], "signupFailed"), messages.passwordTooLong);
});
