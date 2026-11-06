// Local browser checks: account, progress and Google OAuth requests are mocked.
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const rules = require("../../../../server/data/dialogueTaskRules.json");

const baseURL = process.env.STUDYJONY_TEST_URL || "http://localhost:3000";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname));
const dialoguePath = "/dialogue/ten-minutes-a-day/the-old-book/1";
const returnKey = "studyjony-google-oauth-return-path";
const userId = "aaaaaaaaaaaaaaaaaaaaaaaa";
const rule = rules.find(item => item.ids.join("/") === "ten-minutes-a-day/the-old-book/1");
assert.equal(rule.type, "fillBlank");

async function fixture(browser, locale, width) {
	const prefix = locale === "en" ? "/en" : "";
	const messages = require(`../../../messages/${locale}.json`);
	const context = await browser.newContext({
		viewport: { width, height: 900 },
		isMobile: width < 768,
		hasTouch: width < 768,
	});
	await context.addCookies([{ name: "sj_guest_language", value: locale, url: baseURL }]);
	await context.addInitScript(() => {
		localStorage.setItem("studyjony-theme", "dark");
		HTMLMediaElement.prototype.play = function() { return Promise.resolve(); };
		HTMLMediaElement.prototype.pause = function() {};
		window.google = { accounts: { oauth2: { initCodeClient: () => ({
			requestCode() { window.__signupOAuthStarted = true; },
		}) } } };
	});
	await context.route("**/*", route => new URL(route.request().url()).origin === new URL(baseURL).origin
		? route.continue() : route.fulfill({ body: "" }));
	let signedIn = false;
	const user = { _id: userId, name: "Return tester", theme: "dark", language: locale };
	await context.route("**/api/v1/**", route => {
		const request = route.request();
		const path = new URL(request.url()).pathname;
		if (path.endsWith("/users/me")) return route.fulfill({ status: signedIn ? 200 : 401,
			json: signedIn ? { status: "success", data: { user } } : { status: "fail" } });
		if (path.endsWith("/auth/credentials/signup")) {
			signedIn = true;
			return route.fulfill({ json: { status: "success", data: {
				user, credentialAttempt: request.headers()["x-studyjony-auth-attempt"],
			} } });
		}
		if (path.endsWith("/auth/google/state")) return route.fulfill({ json: { status: "success", data: {
			clientId: "browser-test-client", redirectUri: `${baseURL}/api/v1/auth/google/callback`, state: "browser-test-state",
		} } });
		if (path.endsWith("/attempt")) return route.fulfill({ json: { status: "success", data: {
			attemptId: "a".repeat(64), expiresAt: new Date(Date.now() + 600000).toISOString(), readyAfterMs: 0,
		} } });
		return route.fulfill({ json: { status: "success", data: { progress: [], vocabularies: [], topics: [], activities: [] } } });
	});
	const page = await context.newPage();
	const errors = [];
	page.on("pageerror", error => errors.push(error.message));
	return { context, page, prefix, messages, errors, signIn() { signedIn = true; } };
}

async function open(f, path) {
	const session = f.page.waitForResponse(response => new URL(response.url()).pathname.endsWith("/users/me"));
	await f.page.goto(`${baseURL}${f.prefix}${path}`, { waitUntil: "domcontentloaded", timeout: 90000 });
	await session;
}

async function submitSignup(f) {
	await f.page.locator("#signup-name").fill("Return tester");
	await f.page.locator("#signup-email").fill("learner@example.test");
	await f.page.locator("#signup-password").fill("safe-test-password");
	await f.page.locator("#signup-password-confirm").fill("safe-test-password");
	await f.page.locator("form").getByRole("button", { name: f.messages.Auth.signup, exact: true }).click();
}

async function guestReminderToSignup(browser, locale, width) {
	const f = await fixture(browser, locale, width);
	try {
		await open(f, dialoguePath);
		const inputs = f.page.locator('input[placeholder="..."]');
		await inputs.first().waitFor();
		for (const [index, answer] of rule.answers.entries()) await inputs.nth(index).fill(answer);
		await inputs.last().press("Enter");
		const reminder = f.page.locator('aside[aria-labelledby="guest-progress-title"]');
		await reminder.waitFor();
		await reminder.getByRole("link", { name: f.messages.DialogueFeature.signIn, exact: true }).click();
		await f.page.waitForURL(url => url.pathname === `${f.prefix}/login`);
		assert.equal(new URL(f.page.url()).searchParams.get("returnTo"), dialoguePath);
		await f.page.getByRole("link", { name: f.messages.Auth.signup, exact: true }).click();
		await f.page.waitForURL(url => url.pathname === `${f.prefix}/signup`);
		assert.equal(new URL(f.page.url()).searchParams.get("returnTo"), dialoguePath);
		await f.page.getByRole("link", { name: f.messages.Auth.login, exact: true }).click();
		await f.page.waitForURL(url => url.pathname === `${f.prefix}/login`);
		assert.equal(new URL(f.page.url()).searchParams.get("returnTo"), dialoguePath, "Switching back keeps the safe path");
		await f.page.getByRole("link", { name: f.messages.Auth.signup, exact: true }).click();
		await f.page.waitForURL(url => url.pathname === `${f.prefix}/signup`);
		await submitSignup(f);
		await f.page.waitForURL(url => url.pathname === `${f.prefix}${dialoguePath}`);
		assert.deepEqual(f.errors, []);
		console.log(`PASS ${locale} ${width}px: guest reminder -> login -> signup returns to the exercise`);
	} finally { await f.context.close(); }
}

