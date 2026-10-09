// Next dev + Playwright required. API/provider responses use isolated mocks.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const baseURL = process.env.STUDYJONY_TEST_URL || "http://localhost:3000";
const fixtureDir = path.resolve(__dirname, "../../../app/[locale]/(main)/regression-auth-fixture");
const fixtureFile = path.join(fixtureDir, "page.jsx");
const fixture = `"use client";
import { useEffect } from "react";
import { useAuth } from "@/app/_contexts/AuthContext";
import { useRouter } from "next/navigation";
export default function Fixture() {
 const auth = useAuth(); const router = useRouter();
 useEffect(() => { window.authProbe = { ...auth, navigate: path => router.push(path) }; }, [auth, router]);
 return <p>Auth test fixture</p>;
}`;
function deferred() { let resolve; const promise = new Promise(done => resolve = done); return { promise, resolve }; }
const frame = p => p.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
const account = (id, theme) => ({ _id: String(id).padStart(24, "0"), name: `Account ${id === 1 ? "A" : "B"}`, email: `${id}@example.com`, theme, createdAt: "2026-09-01" });
async function setup(browser, width, locale, theme) {
	const p = await browser.newPage({ viewport: { width, height: 740 }, hasTouch: width < 768, colorScheme: theme });
	p.setDefaultTimeout(15000);
	const messages = require(`../../../messages/${locale}.json`), prefix = locale === "en" ? "/en" : "";
	const A = account(1, theme), B = account(2, theme);
	let serverUser = A, meHandler;
	let reads = 0;
	const errors = [];
	p.on("pageerror", error => errors.push(error.message));
	p.on("console", message => {
		if (message.type() !== "error") return;
		if (message.text().startsWith("Failed to load resource") && message.location().url.includes("/api/v1/")) return;
		errors.push(message.text());
	});
	await p.addInitScript(theme => {
		localStorage.setItem("studyjony-theme", theme);
		window.callbackReplaces = [];
		// Spy on the actual App Router replace used by useRouter, including Strict Mode.
		let nextValue;
		const wrap = router => {
			if (!router || router.replace.__callbackSpy) return router;
			const original = router.replace.bind(router);
			router.replace = function (href, ...args) { window.callbackReplaces.push(String(href)); return original(href, ...args); };
			router.replace.__callbackSpy = true;
			return router;
		};
		Object.defineProperty(window, "next", { configurable: true, get: () => nextValue, set(value) {
			nextValue = value;
			if (!value) return;
			let router = wrap(value.router);
			Object.defineProperty(value, "router", { configurable: true, get: () => router, set: value => { router = wrap(value); } });
		} });
	}, theme);
	await p.route("https://va.vercel-scripts.com/**", route => route.fulfill({ contentType: "application/javascript", body: "" }));
	await p.route("https://accounts.google.com/**", route => route.fulfill({ contentType: "application/javascript", body: "window.google={accounts:{oauth2:{initCodeClient:()=>({requestCode(){}})}}};" }));
	await p.route("**/api/v1/**", async route => {
		const pathname = new URL(route.request().url()).pathname;
		if (pathname.endsWith("/users/me")) {
			reads++;
			if (meHandler) return meHandler(route, reads);
			return route.fulfill(serverUser ? { json: { status: "success", data: { user: serverUser } } } : { status: 401, json: { status: "fail" } });
		}
		if (pathname.endsWith("/auth/logout")) { serverUser = null; return route.fulfill({ json: { status: "success" } }); }
		return route.fulfill({ json: { status: "success", data: { vocabularies: [], activities: [], progress: [], topics: [] } } });
	});
	async function goto(url) { await p.goto(baseURL + prefix + url, { waitUntil: "domcontentloaded", timeout: 60000 }); }
	async function check() {
		assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "No horizontal overflow");
		assert.deepEqual(errors, [], "No unexpected hydration/runtime errors");
	}
	async function userIs(user) {
		await p.locator("header.sticky button.group").waitFor();
		await p.locator("header.sticky button.group").click();
		await p.getByText(user.name, { exact: true }).last().waitFor();
		await p.locator("header.sticky button.group").click();
	}
	function holdMe(responseUser) {
		const started = deferred(), release = deferred();
		meHandler = async route => {
			started.resolve(); await release.promise;
			try { await route.fulfill(responseUser ? { json: { status: "success", data: { user: responseUser } } } : { status: 401, json: { status: "fail" } }); } catch { /* An obsolete read is intentionally aborted. */ }
		};
		return { started, release };
	}
	return { p, A, B, messages, prefix, goto, check, userIs, holdMe,
		reads: () => reads, handler: value => meHandler = value, backend: value => serverUser = value,
		finish: async () => { await check(); await p.close(); } };
}
async function profileCase(browser, width, locale, theme) {
	const c = await setup(browser, width, locale, theme), { p } = c, t = c.messages.Profile;
	await c.goto("/profile"); await p.getByRole("heading", { name: c.A.name, exact: true }).waitFor();
	assert.equal(await p.locator('input[type="range"]').count(), 0);
	assert.equal(t.sound, undefined, "The unused locale key is removed");
	await p.getByText(t.language, { exact: true }).waitFor(); await p.getByText(t.darkMode, { exact: true }).waitFor();
	for (const label of [t.language, t.darkMode]) {
		const bounds = await p.getByText(label, { exact: true }).evaluate(element => {
			const rect = element.parentElement.parentElement.getBoundingClientRect(); return { left: rect.left, right: rect.right, width: innerWidth };
		});
		assert.ok(bounds.left >= 0 && bounds.right <= bounds.width, "Settings rows remain inside the viewport");
	}
	await c.finish();
}
async function directCase(browser, width, locale, theme) {
	const c = await setup(browser, width, locale, theme), { p } = c;
	const gate = c.holdMe(c.B);
	try {
		await c.goto("/oauth/google/callback"); await gate.started.promise;
		await p.getByText(c.messages.Auth.finishingGoogleLogin, { exact: true }).waitFor({ state: "attached" });
		await frame(p); assert.equal(c.reads(), 1, "Initial restore and callback share one GET");
		assert.deepEqual(await p.evaluate(() => window.callbackReplaces), []);
		c.backend(c.B); gate.release.resolve();
		await p.waitForURL(url => url.pathname === c.prefix + "/wordlist"); await c.userIs(c.B);
		assert.deepEqual(await p.evaluate(() => window.callbackReplaces), [c.prefix + "/wordlist"], "Exactly one confirmed navigation");
		assert.equal(c.reads(), 1);
		c.handler(null); await p.reload({ waitUntil: "domcontentloaded" }); await c.userIs(c.B);
		assert.equal(c.reads(), 2, "Refresh restores the confirmed Google session once");
	} finally { gate.release.resolve(); await c.finish(); }
}
async function failureCase(browser, width, locale, theme) {
	const c = await setup(browser, width, locale, theme), { p } = c;
	try {
		for (const error of ["google_oauth_failed", "access_denied"]) {
			await c.goto(`/oauth/google/callback?error=${error}`);
			await p.waitForURL(url => url.pathname === c.prefix + "/login" && url.searchParams.get("error") === "google_oauth_failed");
			await p.getByText(c.messages.Auth.googleOAuthFailed, { exact: true }).waitFor();
			assert.deepEqual(await p.evaluate(() => window.callbackReplaces), [c.prefix + "/login?error=google_oauth_failed"]);
			await c.check();
		}
		for (const response of [{ status: 401, json: { status: "fail" } }, { status: 500, json: { status: "error", message: "PRIVATE_DETAILS" } },
			{ json: { status: "fail", data: { user: c.B } } }, { contentType: "application/json", body: "{malformed" }, null]) {
			c.handler(route => response ? route.fulfill(response) : route.abort("failed"));
			await c.goto("/oauth/google/callback");
			await p.waitForURL(url => url.pathname === c.prefix + "/login" && url.searchParams.get("error") === "google_session_failed");
			await p.getByText(c.messages.Auth.googleSessionFailed, { exact: true }).waitFor();
			assert.deepEqual(await p.evaluate(() => window.callbackReplaces), [c.prefix + "/login?error=google_session_failed"]);
			assert.equal(await p.getByText("PRIVATE_DETAILS", { exact: false }).count(), 0); await c.check();
		}
	} finally { await c.finish(); }
}
async function transitionCase(browser, width, locale, theme) {
	const c = await setup(browser, width, locale, theme), { p } = c;
	try {
		// A restored first; an old read (including an expired cookie) is then pending.
		for (const oldUser of [c.A, null]) for (const order of ["old-first", "oauth-first"]) {
			c.backend(c.A); c.handler(null); await c.goto("/regression-auth-fixture"); await p.waitForFunction(id => window.authProbe?.captureSession().userId === id, c.A._id);
			const old = c.holdMe(oldUser), before = c.reads();
			await p.evaluate(() => { window.oldRestore = window.authProbe.getMe(); }); await old.started.promise;
			const oauth = c.holdMe(c.B); c.backend(c.B);
			await p.evaluate(prefix => { window.authProbe.navigate(prefix + "/oauth/google/callback"); }, c.prefix);
			await oauth.started.promise;
			assert.equal(c.reads(), before + 2, "OAuth replaces an already sent old-cookie read");
			if (order === "old-first") { old.release.resolve(); await frame(p); assert.equal(await p.evaluate(() => window.authProbe.captureSession().userId), c.A._id); }
			oauth.release.resolve(); await p.waitForURL(url => url.pathname === c.prefix + "/wordlist");
			old.release.resolve(); await c.userIs(c.B);
			assert.equal(await p.evaluate(() => window.authProbe.captureSession().userId), c.B._id);
			assert.deepEqual(await p.evaluate(() => window.callbackReplaces), [c.prefix + "/wordlist"]); await c.check();
		}
		// The callback's late response must neither restore A nor redirect B after logout.
		for (const replacement of [null, c.B]) {
			c.backend(c.A); c.handler(null); await c.goto("/regression-auth-fixture"); await p.waitForFunction(id => window.authProbe?.captureSession().userId === id, c.A._id);
			const gate = c.holdMe(c.A);
			await p.evaluate(prefix => { window.authProbe.navigate(prefix + "/oauth/google/callback"); }, c.prefix); await gate.started.promise;
			await p.evaluate(user => { window.authProbe.setUser(null); if (user) window.authProbe.setUser(user); }, replacement);
			gate.release.resolve(); await frame(p);
			assert.equal(await p.evaluate(() => window.authProbe.captureSession().userId), replacement?._id || null);
			assert.deepEqual(await p.evaluate(() => window.callbackReplaces), [], "Obsolete callback never navigates"); await c.check();
		}
		// Real logout action followed by a new Google session on the same mounted app.
		c.backend(c.A); c.handler(null); await c.goto("/regression-auth-fixture"); await p.waitForFunction(id => window.authProbe?.captureSession().userId === id, c.A._id);
		await p.locator("header.sticky button.group").click(); await p.getByRole("button", { name: c.messages.Header.logout, exact: true }).click();
		await p.waitForURL(url => url.pathname === c.prefix || url.pathname === c.prefix + "/");
		const gate = c.holdMe(c.B); c.backend(c.B);
		await p.evaluate(prefix => { window.authProbe.navigate(prefix + "/oauth/google/callback"); }, c.prefix); await gate.started.promise;
		gate.release.resolve(); await p.waitForURL(url => url.pathname === c.prefix + "/wordlist"); await c.userIs(c.B);
		assert.deepEqual(await p.evaluate(() => window.callbackReplaces), [c.prefix + "/wordlist"]);
	} finally { await c.finish(); }
}
(async () => {
	assert.equal(fs.existsSync(fixtureDir), false, "Never overwrite an existing route");
	fs.mkdirSync(fixtureDir); fs.writeFileSync(fixtureFile, fixture);
	let browser, cases = 0;
	try {
		browser = await chromium.launch({ channel: "chrome", headless: true });
		for (const width of process.env.STUDYJONY_TEST_WIDTHS?.split(",").map(Number) || [320, 375, 430, 768, 1280]) for (const locale of ["vi", "en"]) for (const theme of ["light", "dark"]) {
			for (const run of [profileCase, directCase, failureCase, transitionCase]) { await run(browser, width, locale, theme); cases++; }
			console.log(`PASS ${width}px ${locale} ${theme}: no Sound row, callback success/refresh, failure/cancel, both response orders, expired session, logout/account guards`);
		}
		console.log(`PASS ${cases} browser cases`);
	} finally { await browser?.close(); fs.unlinkSync(fixtureFile); fs.rmdirSync(fixtureDir); }
})().catch(error => { console.error(error); process.exitCode = 1; });
