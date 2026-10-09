// Local Next UI + disposable backend, real HttpOnly cookies, mocked Google only.
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const express = require("../../../../server/node_modules/express");
const cookieParser = require("../../../../server/node_modules/cookie-parser");
const mongoose = require("../../../../server/node_modules/mongoose");
const { MongoMemoryServer } = require("../../../../server/node_modules/mongodb-memory-server");
const { OAuth2Client } = require("../../../../server/node_modules/google-auth-library");
const User = require("../../../../server/models/userModel");
const baseURL = process.env.STUDYJONY_TEST_URL || "http://localhost:3016";
const base = new URL(baseURL);
assert.ok(["localhost", "127.0.0.1"].includes(base.hostname), "Local Next only");
const password = "isolated-browser-password";
let db, backend, browser, A, B, sequence = 0;
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }

async function setup(width, locale, theme) {
	const context = await browser.newContext({ viewport: { width, height: 740 }, hasTouch: width < 768, colorScheme: theme });
	const page = await context.newPage(), errors = [], prefix = locale === "en" ? "/en" : "";
	const messages = require(`../../../messages/${locale}.json`);
	let gate = null, credentialPosts = 0;
	page.setDefaultTimeout(20000);
	page.on("pageerror", error => errors.push(error.message));
	page.on("console", message => {
		if (message.type() === "error" && !(message.text().startsWith("Failed to load resource") && message.location().url.includes("/api/v1/"))) errors.push(message.text());
	});
	await context.addInitScript(theme => {
		localStorage.setItem("studyjony-theme", theme);
		window.authNavigations = [];
		// Simulate a response that completes despite AbortSignal cancellation.
		const originalFetch = window.fetch.bind(window);
		window.fetch = (url, options) => originalFetch(url, String(url).includes("/auth/credentials/")
			? { ...options, signal: undefined } : options);
		let nextValue;
		const wrap = router => {
			if (!router || router.__authSpy) return router;
			for (const method of ["push", "replace"]) {
				const original = router[method].bind(router);
				router[method] = (href, ...args) => { window.authNavigations.push(String(href)); return original(href, ...args); };
			}
			router.__authSpy = true; return router;
		};
		Object.defineProperty(window, "next", { configurable: true, get: () => nextValue, set(value) {
			nextValue = value; if (!value) return;
			let router = wrap(value.router);
			Object.defineProperty(value, "router", { configurable: true, get: () => router, set: value => { router = wrap(value); } });
		} });
	}, theme);
	await context.route("**/*", route => new URL(route.request().url()).origin === base.origin ? route.continue()
		: route.fulfill({ contentType: "application/javascript", body: new URL(route.request().url()).hostname === "accounts.google.com"
			? "window.google={accounts:{oauth2:{initCodeClient:()=>({requestCode(){window.googleStarted=true;}})}}};" : "" }));
	await context.route("**/_vercel/insights/**", route => route.fulfill({ contentType: "application/javascript", body: "" }));
	await context.route("**/api/v1/**", async route => {
		const request = route.request(), parsed = new URL(request.url());
		if (!parsed.pathname.startsWith("/api/v1/auth/") && !parsed.pathname.startsWith("/api/v1/users/")) {
			return route.fulfill({ json: { status: "success", data: { vocabularies: [], topics: [], progress: [], activities: [], counts: {}, users: [] } } });
		}
		const headers = await request.allHeaders();
		delete headers.host; delete headers["content-length"];
		const response = await fetch(`http://127.0.0.1:${backend.address().port}${parsed.pathname}${parsed.search}`, {
			method: request.method(), headers, redirect: "manual", ...(request.postData() ? { body: request.postData() } : {}),
		});
		const responseHeaders = Object.fromEntries(response.headers);
		delete responseHeaders["content-length"]; delete responseHeaders["content-encoding"];
		const setCookies = response.headers.getSetCookie();
		if (setCookies.length) responseHeaders["set-cookie"] = setCookies.join("\n");
		const body = await response.text();
		const current = gate;
		let deliveredGate;
		if (/\/credentials\/(login|signup)$/.test(parsed.pathname)) {
			credentialPosts++;
			if (current && JSON.parse(request.postData()).email === current.email) {
				deliveredGate = current;
				gate = null; current.started.resolve(); await current.release.promise;
			}
		}
		await route.fulfill({ status: response.status, headers: responseHeaders, body }).catch(error => {
			if (!page.isClosed()) throw error;
		});
		deliveredGate?.delivered.resolve();
	});
	async function navigate(path) {
		await page.evaluate(path => window.next.router.push(path), prefix + path);
		await page.waitForURL(url => url.pathname === prefix + path);
	}
	async function login(user, slow = false, wrong = false) {
		await page.locator("#login-email").fill(user.email);
		await page.locator("#login-password").fill(wrong ? "incorrect-password" : password);
		let held;
		if (slow) { held = { email: user.email, started: deferred(), release: deferred(), delivered: deferred() }; gate = held; }
		await page.locator("form").evaluate(form => form.requestSubmit());
		if (held) await held.started.promise;
		else await page.waitForURL(url => url.pathname === prefix + "/wordlist");
		return held;
	}
	async function release(held, expected) {
		const navigation = await page.evaluate(() => [...window.authNavigations]);
		held.release.resolve();
		// Wait for the deliberately late response and its guarded handler/cleanup.
		await held.delivered.promise;
		await page.waitForTimeout(150);
		assert.deepEqual(await page.evaluate(() => window.authNavigations), navigation, "Stale response must not navigate");
		await assertSession(expected);
	}
	async function assertSession(expected) {
		const response = await page.evaluate(async () => {
			const res = await fetch("/api/v1/users/me", { credentials: "include" });
			return { status: res.status, id: (await res.json())?.data?.user?._id };
		});
		assert.equal(response.status, expected ? 200 : 401);
		assert.equal(response.id || null, expected?.id || null);
		if (expected) {
			assert.ok((await page.getByRole("banner").textContent()).includes(expected.name), "Visible account must match the server cookie session");
			const allCookies = await context.cookies(baseURL);
			const selected = allCookies.find(cookie => cookie.name === "sj_auth_session")?.value;
			const active = allCookies.find(cookie => cookie.name === (selected === "legacy" ? "jwt" : `sj_auth_${selected}`));
			assert.ok(active?.httpOnly, "The selected credential remains HttpOnly");
			assert.equal(await page.evaluate(() => /(?:^|;\s*)(jwt|sj_auth_[a-f0-9]{32})=/.test(document.cookie)), false, "JavaScript never receives the JWT");
		}
		assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "No horizontal overflow");
	}
	async function finish(expected) {
		await page.getByRole("banner").waitFor();
		await page.reload({ waitUntil: "domcontentloaded" });
		if (expected) await page.getByText(expected.name, { exact: true }).first().waitFor({ state: "attached" });
		await assertSession(expected);
		assert.deepEqual(errors, [], "No hydration/runtime/unexpected console errors");
		await context.close();
	}
	await page.goto(baseURL + prefix + "/login");
	await page.locator("#login-email").waitFor();
	return { page, messages, context, prefix, navigate, login, release, finish, assertSession,
		hold(email) { gate = { email, started: deferred(), release: deferred(), delivered: deferred() }; return gate; },
		posts: () => credentialPosts,
	};
}

