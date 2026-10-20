// Self-contained local Next + real Express + disposable MongoDB. No production services.
// For a production run, build this clean worktree using
// NEXT_PUBLIC_API_URL=http://127.0.0.1:54321, then set STUDYJONY_TEST_PRODUCTION=1.
const assert = require("node:assert/strict");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const net = require("node:net");
const { spawn, execFileSync } = require("node:child_process");
const { chromium } = require(process.env.STUDYJONY_PLAYWRIGHT_MODULE || "playwright");
const serverRoot = path.resolve(__dirname, "../../../../server");
const clientRoot = path.resolve(__dirname, "../../..");
const mongoose = require(path.join(serverRoot, "node_modules/mongoose"));
const { MongoMemoryServer } = require(path.join(serverRoot, "node_modules/mongodb-memory-server"));
const User = require(path.join(serverRoot, "models/userModel"));
const password = "isolated-language-test-password";
const productionBuild = process.env.STUDYJONY_TEST_PRODUCTION === "1";
let mongo, backend, next, browser, base, logs = "", a, b, accountReads = 0;
const pageErrors = [];
const freePort = () => new Promise(resolve => {
	const listener = net.createServer().listen(0, "127.0.0.1", () => {
		const port = listener.address().port; listener.close(() => resolve(port));
	});
});
const cookie = async context => (await context.cookies()).find(item => item.name === "sj_guest_language")?.value;
async function language(page, expected) {
	await page.waitForFunction(value => document.documentElement.lang === value &&
		[...document.querySelectorAll("button")].some(button =>
			["Choose language", "Chọn ngôn ngữ"].includes(button.getAttribute("aria-label")) &&
			!button.disabled && button.getBoundingClientRect().width > 0 && getComputedStyle(button).visibility !== "hidden"), expected);
	assert.equal(new URL(page.url()).pathname.startsWith("/en"), expected === "en");
}
async function select(page, expected) {
	await page.getByRole("button", { name: /^(Choose language|Chọn ngôn ngữ)$/ }).first().click();
	await page.getByRole("menuitemradio", { name: expected === "en" ? "English" : "Tiếng Việt" }).click();
}
async function choose(page, expected) {
	const before = await page.evaluate(() => ({ document: window.__languageDocument,
		path: location.pathname.replace(/^\/en(?=\/|$)/, "") || "/", search: [...new URLSearchParams(location.search)], hash: location.hash, scroll: scrollY }));
	const reads = accountReads;
	const requests = [];
	const track = request => {
		if (request.headers().rsc === "1" && !request.headers()["next-router-prefetch"] &&
			!request.headers()["next-router-segment-prefetch"]) requests.push(request);
	};
	page.on("request", track);
	try {
		await select(page, expected); await language(page, expected);
		const after = await page.evaluate(() => ({ document: window.__languageDocument,
			path: location.pathname.replace(/^\/en(?=\/|$)/, "") || "/", search: [...new URLSearchParams(location.search)], hash: location.hash,
			scroll: scrollY, maxScroll: document.documentElement.scrollHeight - innerHeight }));
		assert.equal(after.document, before.document, "Language switch must not reload the document");
		assert.equal(after.path, before.path); assert.deepEqual(after.search, before.search); assert.equal(after.hash, before.hash);
		assert.ok(Math.abs(after.scroll - Math.min(before.scroll, after.maxScroll)) <= 2, "Language switch preserves scroll");
		assert.equal(accountReads, reads, "Language navigation/prefetch must not repeat the account lookup");
		// Next may refetch once in production to correct its predicted [locale]
		// segment for an unprefixed Vietnamese URL, within one client navigation.
		assert.ok(requests.length >= 1 && requests.length <= (productionBuild ? 2 : 1), "No competing application navigations");
		for (const request of requests) {
			assert.ok(!new URL(request.url()).pathname.startsWith("/vi/"), "Navigate directly to the canonical URL");
			assert.equal((await request.response()).status(), 200, "No locale redirect round trip");
		}
	} finally { page.off("request", track); }
}
async function login(page, user, expected, clientNavigation = false) {
	if (clientNavigation) await page.locator('header a[href$="/login"]').click();
	else await page.goto(base + "/login");
	await page.locator("#login-email").fill(user.email);
	await page.locator("#login-password").fill(password);
	await page.locator('button[type="submit"]').click();
	await page.waitForURL(url => url.pathname.endsWith("/wordlist"));
	await language(page, expected);
}
async function logout(page, user, guest, clientNavigation = false) {
	await page.getByRole("button", { name: new RegExp(user.name) }).first().click();
	await page.getByRole("button", { name: /^(Log out|Đăng xuất)$/ }).click();
	await page.waitForURL(url => !url.pathname.endsWith("/wordlist"));
	if (!clientNavigation) await page.goto(base + "/wordlist");
	await language(page, guest);
}
async function profile(locale) {
	const context = await browser.newContext({ locale, viewport: { width: 1280, height: 900 } });
	await context.route("**/*", route => new URL(route.request().url()).origin === base
		? route.continue() : route.fulfill({ body: "", contentType: "application/javascript" }));
	await context.route("**/api/v1/**", route => {
		const pathname = new URL(route.request().url()).pathname;
		if (/\/(users\/(me|language)|auth\/)/.test(pathname)) return route.continue();
		return route.fulfill({ json: { status: "success", data: { vocabularies: [], topics: [], progress: [], activities: [] } } });
	});
	const page = await context.newPage();
	await page.addInitScript(production => {
		window.__languageDocument = crypto.randomUUID();
		if (production && location.hostname === "localhost") {
			// Test-only mapping for production's public .studyjony.com selectors
			// on this HTTP localhost fixture. JWTs remain HttpOnly. This does not
			// claim to test production HTTPS/SameSite behavior or change app code.
			const cookie = Object.getOwnPropertyDescriptor(Document.prototype, "cookie");
			Object.defineProperty(Document.prototype, "cookie", { ...cookie, set(value) {
				if (/^sj_auth_(session|intent)=/.test(value)) value = value
					.replace(/; Domain=\.studyjony\.com/i, "").replace(/; Secure/i, "").replace(/SameSite=None/i, "SameSite=Lax");
				cookie.set.call(this, value);
			} });
		}
	}, productionBuild);
	page.setDefaultTimeout(45000);
	page.on("pageerror", error => pageErrors.push(error.message));
	if (process.env.STUDYJONY_TEST_DEBUG === "1") {
		page.on("console", message => { if (message.type() === "error") logs += `\nBROWSER: ${message.text()}`; });
		page.on("requestfailed", request => console.log("LOCAL REQUEST FAILED:", request.url(), request.failure()?.errorText));
		page.on("response", response => { if (response.status() >= 300 && response.status() < 400) console.log("LOCAL REDIRECT:", response.status(), response.url(), response.headers().location); });
	}
	return { context, page };
}

