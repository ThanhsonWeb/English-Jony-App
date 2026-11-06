// Loading, unavailable, and confirmed-empty saved progress on Dialogue overviews.
const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const baseURL = process.env.STUDYJONY_TEST_URL || "http://localhost:3000";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname));
const lessonId = "coffee-shop";
const userId = "aaaaaaaaaaaaaaaaaaaaaaaa";

async function fixture(browser, { locale, width, routeType, state }) {
	const prefix = locale === "en" ? "/en" : "";
	const landing = require(`../../../messages/${locale}.json`).DialogueLanding;
	const feature = require(`../../../messages/${locale}.json`).DialogueFeature;
	const messages = routeType === "overview" ? landing : feature;
	const context = await browser.newContext({ viewport: { width, height: 900 }, isMobile: width < 768, hasTouch: width < 768 });
	const page = await context.newPage();
	let release;
	const gate = new Promise(resolve => { release = resolve; });
	let hold = state === "loading";
	let fail = state === "failed";
	let savedProgress = [];
	let progressRequests = 0;
	const pageErrors = [];
	page.on("pageerror", error => pageErrors.push(error.message));
	await context.addCookies([{ name: "sj_guest_language", value: locale, url: baseURL }]);
	await context.route("**/api/v1/**", async route => {
		const request = route.request();
		const path = new URL(request.url()).pathname;
		const json = data => route.fulfill({ json: { status: "success", data } });
		if (path.endsWith("/users/me")) {
			return json({ user: { _id: userId, name: "Progress state tester", theme: "dark", language: locale } });
		}
		if (request.method() === "GET" && path.startsWith("/api/v1/dialogue-progress/")) {
			progressRequests++;
			if (hold) await gate;
			if (fail) return route.fulfill({ status: 503, json: { status: "error" } });
			return json({ progress: path.endsWith(`/${lessonId}`) ? savedProgress : [] });
		}
		return json({ progress: [], vocabularies: [], topics: [], activities: [] });
	});
	const path = routeType === "overview" ? "/dialogue" : `/dialogue/${lessonId}`;
	return {
		context,
		page,
		prefix,
		messages,
		feature,
		pageErrors,
		get progressRequests() { return progressRequests; },
		waitForProgressRequest() {
			return page.waitForRequest(request => request.method() === "GET" &&
				new URL(request.url()).pathname.startsWith("/api/v1/dialogue-progress/"));
		},
		path,
		release() { hold = false; release(); },
		setSuccessful(progress = []) { fail = false; savedProgress = progress; },
		async open() { await page.goto(`${baseURL}${prefix}${path}`, { waitUntil: "domcontentloaded", timeout: 90000 }); },
		async close() { hold = false; release(); await context.close(); },
	};
}

async function assertNoUnconfirmedZero(f) {
	assert.equal(await f.page.getByText(f.messages.notStarted, { exact: true }).count(), 0, "Unknown progress must not be labeled Not started");
	if (f.path !== "/dialogue") {
		assert.equal(await f.page.getByText(/^0\/\d+/).count(), 0, "Unknown progress must not show a zero task count");
		assert.equal(await f.page.getByText("0%", { exact: true }).count(), 0, "Unknown progress must not show 0 percent");
	}
}

async function waitForAttached(locator) {
	await locator.first().waitFor({ state: "attached" });
}

async function assertPracticeLinksRemain(f) {
	if (f.path === "/dialogue") {
		const courseLink = f.page.locator(`a[href="${f.prefix}/dialogue/${lessonId}"]`);
		await courseLink.waitFor();
	} else {
		await f.page.locator('button[aria-expanded="false"]').filter({ hasText: /^1/ }).first().click();
		const exerciseLink = f.page.locator(`a[href="${f.prefix}/dialogue/${lessonId}/ordering-a-coffee/1"]`);
		const exerciseLinks = await f.page.locator('a[href*="/dialogue/"]').evaluateAll(links => links.map(link => link.getAttribute("href")));
		assert.ok(exerciseLinks.includes(`${f.prefix}/dialogue/${lessonId}/ordering-a-coffee/1`), `Practice link remains available; found ${exerciseLinks.join(", ")}`);
		await exerciseLink.waitFor();
	}
	assert.equal(await f.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "Progress state fits the viewport");
}