async function run(width, locale, theme, scenario) {
	const c = await setup(width, locale, theme), { page, prefix } = c;
	try {
		if (scenario === "logout-revocation") {
			await c.login(A);
			const cookies = await c.context.cookies(baseURL);
			const selected = cookies.find(cookie => cookie.name === "sj_auth_session").value;
			const copied = cookies.find(cookie => cookie.name === `sj_auth_${selected}`).value;
			// A separate device/session for the same account must remain signed in.
			const otherLogin = await fetch(`http://127.0.0.1:${backend.address().port}/api/v1/auth/login`, {
				method: "POST", headers: { "Content-Type": "application/json", Origin: baseURL },
				body: JSON.stringify({ email: A.email, password }),
			});
			assert.equal(otherLogin.status, 200);
			const other = otherLogin.headers.getSetCookie().find(cookie => cookie.startsWith("jwt=")).split(";", 1)[0].slice(4);
			const tab = await c.context.newPage(); await tab.goto(baseURL + prefix + "/wordlist");
			await tab.getByText(A.name, { exact: true }).first().waitFor({ state: "attached" });
			await page.getByRole("banner").locator("button").filter({ hasText: A.name }).click();
			const response = page.waitForResponse(value => new URL(value.url()).pathname === "/api/v1/auth/logout");
			await page.getByRole("button", { name: c.messages.Header.logout, exact: true }).click();
			assert.equal((await response).status(), 200);
			await page.waitForURL(url => url.pathname === (prefix || "/"));
			const check = token => fetch(`http://127.0.0.1:${backend.address().port}/api/v1/users/me`, {
				headers: { Authorization: `Bearer ${token}` },
			});
			assert.equal((await check(copied)).status, 401, "A copied browser JWT is revoked after logout");
			assert.equal((await check(other)).status, 200, "An independent session survives");
			assert.equal(await tab.evaluate(async () => (await fetch("/api/v1/users/me")).status), 401);
			assert.equal((await c.context.cookies(baseURL)).some(cookie => cookie.name === `sj_auth_${selected}`), false);
			await tab.close(); await c.finish(null); return;
		}
		if (scenario === "duplicate-signup") {
			await c.navigate("/signup");
			await page.locator("#signup-name").fill("Test learner");
			await page.locator("#signup-email").fill(A.email);
			await page.locator("#signup-password").fill(password);
			await page.locator("#signup-password-confirm").fill(password);
			await page.locator("form").evaluate(form => { form.requestSubmit(); form.requestSubmit(); form.requestSubmit(); });
			await page.getByRole("alert").filter({ hasText: c.messages.Auth.signupUnavailable }).waitFor();
			assert.equal(c.posts(), 1); assert.equal(await page.locator("button[type=submit]").isDisabled(), false);
			assert.equal(await page.locator("#signup-email").inputValue(), A.email);
			const email = `retry-${++sequence}@example.test`;
			await page.locator("#signup-email").fill(email); await page.locator("form").evaluate(form => form.requestSubmit());
			await page.waitForURL(url => url.pathname === prefix + "/wordlist");
			assert.equal(await User.countDocuments({ email }), 1);
			await c.finish(await User.findOne({ email })); return;
		}
		if (scenario === "logout") { await c.login(B); await c.navigate("/login"); }
		if (scenario === "retry") {
			await page.locator("#login-email").fill(A.email);
			await page.locator("#login-password").fill("incorrect-password");
			await page.locator("form").evaluate(form => form.requestSubmit());
			await page.getByRole("alert").filter({ hasText: c.messages.Auth.invalidCredentials }).waitFor();
			assert.equal(await page.locator("button[type=submit]").isDisabled(), false, "Current failures unlock Retry");
			await c.login(B); await c.finish(B); return;
		}
		if (scenario === "signup" || scenario === "normal-signup") {
			await c.navigate("/signup");
			const learner = { name: "New Learner", email: `new-${++sequence}@example.test` };
			const held = c.hold(learner.email);
			await page.locator("#signup-name").fill(learner.name);
			await page.locator("#signup-email").fill(learner.email);
			await page.locator("#signup-password").fill(password);
			await page.locator("#signup-password-confirm").fill(password);
			await page.locator("form").evaluate(form => { form.requestSubmit(); form.requestSubmit(); form.requestSubmit(); });
			await held.started.promise;
			assert.equal(c.posts(), 1, "Synchronous signup guard prevents duplicate POSTs");
			assert.equal(await User.countDocuments({ email: learner.email }), 1);
			if (scenario === "normal-signup") {
				held.release.resolve(); await page.waitForURL(url => url.pathname === prefix + "/wordlist");
				const created = await User.findOne({ email: learner.email }); await c.finish(created);
			} else {
				await page.getByRole("link", { name: c.messages.Auth.close, exact: true }).click();
				await c.navigate("/login"); await c.login(B); await c.release(held, B); await c.finish(B);
			}
			return;
		}
		const held = await c.login(A, true, scenario === "failed-old");
		if (scenario === "cross-tab") {
			const newer = await c.context.newPage();
			await newer.goto(baseURL + prefix + "/login");
			await newer.locator("#login-email").fill(B.email);
			await newer.locator("#login-password").fill(password);
			await newer.locator("form").evaluate(form => form.requestSubmit());
			await newer.waitForURL(url => url.pathname === prefix + "/wordlist");
			const navigation = await page.evaluate(() => [...window.authNavigations]);
			held.release.resolve(); await held.delivered.promise; await page.waitForTimeout(150);
			assert.deepEqual(await page.evaluate(() => window.authNavigations), navigation, "The older tab must not navigate after B logs in");
			const id = await newer.evaluate(async () => (await (await fetch("/api/v1/users/me")).json()).data.user._id);
			assert.equal(id, B.id, "The older tab must not replace B's active cookie");
			await newer.reload({ waitUntil: "domcontentloaded" });
			await newer.getByText(B.name, { exact: true }).first().waitFor({ state: "attached" });
			return;
		} else if (["rapid", "failed-old"].includes(scenario)) {
			await c.login(B);
			await c.release(held, B); await c.finish(B);
		} else if (scenario === "Google") {
			await page.getByRole("button", { name: c.messages.Auth.googleLogin, exact: true }).click();
			await page.waitForFunction(() => window.googleStarted === true);
			await page.evaluate(async () => {
				const state = (await (await fetch("/api/v1/auth/google/state?locale=en", { credentials: "include" })).json()).data.state;
				await fetch(`/api/v1/auth/google/callback?state=${encodeURIComponent(state)}&code=mock-code`, { credentials: "include" });
			});
			await c.navigate("/oauth/google/callback");
			await page.waitForURL(url => url.pathname === prefix + "/wordlist");
			await c.release(held, B); await c.finish(B);
		} else {
			await page.getByRole("link", { name: c.messages.Auth.close, exact: true }).click();
			if (scenario === "B") { await c.navigate("/login"); await c.login(B); }
			if (scenario === "logout") {
				await page.getByRole("banner").locator("button").filter({ hasText: B.name }).click();
				await page.getByRole("button", { name: c.messages.Header.logout, exact: true }).click();
				await page.waitForURL(url => url.pathname === (prefix || "/"));
			}
			await c.release(held, scenario === "B" ? B : null); await c.finish(scenario === "B" ? B : null);
		}
	} finally { await c.context.close(); }
}

