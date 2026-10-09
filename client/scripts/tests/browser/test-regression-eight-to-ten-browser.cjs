// Uses the running Next dev server. APIs are mocked; no real accounts/data change.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const baseURL = process.env.STUDYJONY_TEST_URL || "http://localhost:3000";
const topicId = "000000000000000000000099";
const fixedTime = new Date("2026-10-06T17:00:00Z"); // Oct 7 in Vietnam, Oct 6 in California.
function deferred() { let resolve; const promise = new Promise(done => resolve = done); return { resolve, promise }; }
const frame = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
async function setup(browser, width, locale, theme, { guest = false, topics = [], words = [], activities = [] } = {}) {
	const page = await browser.newPage({ viewport: { width, height: 740 }, hasTouch: width < 768, colorScheme: theme, timezoneId: "America/Los_Angeles" });
	page.setDefaultTimeout(15000);
	await page.clock.setFixedTime(fixedTime);
	const messages = require(`../../../messages/${locale}.json`), prefix = locale === "en" ? "/en" : "";
	const account = { _id: "A", name: "Fresh learner", email: "fresh@example.com", theme };
	let user = guest ? null : account, handler, topicPosts = 0;
	const errors = [], storedWords = [...words];
	page.on("pageerror", error => errors.push(error.message));
	page.on("console", message => {
		if (message.type() !== "error") return;
		if (message.text().startsWith("Failed to load resource") && message.location().url.includes("/api/v1/")) return;
		// Topic Add Word's existing catch logs the deliberately injected network failure.
		if (message.text().includes("TypeError: Failed to fetch") && page.url().includes(`/wordlist/${topicId}`)) return;
		errors.push(message.text());
	});
	await page.addInitScript(theme => localStorage.setItem("studyjony-theme", theme), theme);
	await page.route("https://va.vercel-scripts.com/**", route => route.fulfill({ contentType: "application/javascript", body: "" }));
	await page.route("https://accounts.google.com/**", route => route.fulfill({ contentType: "application/javascript", body: "window.google={accounts:{oauth2:{initCodeClient:()=>({requestCode(){}})}}};" }));
	await page.route("**/data/english_words.json", route => route.fulfill({ json: ["apple", "book"] }));
	await page.route("**/api/v1/**", async route => {
		const request = route.request(), path = new URL(request.url()).pathname;
		if (handler && await handler(route, path)) return;
		if (path.endsWith("/users/me")) return route.fulfill({ json: { data: { user } } });
		if (path.endsWith("/topics")) {
			if (request.method() === "POST") topicPosts += 1;
			return route.fulfill({ json: { data: { topics } } });
		}
		if (path.endsWith("/study-activities")) return route.fulfill({ json: { data: { activities } } });
		if (path.endsWith("/vocab")) {
			const topic = new URL(request.url()).searchParams.get("topic");
			return route.fulfill({ json: { data: { vocabularies: storedWords.filter(word => !topic || word.topic === topic) } } });
		}
		if (path.includes("/dictionary/")) {
			const english = decodeURIComponent(path.split("/").at(-1)).toLowerCase();
			return route.fulfill({ json: { data: { english, vietnamese: `${english} meaning`, pronunciation: `/test-${english}/`, example: `${english} example` } } });
		}
		return route.fulfill({ json: { data: { progress: [], activities: [], vocabularies: [] } } });
	});
	async function goto(path) {
		await page.goto(baseURL + prefix + path, { timeout: 60000, waitUntil: "domcontentloaded" });
		await page.waitForFunction(theme => document.documentElement.dataset.theme === theme, theme);
	}
	async function finish() {
		assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "No horizontal overflow");
		assert.deepEqual(errors, [], "No unexpected hydration/runtime errors");
		assert.equal(topicPosts, 0, "No topic is automatically created");
		await page.close();
	}
	return { page, messages, goto, finish, storedWords, account, prefix, signIn: () => user = account, handle: value => handler = value };
}
async function submitThreeTimes(form) {
	// Bypass disabled-button rendering to prove the handler itself locks immediately.
	await form.evaluate(form => {
		form.querySelector('button[type="submit"]').click();
		form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
		form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
	});
}
async function signupCase(browser, width, locale, theme) {
	const c = await setup(browser, width, locale, theme, { guest: true }), p = c.page, t = c.messages.Auth;
	const attempts = Array.from({ length: 3 }, () => ({ started: deferred(), release: deferred() }));
	let posts = 0, successes = 0;
	c.handle(async (route, path) => {
		if (!path.endsWith("/auth/signup")) return false;
		const number = posts++, attempt = attempts[number];
		assert.ok(attempt, "No extra signup POST");
		attempt.started.resolve(); await attempt.release.promise;
		if (number === 0) await route.fulfill({ status: 400, json: { status: "fail", error: { code: 11000 } } });
		else if (number === 1) await route.abort("failed");
		else { successes += 1; c.signIn(); await route.fulfill({ json: { status: "success", data: { user: c.account } } }); }
		return true;
	});
	await c.goto("/signup");
	const form = p.locator("form");
	await p.locator("#signup-name").waitFor();
	await form.evaluate(form => form.requestSubmit()); await frame(p);
	assert.equal(posts, 0, "Required-field validation is preserved");
	await p.locator("#signup-name").fill("Fresh learner");
	await p.locator("#signup-email").fill("fresh@example.com");
	await p.locator("#signup-password").fill("password-123");
	await p.locator("#signup-password-confirm").fill("password-123");
	for (let index = 0; index < attempts.length; index++) {
		await submitThreeTimes(form); await attempts[index].started.promise;
		assert.equal(posts, index + 1);
		const pending = form.getByRole("button", { name: t.signingUp, exact: true });
		await pending.waitFor(); assert.equal(await pending.isDisabled(), true);
		await submitThreeTimes(form); await frame(p); assert.equal(posts, index + 1);
		attempts[index].release.resolve();
		if (index < 2) {
			await form.getByRole("button", { name: t.signup, exact: true }).waitFor();
			assert.equal(await form.getByRole("button", { name: t.signup, exact: true }).isEnabled(), true);
			await form.getByRole("alert").filter({ hasText: index === 0 ? t.emailInUse : t.signupFailed }).waitFor();
			assert.equal(await p.locator("#signup-email").inputValue(), "fresh@example.com");
		}
	}
	await p.waitForURL(url => url.pathname === `${c.prefix}/wordlist`);
	assert.equal(posts, 3); assert.equal(successes, 1);
	await c.finish();
}
async function topicCase(browser, width, locale, theme) {
	const c = await setup(browser, width, locale, theme), p = c.page, t = c.messages.WordlistDetail;
	const attempts = Array.from({ length: 3 }, () => ({ started: deferred(), release: deferred() }));
	let posts = 0;
	c.handle(async (route, path) => {
		if (!path.endsWith("/vocab") || route.request().method() !== "POST") return false;
		const number = posts++, attempt = attempts[number], payload = route.request().postDataJSON();
		assert.ok(attempt, "No duplicate vocabulary POST");
		assert.equal(payload.topic, topicId);
		attempt.started.resolve(); await attempt.release.promise;
		if (number === 0) await route.fulfill({ status: 400, json: { message: "Test validation message" } });
		else if (number === 1) await route.abort("failed");
		else {
			const newVocab = { _id: "000000000000000000000010", ...payload, reviewCount: 0, lastReviewedAt: null };
			c.storedWords.push(newVocab);
			await route.fulfill({ json: { data: { newVocab } } });
		}
		return true;
	});
	await c.goto(`/wordlist/${topicId}`);
	await p.getByRole("button", { name: t.addNew, exact: true }).click();
	const dialog = p.getByRole("dialog"), form = dialog.locator("form");
	await form.evaluate(form => form.requestSubmit()); await frame(p); assert.equal(posts, 0);
	await dialog.locator('[name="word"]').fill("book");
	await dialog.locator('[name="translation"]').fill("sách");
	for (let index = 0; index < attempts.length; index++) {
		await submitThreeTimes(form); await attempts[index].started.promise;
		const pending = dialog.getByRole("button", { name: t.form.adding, exact: true });
		await pending.waitFor(); assert.equal(await pending.isDisabled(), true);
		await submitThreeTimes(form); await frame(p); assert.equal(posts, index + 1);
		attempts[index].release.resolve();
		if (index < 2) {
			await dialog.getByRole("button", { name: t.form.add, exact: true }).waitFor();
			assert.equal(await dialog.getByRole("button", { name: t.form.add, exact: true }).isEnabled(), true);
			await dialog.getByRole("alert").filter({ hasText: index === 0 ? "Test validation message" : t.form.addError }).waitFor();
			assert.equal(await dialog.locator('[name="word"]').inputValue(), "book");
		}
	}
	await dialog.waitFor({ state: "hidden" });
	assert.equal(posts, 3); assert.equal(c.storedWords.length, 1);
	await p.getByText("book", { exact: true }).first().waitFor();
	await c.goto("/wordlist");
	await p.getByText("book", { exact: true }).first().waitFor();
	await c.finish();
}
async function heatmapCase(browser, width, locale, theme) {
	const activities = [
		{ date: "2026-10-02", count: 0, hasQualifiedStudy: false },
		{ date: "2026-10-03", count: 6, hasQualifiedStudy: true },
		{ date: "2026-10-04", count: 0, hasQualifiedStudy: true },
		{ date: "2026-10-05", count: 0, hasQualifiedStudy: true },
		{ date: "2026-10-06", count: 3, hasQualifiedStudy: true },
		{ date: "2026-10-07", count: 0, hasQualifiedStudy: false },
	];
	const c = await setup(browser, width, locale, theme, { activities }), p = c.page, t = c.messages.Profile;
	await c.goto("/profile");
	const cells = p.locator("div.grid.grid-rows-7 > div[title]");
	await cells.first().waitFor();
	const tail = await cells.evaluateAll(cells => cells.slice(-6).map(cell => ({ title: cell.title, classes: cell.className })));
	const levels = ["dark:bg-slate-900", "bg-emerald-600", "bg-emerald-950", "bg-emerald-950", "bg-emerald-800", "dark:bg-slate-900"];
	for (let index = 0; index < tail.length; index++) assert.ok(tail[index].classes.includes(levels[index]));
	assert.ok(tail[2].title.endsWith(t.qualifiedActivityTooltip));
	assert.ok(tail[3].title.endsWith(t.qualifiedActivityTooltip));
	const lastLabel = await p.evaluate(locale => new Date("2026-10-07T00:00:00").toLocaleDateString(locale), locale);
	assert.ok(tail.at(-1).title.startsWith(lastLabel), "Includes the Vietnam day despite California device timezone");
	await p.getByText(t.activitySummary.replace("{days}", "4").replace("{count}", "9"), { exact: true }).waitFor();
	if (width < 768) assert.equal(await p.getByRole("button", { name: c.messages.MiniDictionary.toggle, exact: true }).isVisible(), false, "Existing desktop-only dictionary visibility is preserved");
	await c.finish();
}
async function dictionaryCase(browser, width, locale, theme, withTopic) {
	const c = await setup(browser, width, locale, theme, { topics: withTopic ? [{ _id: topicId, name: "My words" }] : [], words: withTopic ? [{ _id: "000000000000000000000011", english: " Apple ", vietnamese: "quả táo", reviewCount: 0, lastReviewedAt: null }] : [] });
	const p = c.page, t = c.messages.MiniDictionary, pending = deferred(), release = deferred();
	const libraryStarted = deferred(), libraryRelease = deferred(), libraryFailed = deferred();
	let posts = 0, libraryRequests = 0;
	c.handle(async (route, path) => {
		if (!withTopic && path.endsWith("/topics") && route.request().method() === "GET") {
			if (++libraryRequests === 1) {
				await route.fulfill({ status: 500, json: { message: "Test library failure" } }); libraryFailed.resolve();
			} else {
				libraryStarted.resolve(); await libraryRelease.promise;
				await route.fulfill({ json: { data: { topics: [] } } });
			}
			return true;
		}
		if (!path.endsWith("/vocab") || route.request().method() !== "POST") return false;
		const number = ++posts, payload = route.request().postDataJSON();
		if (withTopic) assert.equal(payload.topic, topicId); else assert.equal(Object.hasOwn(payload, "topic"), false);
		if (!withTopic && number === 1) { await route.fulfill({ status: 500, json: { message: "Test save failure" } }); return true; }
		assert.equal(number, withTopic ? 1 : 2, "No duplicate dictionary save");
		pending.resolve(); await release.promise;
		const newVocab = { _id: "000000000000000000000012", ...payload, reviewCount: 0, lastReviewedAt: null };
		c.storedWords.push(newVocab);
		await route.fulfill({ json: { status: "success", data: { newVocab } } }); return true;
	});
	await c.goto("/wordlist");
	await p.locator("header.sticky button.group").waitFor();
	async function open() { await p.getByRole("button", { name: t.toggle, exact: true }).click(); }
	const panel = p.getByRole("region", { name: t.title, exact: true });
	async function lookup(word) {
		await panel.getByRole("combobox").fill(word);
		await panel.locator("form").evaluate(form => form.requestSubmit());
		await panel.getByText(`${word.toLowerCase()} meaning`, { exact: true }).waitFor();
	}
	await open(); await lookup("apple");
	if (withTopic) {
		await panel.getByRole("button", { name: t.saved, exact: true }).waitFor();
		assert.equal(await panel.getByRole("button", { name: t.saved, exact: true }).isDisabled(), true);
		assert.equal(posts, 0); await lookup("book");
	} else {
		const save = panel.getByRole("button", { name: t.save, exact: true });
		await libraryFailed.promise; await frame(p);
		assert.equal(await save.isDisabled(), true, "An unsuccessful library load cannot bypass duplicate checks");
		await save.evaluate(button => button.click()); assert.equal(posts, 0);
		await panel.getByRole("button", { name: t.close, exact: true }).click();
		await open(); await libraryStarted.promise;
		assert.equal(await save.isDisabled(), true, "Wait for the confirmed topicless library");
		libraryRelease.resolve();
		await save.waitFor(); await p.waitForFunction(label => [...document.querySelectorAll("button")].some(button => button.textContent.trim() === label && !button.disabled), t.save);
		await save.click(); await panel.getByText(t.saveError, { exact: true }).waitFor();
		assert.equal(await save.isEnabled(), true);
	}
	await panel.getByRole("button", { name: t.save, exact: true }).evaluate(button => { button.click(); button.click(); button.click(); });
	await pending.promise;
	assert.equal(await panel.getByRole("button", { name: t.save, exact: true }).isDisabled(), true);
	release.resolve();
	await panel.getByRole("button", { name: t.saved, exact: true }).waitFor();
	assert.equal(await panel.getByRole("button", { name: t.saved, exact: true }).isDisabled(), true);
	await panel.getByRole("button", { name: t.close, exact: true }).click();
	await panel.waitFor({ state: "hidden" });
	await p.getByText(withTopic ? "book" : "apple", { exact: true }).first().waitFor();
	await c.goto(withTopic ? `/wordlist/${topicId}` : "/wordlist");
	await p.getByText(withTopic ? "book" : "apple", { exact: true }).first().waitFor();
	await open(); await lookup(withTopic ? "BOOK" : "APPLE");
	await panel.getByRole("button", { name: t.saved, exact: true }).waitFor();
	assert.equal(await panel.getByRole("button", { name: t.saved, exact: true }).isDisabled(), true);
	assert.equal(posts, withTopic ? 1 : 2);
	await panel.getByRole("button", { name: t.close, exact: true }).click();
	await c.finish();
}
(async () => {
	const browser = await chromium.launch({ channel: "chrome", headless: true });
	let cases = 0;
	try {
		for (const width of [320, 375, 430, 768, 1280]) for (const locale of ["vi", "en"]) for (const theme of ["light", "dark"]) {
			await signupCase(browser, width, locale, theme); cases += 1;
			await topicCase(browser, width, locale, theme); cases += 1;
			await heatmapCase(browser, width, locale, theme); cases += 1;
			if (width >= 768) for (const withTopic of [false, true]) { await dictionaryCase(browser, width, locale, theme, withTopic); cases += 1; }
			console.log(`PASS ${width}px ${locale} ${theme}: signup/Add Word submission locks, heatmap${width >= 768 ? ", dictionary global/topic saves" : ", existing dictionary visibility"}`);
		}
		console.log(`PASS ${cases} browser cases`);
	} finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
