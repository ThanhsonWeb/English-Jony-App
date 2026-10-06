// Run against a local Next dev server. All API and external provider requests are mocked.
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const baseURL = process.env.STUDYJONY_TEST_URL || "http://localhost:3000";
const base = new URL(baseURL);
assert.ok(["localhost", "127.0.0.1"].includes(base.hostname), "Use a local test server only");

async function run(browser, width, locale, theme) {
	const page = await browser.newPage({ viewport: { width, height: 640 }, hasTouch: width < 768, colorScheme: theme });
	const prefix = locale === "en" ? "/en" : "", messages = require(`../messages/${locale}.json`);
	const user = { _id: "000000000000000000000001", name: "Google Learner", email: "google@example.com", theme };
	const errors = [];
	page.on("pageerror", error => errors.push(error.message));
	page.on("console", message => {
		if (message.type() === "error") errors.push(message.text());
	});
	await page.addInitScript(theme => {
		localStorage.setItem("studyjony-theme", theme);
		window.callbackReplaces = [];
		let nextValue;
		const wrap = router => {
			if (!router || router.replace.__identitySpy) return router;
			const original = router.replace.bind(router);
			router.replace = function (href, ...args) { window.callbackReplaces.push(String(href)); return original(href, ...args); };
			router.replace.__identitySpy = true; return router;
		};
		Object.defineProperty(window, "next", { configurable: true, get: () => nextValue, set(value) {
			nextValue = value; if (!value) return;
			let router = wrap(value.router);
			Object.defineProperty(value, "router", { configurable: true, get: () => router, set: value => router = wrap(value) });
		} });
	}, theme);
	await page.route("**/*", route => new URL(route.request().url()).origin === base.origin
		? route.continue() : route.fulfill({ contentType: "application/javascript", body: "" }));
	await page.route("**/api/v1/**", route => {
		const pathname = new URL(route.request().url()).pathname;
		return route.fulfill({ json: pathname.endsWith("/users/me") ? { status: "success", data: { user } }
			: { status: "success", data: { vocabularies: [], topics: [], progress: [], activities: [] } } });
	});
	try {
		// Even with an existing valid session, callback failure must not enter Wordlist.
		for (const [error, expected, key] of [
			["google_account_conflict", "google_account_conflict", "googleAccountConflict"],
			["untrusted_error", "google_oauth_failed", "googleOAuthFailed"],
		]) {
			await page.goto(`${baseURL}${prefix}/oauth/google/callback?error=${error}`, { waitUntil: "domcontentloaded" });
			await page.waitForURL(url => url.pathname === prefix + "/login" && url.searchParams.get("error") === expected);
			await page.getByRole("alert").filter({ hasText: messages.Auth[key] }).waitFor();
			assert.deepEqual(await page.evaluate(() => window.callbackReplaces), [`${prefix}/login?error=${expected}`]);
			assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "No horizontal overflow");
		}
		await page.goto(`${baseURL}${prefix}/oauth/google/callback`, { waitUntil: "domcontentloaded" });
		await page.waitForURL(url => url.pathname === prefix + "/wordlist");
		assert.deepEqual(await page.evaluate(() => window.callbackReplaces), [`${prefix}/wordlist`]);
		assert.deepEqual(errors, [], "No hydration/runtime/console errors");
	} finally { await page.close(); }
}

(async () => {
	const browser = await chromium.launch({ channel: "chrome", headless: true });
	let checks = 0;
	try {
		for (const width of [320, 375, 430, 768, 1280]) for (const locale of ["vi", "en"]) for (const theme of ["light", "dark"]) {
			await run(browser, width, locale, theme); checks += 3;
			console.log(`PASS ${width}px ${locale} ${theme}: collision, unknown error, success`);
		}
		console.log(`PASS ${checks} browser scenarios`);
	} finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
