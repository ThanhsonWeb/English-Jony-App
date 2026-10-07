// Local Next + full Express app/disposable replica set; no live backend/providers.
const assert = require("node:assert/strict");
const http = require("node:http");
const { chromium } = require("playwright");
const mongoose = require("../../server/node_modules/mongoose");
const jwt = require("../../server/node_modules/jsonwebtoken");
const { MongoMemoryReplSet } = require("../../server/node_modules/mongodb-memory-server");
const User = require("../../server/models/userModel");
const DialogueProgress = require("../../server/models/dialogueProgressModel");
const StudyActivity = require("../../server/models/studyActivityModel");
const XPEvent = require("../../server/models/xpEventModel");
const limits = require("../../server/middleware/learningRateLimit");
const originalGuards = { peer: limits.peer, user: limits.user };
const baseURL = process.env.STUDYJONY_TEST_URL || "http://localhost:3000";
const base = new URL(baseURL);
assert.ok(["localhost", "127.0.0.1"].includes(base.hostname), "Local Next only");
let db, server, browser, activeLimits, sequence = 0;

async function run(width, locale, theme) {
	activeLimits = limits.createLearningRateLimits();
	await Promise.all([User, DialogueProgress, StudyActivity, XPEvent].map(model => model.deleteMany({})));
	const user = await User.create({ name: "Learning tester", email: `learning-${++sequence}@example.test`, googleId: `isolated-${sequence}`, theme });
	const context = await browser.newContext({ viewport: { width, height: 800 }, hasTouch: width < 768, colorScheme: theme });
	const page = await context.newPage(), errors = [], writes = [];
	page.setDefaultTimeout(20000);
	await context.addCookies([{ name: "jwt", value: jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: "1h" }), url: baseURL, httpOnly: true, sameSite: "Lax" }]);
	await context.addInitScript(theme => localStorage.setItem("studyjony-theme", theme), theme);
	page.on("pageerror", error => errors.push(error.message));
	page.on("console", message => { if (message.type() === "error" && !message.text().startsWith("Failed to load resource")) errors.push(message.text()); });
	await context.route("**/*", route => new URL(route.request().url()).origin === base.origin ? route.continue()
		: route.fulfill({ contentType: "application/javascript", body: "" }));
	await context.route("**/_vercel/insights/**", route => route.fulfill({ contentType: "application/javascript", body: "" }));
	await context.route("**/api/v1/**", async route => {
		const request = route.request(), target = new URL(request.url());
		if (!["/api/v1/users/me", "/api/v1/dialogue-progress", "/api/v1/study-activities"].some(path => target.pathname === path || target.pathname.startsWith(path + "/"))) {
			return route.fulfill({ json: { status: "success", data: { vocabularies: [], topics: [], activities: [], progress: [] } } });
		}
		const headers = await request.allHeaders(); delete headers.host; delete headers["content-length"];
		const response = await fetch(`http://127.0.0.1:${server.address().port}${target.pathname}${target.search}`, {
			method: request.method(), headers, redirect: "manual", ...(request.postData() ? { body: request.postData() } : {}),
		});
		const body = Buffer.from(await response.arrayBuffer());
		if (["PATCH", "POST"].includes(request.method())) writes.push({ path: target.pathname, status: response.status });
		const cookies = response.headers.getSetCookie(), responseHeaders = Object.fromEntries(response.headers);
		delete responseHeaders["content-length"]; delete responseHeaders["content-encoding"];
		if (cookies.length) responseHeaders["set-cookie"] = cookies.join("\n");
		await route.fulfill({ status: response.status, headers: responseHeaders, body });
	});
	const prefix = locale === "en" ? "/en" : "", t = require(`../messages/${locale}.json`).DialogueFeature;
	const paths = ["/dialogue/asking-for-directions/finding-a-cafe/1", "/dialogue/ten-minutes-a-day/the-old-book/1"];
	async function open(path, answer) {
		await page.goto(baseURL + prefix + path, { waitUntil: "domcontentloaded", timeout: 60000 });
		await page.locator("header.sticky button.group").waitFor();
		await page.waitForFunction(theme => document.documentElement.dataset.theme === theme, theme);
		await page.locator('input[placeholder="..."]').first().fill(answer);
	}
	try {
		for (const [path, answer] of [[paths[0], "find"], [paths[0], "find"], [paths[1], "book"]]) {
			await open(path, answer);
			await page.getByRole("button", { name: t.check, exact: true }).click();
			await page.getByRole("link", { name: t.continueArrow, exact: true }).waitFor();
			assert.equal(writes.at(-1).status, 200);
		}
		assert.equal(await XPEvent.countDocuments({ user: user.id }), 2);
		assert.equal((await User.findById(user.id)).totalXp, 20);
		assert.equal(await DialogueProgress.countDocuments({ user: user.id }), 2);
		// Read endpoints and the legacy activity write work through the full app/CSRF guard.
		const result = await page.evaluate(async () => {
			const paths = ["/api/v1/dialogue-progress/asking-for-directions", "/api/v1/dialogue-progress/ten-minutes-a-day", "/api/v1/dialogue-progress/latest", "/api/v1/study-activities"];
			return { reads: await Promise.all(paths.map(async path => (await fetch(path)).status)),
				write: (await fetch("/api/v1/study-activities", { method: "POST" })).status };
		});
		assert.deepEqual(result, { reads: [200, 200, 200, 200], write: 200 });
		await open(paths[0], "find");
		// Small fixture-only quota exercises the existing localized failure/Retry UI.
		activeLimits = limits.createLearningRateLimits({ ...limits.learningRateLimitPolicy, windowMs: 2000, writeUser: 1 });
		assert.equal(await page.evaluate(async () => (await fetch("/api/v1/study-activities", { method: "POST" })).status), 200);
		await page.getByRole("button", { name: t.check, exact: true }).click();
		const alert = page.getByRole("alert"); await alert.getByText(t.progressSaveFailed, { exact: true }).waitFor();
		assert.equal(writes.at(-1).status, 429);
		assert.equal(await page.getByRole("link", { name: t.continueArrow, exact: true }).count(), 0, "Failed save must not offer Continue");
		assert.equal(await page.evaluate(async () => (await fetch("/api/v1/study-activities", { method: "POST" })).status), 429);
		assert.equal((await StudyActivity.findOne({ user: user.id })).count, 2, "Rejected activity must not increment legacy count");
		await new Promise(resolve => setTimeout(resolve, 2100));
		await alert.getByRole("button", { name: t.retryProgressSave, exact: true }).click({ clickCount: 3 });
		const next = page.getByRole("link", { name: t.continueArrow, exact: true }); await next.waitFor();
		assert.equal(writes.filter(item => item.path.includes("/tasks/") && item.status === 200).length, 4, "Retry triple-click submits once");
		assert.equal(await XPEvent.countDocuments({ user: user.id }), 2);
		assert.equal((await User.findById(user.id)).totalXp, 20);
		await next.click(); await page.waitForURL(url => url.pathname === prefix + paths[0].replace(/1$/, "2"));
		assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
}