async function closeLogin(browser, locale, width, value, expectedPath) {
	const f = await fixture(browser, locale, width);
	try {
		const query = value === null ? "" : `?returnTo=${encodeURIComponent(value)}`;
		await open(f, `/login${query}`);
		const signup = f.page.getByRole("link", { name: f.messages.Auth.signup, exact: true });
		assert.equal(new URL(await signup.getAttribute("href"), baseURL).searchParams.get("returnTo"),
			expectedPath === dialoguePath ? dialoguePath : null, "Only a safe path is passed to signup");
		await f.page.getByRole("link", { name: f.messages.Auth.close, exact: true }).click();
		const localizedPath = expectedPath === "/" && f.prefix ? f.prefix : `${f.prefix}${expectedPath}`;
		await f.page.waitForURL(url => url.pathname === localizedPath);
		assert.deepEqual(f.errors, []);
		console.log(`PASS ${locale} ${width}px: login close uses ${value === null ? "default" : expectedPath}`);
	} finally { await f.context.close(); }
}

async function signupFallback(browser, locale, width, value) {
	const f = await fixture(browser, locale, width);
	try {
		const query = value === null ? "" : `?returnTo=${encodeURIComponent(value)}`;
		await open(f, `/signup${query}`);
		const login = f.page.getByRole("link", { name: f.messages.Auth.login, exact: true });
		assert.equal(new URL(await login.getAttribute("href"), baseURL).searchParams.has("returnTo"), false);
		await submitSignup(f);
		await f.page.waitForURL(url => url.pathname === `${f.prefix}/wordlist`);
		assert.deepEqual(f.errors, []);
		console.log(`PASS ${locale} ${width}px: ${value === null ? "missing" : "invalid"} signup return uses Wordlist`);
	} finally { await f.context.close(); }
}

async function googleSignup(browser, locale, width, value, expectedPath) {
	const f = await fixture(browser, locale, width);
	try {
		const query = value === null ? "" : `?returnTo=${encodeURIComponent(value)}`;
		await open(f, `/signup${query}`);
		if (expectedPath !== dialoguePath) await f.page.evaluate(([key, path]) => sessionStorage.setItem(key, path), [returnKey, dialoguePath]);
		await f.page.getByRole("button", { name: f.messages.Auth.googleSignup, exact: true }).click();
		await f.page.waitForFunction(() => window.__signupOAuthStarted === true);
		assert.equal(await f.page.evaluate(key => sessionStorage.getItem(key), returnKey), expectedPath === dialoguePath ? dialoguePath : null);
		f.signIn();
		await f.page.goto(`${baseURL}${f.prefix}/oauth/google/callback`, { waitUntil: "domcontentloaded" });
		await f.page.waitForURL(url => url.pathname === `${f.prefix}${expectedPath}`);
		assert.equal(await f.page.evaluate(key => sessionStorage.getItem(key), returnKey), null);
		assert.deepEqual(f.errors, []);
		console.log(`PASS ${locale} ${width}px: Google signup uses the validated return path`);
	} finally { await f.context.close(); }
}

(async () => {
	const browser = await chromium.launch({ channel: "chrome", headless: true });
	try {
		for (const locale of ["vi", "en"]) for (const width of [390, 1280]) {
			await guestReminderToSignup(browser, locale, width);
			await closeLogin(browser, locale, width, dialoguePath, dialoguePath);
			await closeLogin(browser, locale, width, null, "/");
			await closeLogin(browser, locale, width, "//attacker.example/path", "/");
			await signupFallback(browser, locale, width, null);
			await signupFallback(browser, locale, width, "https://attacker.example/path");
			await googleSignup(browser, locale, width, dialoguePath, dialoguePath);
			await googleSignup(browser, locale, width, "//attacker.example/path", "/wordlist");
		}
	} finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
