// Self-contained local Next + real Express + disposable MongoDB. No production services.
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
let mongo, backend, next, browser, base, logs = "", a, b;
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
async function choose(page, expected) { await select(page, expected); await language(page, expected); }
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
	backend = await new Promise(resolve => { const listener = require(path.join(serverRoot, "app")).listen(0, "127.0.0.1", () => resolve(listener)); });
	// Separate build output/config; do not touch an existing developer's Next server.
	const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "studyjony-language-next-"));
	for (const name of ["app", "i18n", "messages"]) {
		fs.cpSync(path.join(clientRoot, name), path.join(fixture, name), { recursive: true });
	}
	for (const name of ["public", "scripts", "node_modules"]) {
		fs.symlinkSync(path.join(clientRoot, name), path.join(fixture, name), process.platform === "win32" ? "junction" : "dir");
	}
	for (const name of ["package.json", "next.config.js", "jsconfig.json", "postcss.config.mjs", "security-headers.cjs", "proxy.js"]) {
		fs.copyFileSync(path.join(clientRoot, name), path.join(fixture, name));
	}
	next = spawn(process.execPath, [path.join(clientRoot, "node_modules/next/dist/bin/next"), "dev", "--webpack", "--hostname", "localhost", "--port", String(port)], {
		cwd: fixture, env: { ...process.env, NEXT_PUBLIC_API_URL: `http://127.0.0.1:${backend.address().port}`,
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