(async () => {
	Object.assign(process.env, { NODE_ENV: "development", JWT_SECRET: "local-language-browser-signing-key", JWT_EXPIRES_IN: "1h" });
	mongo = await MongoMemoryServer.create({ binary: { version: "7.0.14" } });
	await mongoose.connect(mongo.getUri(), { dbName: "language_browser_fixture" });
	await User.init();
	[a, b] = await User.create([
		{ name: "Language A", email: "browser-language-a@example.test", password, passwordConfirm: password, language: "en" },
		{ name: "Language B", email: "browser-language-b@example.test", password, passwordConfirm: password, language: "vi" },
	]);
	const port = await freePort(); base = `http://localhost:${port}`;
	process.env.FRONTEND_URL = base;
	const app = require(path.join(serverRoot, "node_modules/express"))();
	app.use((req, res, next) => { if (req.path === "/api/v1/users/me") accountReads++; next(); });
	app.use(require(path.join(serverRoot, "app")));
	backend = await new Promise((resolve, reject) => {
		const listener = app.listen(productionBuild ? 54321 : 0, "127.0.0.1", () => resolve(listener));
		listener.once("error", reject);
	});
	// Separate build output/config; do not touch an existing developer's Next server.
	const fixture = productionBuild ? clientRoot : fs.mkdtempSync(path.join(os.tmpdir(), "studyjony-language-next-"));
	if (!productionBuild) {
		for (const name of ["app", "i18n", "messages"]) {
			fs.cpSync(path.join(clientRoot, name), path.join(fixture, name), { recursive: true });
		}
		for (const name of ["public", "scripts", "node_modules"]) {
			fs.symlinkSync(path.join(clientRoot, name), path.join(fixture, name), process.platform === "win32" ? "junction" : "dir");
		}
		for (const name of ["package.json", "next.config.js", "jsconfig.json", "postcss.config.mjs", "security-headers.cjs", "proxy.js"]) {
			fs.copyFileSync(path.join(clientRoot, name), path.join(fixture, name));
		}
	}
	next = spawn(process.execPath, [path.join(clientRoot, "node_modules/next/dist/bin/next"),
		...(productionBuild ? ["start"] : ["dev", "--webpack"]), "--hostname", "localhost", "--port", String(port)], {
		cwd: fixture, env: { ...process.env, NODE_ENV: productionBuild ? "production" : "development",
			NEXT_PUBLIC_API_URL: `http://127.0.0.1:${backend.address().port}`,
			NEXT_PUBLIC_GOOGLE_CLIENT_ID: "", NEXT_TELEMETRY_DISABLED: "1" }, stdio: ["ignore", "pipe", "pipe"],
	});
	for (const stream of [next.stdout, next.stderr]) stream.on("data", chunk => { logs = (logs + chunk.toString()).slice(-12000); });
	let ready = false;
	for (let attempt = 0; attempt < 120; attempt++) {
		if (next.exitCode !== null) throw new Error("Local Next exited before readiness");
		try { const response = await fetch(base + "/en/login", { signal: AbortSignal.timeout(2000) }); if (response.ok) { ready = true; break; } } catch {}
		await new Promise(resolve => setTimeout(resolve, 500));
	}
	assert.equal(ready, true, "Local Next became ready");
	const viProbe = await fetch(base + "/wordlist", { headers: { Cookie: "sj_guest_language=vi", "Accept-Language": "en-US" }, redirect: "manual" });
	assert.equal(viProbe.status, 200, "Vietnamese guest SSR must not redirect to itself");
	await viProbe.body.cancel();
	console.log("READY: isolated Next and disposable backend");
	browser = await chromium.launch({ channel: "chrome", headless: true });
	const one = await profile("en-US"), two = await profile("vi-VN");
	await one.page.goto(base + "/wordlist?keep=guest"); await language(one.page, "en");
	if (process.env.STUDYJONY_TEST_DEBUG === "1") {
		const redirect = await fetch(base + "/vi/wordlist", { headers: { Cookie: "sj_guest_language=vi" }, redirect: "manual" });
		console.log("GUEST CANONICAL REDIRECT:", redirect.status, redirect.headers.get("location"));
	}
	await choose(one.page, "vi"); assert.equal(new URL(one.page.url()).search, "?keep=guest");
	await two.page.goto(base + "/wordlist"); await language(two.page, "vi"); await choose(two.page, "en");
	await one.page.reload(); await language(one.page, "vi");
	await two.page.reload(); await language(two.page, "en");
	assert.equal(await cookie(one.context), "vi"); assert.equal(await cookie(two.context), "en");
	console.log("PASS: independent guest profiles, language switch, query preservation, refresh");
	const blockedGuest = await profile("en-US");
	await blockedGuest.page.goto(base + "/en/wordlist"); await language(blockedGuest.page, "en");
	await blockedGuest.page.evaluate(() => {
		const descriptor = Object.getOwnPropertyDescriptor(Document.prototype, "cookie");
		Object.defineProperty(document, "cookie", { configurable: true,
			get: () => descriptor.get.call(document),
			set: value => { if (!value.startsWith("sj_guest_language=")) descriptor.set.call(document, value); },
		});
	});
	await select(blockedGuest.page, "vi");
	await blockedGuest.page.getByRole("alert").filter({ hasText: "Could not save language" }).waitFor();
	await language(blockedGuest.page, "en"); assert.equal(await cookie(blockedGuest.context), "en");
	await blockedGuest.context.close();
	console.log("PASS: a blocked guest cookie rolls back selection without changing the page or preference");

	await login(one.page, b, "vi"); await choose(one.page, "en");
	await login(two.page, a, "en"); await choose(two.page, "vi");
	assert.equal((await User.findById(a.id)).language, "vi");
	assert.equal((await User.findById(b.id)).language, "en");
	assert.equal(await cookie(one.context), "vi"); assert.equal(await cookie(two.context), "en");
	await Promise.all([one.page.reload(), two.page.reload()]);
	await language(one.page, "en"); await language(two.page, "vi");
	console.log("PASS: A Vietnamese/B English persist on separate accounts; account changes preserve guest choices");

	const responses = await Promise.all([
		one.context.request.get(base + "/wordlist?ssr=b", { maxRedirects: 0 }),
		two.context.request.get(base + "/en/wordlist?ssr=a", { maxRedirects: 0 }),
	]);
	assert.equal(responses[0].status(), 307); assert.equal(responses[1].status(), 307);
	assert.equal(new URL(responses[0].headers().location, base).pathname, "/en/wordlist");
	assert.equal(new URL(responses[1].headers().location, base).pathname, "/wordlist");
	assert.equal(new URL(responses[0].headers().location, base).search, "?ssr=b");
	for (const response of responses) { assert.match(response.headers()["cache-control"], /private, no-store/); assert.match(response.headers().vary, /Cookie/); }
	for (const [context, url, expected] of [[one.context, "/en/wordlist", "en"], [two.context, "/wordlist", "vi"]]) {
		const response = await context.request.get(base + url);
		assert.match(await response.text(), new RegExp(`<html[^>]*lang="${expected}"`));
	}
	console.log("PASS: concurrent SSR redirects/HTML use the correct account language; responses are private/no-store");

	// Rendering hints are not credentials. APIs must still authenticate and check origins.
	const hints = { RSC: "1", "Next-Router-Prefetch": "1" };
	const anonymous = await browser.newContext();
	try {
		assert.equal((await anonymous.request.get(base + "/api/v1/users/me", { headers: hints })).status(), 401);
		assert.equal((await anonymous.request.patch(base + "/api/v1/users/language", {
			headers: { ...hints, Origin: base }, data: { language: "vi", expectedUserId: b.id },
		})).status(), 401);
	} finally { await anonymous.close(); }
	const blocked = await one.context.request.patch(base + "/api/v1/users/language", {
		headers: { ...hints, Origin: "https://untrusted.example.test" }, data: { language: "vi", expectedUserId: b.id },
	});
	assert.equal(blocked.status(), 403);
	assert.equal((await User.findById(b.id)).language, "en");
	for (const headers of [{ ...hints, "Sec-Fetch-Mode": "navigate" }, { "Next-Router-Prefetch": "1" }]) {
		const response = await one.context.request.get(base + "/wordlist?document=guard", { headers, maxRedirects: 0 });
		assert.equal(response.status(), 307, "Document loads still check the actual account language");
		assert.equal(new URL(response.headers().location, base).pathname, "/en/wordlist");
	}
	console.log("PASS: spoofed navigation hints cannot bypass API authentication, CSRF, or document account checks");

	// Hold the save before it reaches the disposable backend. Only the switcher
	// selection changes optimistically; the confirmed account and page stay intact.
	let releaseSave, saveStarted;
	const saving = new Promise(resolve => { saveStarted = resolve; });
	const pendingSave = new Promise(resolve => { releaseSave = resolve; });
	await one.page.route("**/api/v1/users/language", async route => {
		saveStarted(); await pendingSave; await route.continue();
	});
	const originalDocument = await one.page.evaluate(() => window.__languageDocument);
	await select(one.page, "vi"); await saving;
	const switcher = one.page.getByRole("button", { name: "Choose language" }).first();
	assert.equal(await switcher.textContent(), "VI"); assert.equal(await switcher.isDisabled(), true);
	assert.equal(await switcher.evaluate(button => getComputedStyle(button).visibility), "visible");
	assert.equal(await one.page.evaluate(() => document.documentElement.lang), "en");
	assert.equal((await User.findById(b.id)).language, "en");
	releaseSave(); await language(one.page, "vi");
	await one.page.unroute("**/api/v1/users/language");
	assert.equal(await one.page.evaluate(() => window.__languageDocument), originalDocument);
	await choose(one.page, "en");
	console.log("PASS: immediate selection feedback, visible page during saving, no premature account update or reload");

	// Use a real, naturally scrollable page rather than adding fake document height.
	await one.page.goto(base + "/en?keep=one&keep=two&encoded=a%20b"); await language(one.page, "en");
	await one.page.evaluate(() => window.scrollTo(0, 240));
	assert.ok(await one.page.evaluate(() => scrollY > 0), "Scroll fixture is naturally scrollable");
	await choose(one.page, "vi"); await choose(one.page, "en");
	console.log("PASS: real scroll position, current page, and repeated/encoded query parameters survive both switches");

	const three = await profile("vi-VN");
	await three.page.goto(base + "/wordlist"); await language(three.page, "vi");
	await login(three.page, b, "en");
	await logout(three.page, b, "vi");
	await login(three.page, a, "vi");
	await logout(three.page, a, "vi");
	await login(three.page, b, "en");
	console.log("PASS: fresh browser restores saved account language; logout restores the guest; A/B account switching stays isolated");

	await one.page.route("**/api/v1/users/language", route => route.fulfill({ status: 503, json: { status: "error" } }));
	await select(one.page, "vi");
	await one.page.getByRole("alert").filter({ hasText: "Could not save language" }).waitFor();
	await language(one.page, "en"); assert.equal((await User.findById(b.id)).language, "en");
	await one.page.unroute("**/api/v1/users/language");
	console.log("PASS: failed saves show an error and do not replace the saved language");

	// A completed write with a delayed response must not update the next account.
	await User.updateOne({ _id: b.id }, { language: "vi" });
	let release, saved, delivered;
	const held = new Promise(resolve => { release = resolve; });
	const written = new Promise(resolve => { saved = resolve; });
	const completed = new Promise(resolve => { delivered = resolve; });
	await two.page.route("**/api/v1/users/language", async route => {
		try {
			const response = await route.fetch(); saved(); await held;
			await route.fulfill({ response }); delivered(null);
		} catch (error) { saved(); delivered(error); }
	});
	await select(two.page, "en"); await written;
	await logout(two.page, a, "en", true); await login(two.page, b, "vi", true);
	release(); assert.equal(await completed, null);
	await two.page.unroute("**/api/v1/users/language");
	await language(two.page, "vi");
	assert.equal((await User.findById(b.id)).language, "vi");
	await choose(two.page, "en");
	assert.deepEqual(pageErrors, []);
	console.log("PASS: late A save cannot change B after logout/login");
})().catch(error => {
	console.error(error.message);
	// Logs are from the synthetic local server only; never dump environment files.
	if (process.env.STUDYJONY_TEST_DEBUG === "1") console.error(logs);
	process.exitCode = 1;
}).finally(async () => {
	if (browser) await Promise.race([browser.close(), new Promise(resolve => setTimeout(resolve, 5000))]);
	if (next?.pid && next.exitCode === null) {
		if (process.platform === "win32") {
			try { execFileSync("taskkill", ["/PID", String(next.pid), "/T", "/F"], { stdio: "ignore", timeout: 5000 }); } catch { next.kill(); }
		} else next.kill("SIGTERM");
	}
	if (backend) { backend.closeAllConnections(); await new Promise(resolve => backend.close(resolve)); }
	await mongoose.disconnect(); await mongo?.stop();
});
