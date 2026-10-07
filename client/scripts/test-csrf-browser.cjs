// Local browser origins + full Express app + disposable database; no production requests.
const assert = require("node:assert/strict");
const http = require("node:http");
const { chromium } = require("playwright");
const mongoose = require("../../server/node_modules/mongoose");
const jwt = require("../../server/node_modules/jsonwebtoken");
const { MongoMemoryServer } = require("../../server/node_modules/mongodb-memory-server");
const User = require("../../server/models/userModel");
const StudyActivity = require("../../server/models/studyActivityModel");
const baseURL = process.env.STUDYJONY_TEST_URL || "http://localhost:3000";
const base = new URL(baseURL);
assert.equal(base.hostname, "localhost", "Local browser cookie test only");
let db, backend, attacker, browser, sequence = 0;
const listen = server => new Promise(resolve => server.listen(0, "127.0.0.1", () => resolve(server)));

async function run(width, locale, theme) {
	await Promise.all([User.deleteMany({}), StudyActivity.deleteMany({})]);
	const user = await User.create({ name: "CSRF learner", email: `csrf-${++sequence}@example.test`, googleId: `csrf-${sequence}`, theme });
	const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: "1h" });
	const context = await browser.newContext({ viewport: { width, height: 740 }, hasTouch: width < 768, colorScheme: theme });
	const page = await context.newPage(), requests = [], errors = [], evilOrigin = `http://localhost:${attacker.address().port}`;
	await context.addCookies([{ name: "jwt", value: token, url: baseURL, httpOnly: true, sameSite: "Lax" }]);
	await context.addInitScript(theme => localStorage.setItem("studyjony-theme", theme), theme);
	page.on("pageerror", error => errors.push(error.message));
	page.on("console", message => {
		if (message.type() === "error" && !message.text().startsWith("Failed to load resource")) errors.push(message.text());
	});
	await context.route("**/*", route => [base.origin, evilOrigin].includes(new URL(route.request().url()).origin) ? route.continue()
		: route.fulfill({ contentType: "application/javascript", body: "" }));
	await context.route("**/_vercel/insights/**", route => route.fulfill({ contentType: "application/javascript", body: "" }));
	await context.route("**/api/v1/**", async route => {
		const request = route.request(), target = new URL(request.url());
		if (!target.pathname.startsWith("/api/v1/users/") && !target.pathname.startsWith("/api/v1/auth/") && !target.pathname.startsWith("/api/v1/study-activities")) {
			return route.fulfill({ json: { status: "success", data: { vocabularies: [], topics: [], progress: [], activities: [] } } });
		}
		const headers = await request.allHeaders(); delete headers.host; delete headers["content-length"];
		const response = await fetch(`http://127.0.0.1:${backend.address().port}${target.pathname}${target.search}`, {
			method: request.method(), headers, redirect: "manual", ...(request.postData() ? { body: request.postData() } : {}),
		});
		const cookies = response.headers.getSetCookie(), responseHeaders = Object.fromEntries(response.headers);
		requests.push({ path: target.pathname, method: request.method(), origin: headers.origin, hasAuthCookie: /(?:^|; )jwt=/.test(headers.cookie || ""), status: response.status, cookieWrites: cookies.length });
		delete responseHeaders["content-length"]; delete responseHeaders["content-encoding"];
		if (cookies.length) responseHeaders["set-cookie"] = cookies.join("\n");
		await route.fulfill({ status: response.status, headers: responseHeaders, body: Buffer.from(await response.arrayBuffer()) });
	});
	try {
		await page.goto(baseURL + (locale === "en" ? "/en" : "") + "/profile", { waitUntil: "domcontentloaded", timeout: 60000 });
		await page.locator("header.sticky button.group").waitFor();
		assert.equal(await page.evaluate(() => document.cookie.includes("jwt=")), false);
		const safe = await page.evaluate(async () => {
			const response = await fetch("/api/v1/users/updateMe", { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Safe learner" }) });
			return response.status;
		});
		assert.equal(safe, 200); assert.equal((await User.findById(user.id)).name, "Safe learner");
		const evil = await context.newPage(); await evil.goto(evilOrigin);
		// Same-site but cross-origin localhost ports ensure the real auth cookie is delivered.
		await evil.evaluate(async target => { await fetch(`${target}/api/v1/study-activities`, { method: "POST", credentials: "include", mode: "no-cors", headers: { "Content-Type": "text/plain" }, body: "ignored=1" }); }, baseURL);
		// Observe context-wide route records rather than relying on cross-origin response readability.
		const plain = requests.filter(item => item.method === "POST" && item.path.endsWith("/study-activities")).at(-1);
		assert.equal(plain.origin, evilOrigin); assert.equal(plain.hasAuthCookie, true); assert.equal(plain.status, 403); assert.equal(plain.cookieWrites, 0);
		const posted = evil.waitForResponse(response => response.url().endsWith("/auth/logout"));
		await evil.evaluate(target => {
			const form = document.createElement("form"); form.method = "POST"; form.action = `${target}/api/v1/auth/logout`; document.body.append(form); form.submit();
		}, baseURL);
		assert.equal((await posted).status(), 403);
		await evil.waitForURL(baseURL + "/api/v1/auth/logout");
		const logout = requests.filter(item => item.method === "POST" && item.path.endsWith("/auth/logout")).at(-1);
		assert.equal(logout.origin, evilOrigin); assert.equal(logout.hasAuthCookie, true); assert.equal(logout.cookieWrites, 0);
		await evil.goto(`data:text/html,${encodeURIComponent(`<form method="POST" action="${baseURL}/api/v1/auth/logout"></form>`)}`);
		const opaque = evil.waitForResponse(response => response.url().endsWith("/auth/logout"));
		await evil.locator("form").evaluate(form => form.submit());
		assert.equal((await opaque).status(), 403);
		const nullOrigin = requests.filter(item => item.method === "POST" && item.path.endsWith("/auth/logout")).at(-1);
		assert.equal(nullOrigin.origin, "null"); assert.equal(nullOrigin.cookieWrites, 0);
		assert.equal(await StudyActivity.countDocuments({ user: user.id }), 0);
		assert.equal((await context.cookies()).find(cookie => cookie.name === "jwt").value, token, "Blocked responses never replaced/cleared the session");
		assert.equal(await page.evaluate(async () => (await (await fetch("/api/v1/users/me", { credentials: "include" })).json()).data.user.name), "Safe learner");
		assert.equal(await page.evaluate(async () => (await fetch("/api/v1/auth/logout", { method: "POST", credentials: "include" })).status), 200);
		assert.equal(await page.evaluate(async () => (await fetch("/api/v1/users/me", { credentials: "include" })).status), 401);
		assert.ok(!(await context.cookies()).some(cookie => cookie.name === "jwt"));
		assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
		assert.deepEqual(errors, []);
	} finally { await context.close(); }
}

(async () => {
	try {
		Object.assign(process.env, { NODE_ENV: "development", FRONTEND_URL: baseURL, JWT_SECRET: "isolated-csrf-browser" });
		db = await MongoMemoryServer.create({ binary: { version: "7.0.14" } });
		await mongoose.connect(db.getUri(), { dbName: "csrf_browser" }); await User.init();
		backend = await listen(http.createServer(require("../../server/app")));
		attacker = await listen(http.createServer((req, res) => { res.setHeader("Content-Type", "text/html"); res.end("<p>Local attacker fixture</p>"); }));
		browser = await chromium.launch({ channel: "chrome", headless: true });
		let cases = 0;
		for (const width of [375, 1280]) for (const locale of ["vi", "en"]) for (const theme of ["light", "dark"]) {
			await run(width, locale, theme); cases++;
			console.log(`PASS ${width}px ${locale} ${theme}: trusted mutation; real-cookie cross-origin activity/form logout/null Origin rejected; me/logout preserved`);
		}
		console.log(`PASS ${cases} browser cases; local origins/disposable database only`);
	} finally {
		await browser?.close();
		for (const server of [backend, attacker]) if (server) await new Promise(resolve => server.close(resolve));
		await mongoose.disconnect(); await db?.stop();
	}
})().catch(error => { console.error(error); process.exitCode = 1; });