async function loading(browser, routeType, locale, width) {
	const f = await fixture(browser, { routeType, locale, width, state: "loading" });
	try {
		const progressRequest = f.waitForProgressRequest();
		await f.open();
		await f.page.getByRole("status").filter({ hasText: f.messages.progressLoading }).waitFor();
		await progressRequest;
		assert.ok(f.progressRequests > 0, "Progress request is pending");
		await assertNoUnconfirmedZero(f);
		await assertPracticeLinksRemain(f);
		f.release();
		await f.page.getByText(f.messages.notStarted, { exact: true }).first().waitFor({ state: "attached" });
		assert.deepEqual(f.pageErrors, []);
		console.log(`PASS ${routeType} ${locale} ${width}px: loading hides zero progress; confirmed empty shows Not started`);
	} finally { await f.close(); }
}

async function failedThenRetry(browser, routeType, locale, width) {
	const f = await fixture(browser, { routeType, locale, width, state: "failed" });
	try {
		await f.open();
		await f.page.getByRole("alert").filter({ hasText: f.messages.progressUnavailable }).waitFor();
		await assertNoUnconfirmedZero(f);
		await assertPracticeLinksRemain(f);
		f.setSuccessful();
		await f.page.getByRole("button", { name: f.messages.retryProgressLoad, exact: true }).click();
		await f.page.getByText(f.messages.notStarted, { exact: true }).first().waitFor({ state: "attached" });
		assert.deepEqual(f.pageErrors, []);
		console.log(`PASS ${routeType} ${locale} ${width}px: API failure hides zero progress; retry restores confirmed empty state`);
	} finally { await f.close(); }
}

async function confirmedZero(browser, routeType, locale, width) {
	const f = await fixture(browser, { routeType, locale, width, state: "zero" });
	try {
		await f.open();
		await f.page.getByText(f.messages.notStarted, { exact: true }).first().waitFor({ state: "attached" });
		assert.equal(await f.page.getByRole("status").filter({ hasText: f.messages.progressLoading }).count(), 0, "Loading message clears after successful response");
		if (f.path !== "/dialogue") {
			await f.page.getByText(/^0\/\d+/).waitFor();
			await f.page.getByText("0%", { exact: true }).waitFor();
		}
		assert.deepEqual(f.pageErrors, []);
		console.log(`PASS ${routeType} ${locale} ${width}px: confirmed zero progress is shown accurately`);
	} finally { await f.close(); }
}

async function failedThenRetryWithSavedProgress(browser, routeType, locale, width) {
	const f = await fixture(browser, { routeType, locale, width, state: "failed" });
	try {
		await f.open();
		await f.page.getByRole("alert").filter({ hasText: f.messages.progressUnavailable }).waitFor();
		await assertNoUnconfirmedZero(f);
		f.setSuccessful([{ dialogueId: "ordering-a-coffee", completedTaskIds: ["1"] }]);
		await f.page.getByRole("button", { name: f.messages.retryProgressLoad, exact: true }).click();
		const courseLink = f.page.locator(`a[href="${f.prefix}/dialogue/${lessonId}"]`);
		if (routeType === "overview") {
			await courseLink.getByText(f.messages.learning, { exact: true }).waitFor({ state: "attached" });
		} else {
			await f.page.getByText(/^1\/\d+/).waitFor({ state: "attached" });
			await f.page.locator('button[aria-expanded="false"]').filter({ hasText: /^1/ }).first().click();
			const firstTask = f.page.locator(`a[href="${f.prefix}/dialogue/${lessonId}/ordering-a-coffee/1"]`);
			const secondTask = f.page.locator(`a[href="${f.prefix}/dialogue/${lessonId}/ordering-a-coffee/2"]`);
			await firstTask.waitFor({ state: "attached" });
			await secondTask.waitFor({ state: "attached" });
			assert.match(await firstTask.getAttribute("class"), /bg-green-500\/10/, "Saved task is marked completed");
			assert.match(await secondTask.getAttribute("class"), /bg-blue-500\/15/, "Next task is marked current");
		}
		assert.equal(await f.page.getByRole("alert").filter({ hasText: f.messages.progressUnavailable }).count(), 0, "Unavailable message clears after successful retry");
		assert.deepEqual(f.pageErrors, []);
		console.log(`PASS ${routeType} ${locale} ${width}px: retry restores saved nonzero progress`);
	} finally { await f.close(); }
}

(async () => {
	const browser = await chromium.launch({ channel: "chrome", headless: true });
	try {
		for (const routeType of ["overview", "lesson"]) {
			for (const locale of ["vi", "en"]) {
				for (const width of [390, 1280]) {
					await loading(browser, routeType, locale, width);
					await failedThenRetry(browser, routeType, locale, width);
					await failedThenRetryWithSavedProgress(browser, routeType, locale, width);
					await confirmedZero(browser, routeType, locale, width);
				}
			}
		}
	} finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