(async () => {
	try {
		Object.assign(process.env, { NODE_ENV: "development", FRONTEND_URL: baseURL, JWT_SECRET: "isolated-learning-browser" });
		db = await MongoMemoryReplSet.create({ binary: { version: "7.0.14" }, replSet: { count: 1 } });
		await mongoose.connect(db.getUri(), { dbName: "learning_browser" });
		await Promise.all([User, DialogueProgress, StudyActivity, XPEvent].map(model => model.init()));
		limits.peer = (req, res, next) => activeLimits.peer(req, res, next);
		limits.user = (req, res, next) => activeLimits.user(req, res, next);
		server = await new Promise(resolve => { const listener = http.createServer(require("../../server/app")).listen(0, "127.0.0.1", () => resolve(listener)); });
		browser = await chromium.launch({ channel: "chrome", headless: true });
		let cases = 0;
		for (const width of [320, 375, 430, 1280]) for (const locale of ["vi", "en"]) for (const theme of ["light", "dark"]) {
			await run(width, locale, theme); cases++;
			console.log(`PASS ${width}px ${locale} ${theme}: Dialogue/Story read/save/replay; activity; 429 localized Retry; expiry; XP dedup; navigation`);
		}
		console.log(`PASS ${cases} browser cases; local full app/disposable DB only`);
	} finally {
		Object.assign(limits, originalGuards);
		await browser?.close();
		if (server) await new Promise(resolve => server.close(resolve));
		await mongoose.disconnect(); await db?.stop();
	}
})().catch(error => { console.error(error); process.exitCode = 1; });