(async () => {
	Object.assign(process.env, { NODE_ENV: "development", JWT_SECRET: "isolated-browser-session-secret", JWT_EXPIRES_IN: "1h",
		FRONTEND_URL: baseURL, GOOGLE_CLIENT_ID: "mock-client", GOOGLE_CLIENT_SECRET: "mock-secret", GOOGLE_REDIRECT_URI: `${baseURL}/api/v1/auth/google/callback` });
	const getToken = OAuth2Client.prototype.getToken, verifyIdToken = OAuth2Client.prototype.verifyIdToken;
	try {
		db = await MongoMemoryServer.create({ binary: { version: "7.0.14" } });
		await mongoose.connect(db.getUri(), { dbName: "credential_browser_test" });
		[A, B] = await User.create([
			{ name: "Account A", email: "a@example.test", password, passwordConfirm: password },
			{ name: "Account B", email: "b@example.test", googleId: "google-B", password, passwordConfirm: password },
		]);
		OAuth2Client.prototype.getToken = async () => ({ tokens: { id_token: "mock-google-token" } });
		OAuth2Client.prototype.verifyIdToken = async () => ({ getPayload: () => ({ email: B.email, name: B.name, sub: B.googleId, email_verified: true }) });
		const app = express();
		app.use("/api/v1", require("../../../../server/middleware/csrfProtection"));
		app.use(express.json(), cookieParser());
		app.use("/api/v1/auth", require("../../../../server/routes/authRoutes"));
		app.use("/api/v1/users", require("../../../../server/routes/userRoutes"));
		app.use((error, req, res, next) => res.status(error.statusCode || 500).json({ status: "fail", message: error.statusCode === 401 ? error.message : "Request failed" }));
		backend = await new Promise(resolve => { const listener = app.listen(0, "127.0.0.1", () => resolve(listener)); });
		browser = await chromium.launch({ channel: "chrome", headless: true });
		let checks = 0;
		const scenarios = process.env.STUDYJONY_F06_SCENARIOS?.split(",") || ["B", "logout", "Google", "navigation", "rapid", "failed-old", "signup", "normal-signup", "retry", "cross-tab", "logout-revocation", "duplicate-signup"];
		assert.ok(scenarios.every(value => ["B", "logout", "Google", "navigation", "rapid", "failed-old", "signup", "normal-signup", "retry", "cross-tab", "logout-revocation", "duplicate-signup"].includes(value)));
		for (const width of [320, 375, 430, 1280]) for (const locale of ["vi", "en"]) for (const theme of ["light", "dark"]) {
			for (const scenario of scenarios) {
				await run(width, locale, theme, scenario); checks++;
			}
			console.log(`PASS ${width}px ${locale} ${theme}: ${scenarios.length} real-cookie credential scenarios`);
		}
		console.log(`PASS ${checks} browser scenarios; real disposable backend + mocked Google; no production access`);
	} finally {
		OAuth2Client.prototype.getToken = getToken; OAuth2Client.prototype.verifyIdToken = verifyIdToken;
		await browser?.close();
		if (backend) await new Promise(resolve => backend.close(resolve));
		await mongoose.disconnect(); await db?.stop();
	}
})().catch(error => { console.error(error); process.exitCode = 1; });
