// Resume the first incomplete Dialogue practice task without guessing during loading/errors.
const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const baseURL = process.env.STUDYJONY_TEST_URL || "http://localhost:3000";
const lessonId = "coffee-shop";
const userId = "aaaaaaaaaaaaaaaaaaaaaaaa";
const prefixFor = locale => locale === "en" ? "/en" : "";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname));

const taskCatalogue = require("../../../../server/data/dialogueTaskCatalogue.json");
const tasksByDialogue = new Map();
for (const [courseId, dialogueId, taskId] of taskCatalogue) {
	if (courseId !== lessonId) continue;
	if (!tasksByDialogue.has(dialogueId)) tasksByDialogue.set(dialogueId, []);
	tasksByDialogue.get(dialogueId).push(String(taskId));
}
const completeOrderingDialogue = [{
	dialogueId: "ordering-a-coffee",
	completedTaskIds: tasksByDialogue.get("ordering-a-coffee"),
	updatedAt: "2026-01-01T00:00:00.000Z",
}];
const completeLesson = [...tasksByDialogue].map(([dialogueId, completedTaskIds]) => ({
	dialogueId,
	completedTaskIds,
	updatedAt: "2026-01-01T00:00:00.000Z",
}));

async function fixture(browser, { locale, width, state = "success", signedIn = true, savedProgress = [] }) {
	const t = require(`../../../messages/${locale}.json`).DialogueLanding;
	const prefix = prefixFor(locale);
	const context = await browser.newContext({
		viewport: { width, height: 900 },
		isMobile: width < 768,
		hasTouch: width < 768,
	});
	const page = await context.newPage();
	await context.addCookies([{ name: "sj_guest_language", value: locale, url: baseURL }]);
	let hold = state === "loading";
	let fail = state === "failed";
	let progressByLesson = { [lessonId]: savedProgress };
	let releaseGate;
	const gate = new Promise(resolve => { releaseGate = resolve; });
	let progressRequests = 0;
	const pageErrors = [];
	page.on("pageerror", error => pageErrors.push(error.message));
	await context.route("**/api/v1/**", async route => {
		const request = route.request();
		const path = new URL(request.url()).pathname;
		if (path.endsWith("/users/me")) {
			return signedIn
				? route.fulfill({ json: { status: "success", data: { user: { _id: userId, name: "Resume tester", theme: "dark", language: locale } } } })
				: route.fulfill({ status: 401, json: { status: "fail" } });
		}
		if (request.method() === "GET" && path.startsWith("/api/v1/dialogue-progress/")) {
			progressRequests++;
			if (hold) await gate;
			if (fail) return route.fulfill({ status: 503, json: { status: "error" } });
			const courseId = path.split("/").at(-1);
			return route.fulfill({ json: { status: "success", data: { progress: progressByLesson[courseId] || [] } } });
		}
		return route.fulfill({ json: { status: "success", data: { progress: [], vocabularies: [], topics: [], activities: [] } } });
	});

	return {
		context,
		page,
		t,
		prefix,
		pageErrors,
		get progressRequests() { return progressRequests; },
		waitForProgressRequest() {
			return page.waitForRequest(request => request.method() === "GET" &&
				new URL(request.url()).pathname.startsWith("/api/v1/dialogue-progress/"));
		},
		async open() {
			await page.goto(`${baseURL}${prefix}/dialogue`, { waitUntil: "domcontentloaded", timeout: 90000 });
		},
		release(nextProgress = []) {
			hold = false;
			fail = false;
			progressByLesson = { [lessonId]: nextProgress };
			releaseGate();
		},
		setSuccessful(nextProgress = []) {
			fail = false;
			progressByLesson = { [lessonId]: nextProgress };
		},
		async close() {
			hold = false;
			releaseGate();
			await context.close();
		},
	};
}

function continueLink(f) {
	return f.page.getByRole("link", { name: f.t.continue, exact: true });
}

function courseLink(f) {
	return f.page.locator(`a[href="${f.prefix}/dialogue/${lessonId}"]`);
}

async function assertNoContinue(f) {
	assert.equal(await continueLink(f).count(), 0, "No Continue action is shown without confirmed in-progress data");
}

async function assertContinueDestination(f, route, label) {
	const link = continueLink(f);
	await link.waitFor();
	const expectedPath = `${f.prefix}${route}`;
	assert.equal(new URL(await link.getAttribute("href"), baseURL).pathname, expectedPath, label);
	await link.click();
	await f.page.waitForURL(url => url.pathname === expectedPath);
}

async function assertCourseOverviewRemains(f, label) {
	const link = courseLink(f);
	await link.waitFor();
	await link.click();
	await f.page.waitForURL(url => url.pathname === `${f.prefix}/dialogue/${lessonId}`);
	assert.ok(await f.page.getByRole("heading", { name: f.t.dialoguesHeading }).count(), label);
}

async function resumeWithinDialogue(browser, locale, width) {
	const f = await fixture(browser, { locale, width, savedProgress: [{ dialogueId: "ordering-a-coffee", completedTaskIds: ["1"], updatedAt: "2026-01-01T00:00:00.000Z" }] });
	try {
		await f.open();
		await assertContinueDestination(f, `/dialogue/${lessonId}/ordering-a-coffee/2`, "Continue skips task 1 and resumes at task 2");
		assert.deepEqual(f.pageErrors, []);
		console.log(`PASS ${locale} ${width}px: resumes the first incomplete task in a dialogue`);
	} finally { await f.close(); }
}

async function resumeNextDialogue(browser, locale, width) {
	const f = await fixture(browser, { locale, width, savedProgress: completeOrderingDialogue });
	try {
		await f.open();
		await assertContinueDestination(f, `/dialogue/${lessonId}/choosing-a-snack/1`, "Continue advances to the first task of the next dialogue");
		assert.deepEqual(f.pageErrors, []);
		console.log(`PASS ${locale} ${width}px: resumes in lesson dialogue order`);
	} finally { await f.close(); }
}

async function confirmedZeroKeepsStartBehavior(browser, locale, width) {
	const f = await fixture(browser, { locale, width });
	try {
		await f.open();
		await f.page.getByText(f.t.notStarted, { exact: true }).first().waitFor({ state: "attached" });
		await assertNoContinue(f);
		await assertCourseOverviewRemains(f, "Zero progress retains the existing course start route");
		assert.deepEqual(f.pageErrors, []);
		console.log(`PASS ${locale} ${width}px: confirmed zero progress keeps the existing start route`);
	} finally { await f.close(); }
}

async function completedCourseKeepsReviewBehavior(browser, locale, width) {
	const f = await fixture(browser, { locale, width, savedProgress: completeLesson });
	try {
		await f.open();
		const status = courseLink(f).getByText(f.t.completed, { exact: true });
		await status.waitFor({ state: "attached" });
		await assertNoContinue(f);
		await assertCourseOverviewRemains(f, "Completed course cards retain their review route");
		assert.deepEqual(f.pageErrors, []);
		console.log(`PASS ${locale} ${width}px: completed course keeps review behavior`);
	} finally { await f.close(); }
}

async function loadingWaitsForConfirmedProgress(browser, locale, width) {
	const f = await fixture(browser, { locale, width, state: "loading" });
	try {
		const progressRequest = f.waitForProgressRequest();
		await f.open();
		await f.page.getByRole("status").filter({ hasText: f.t.progressLoading }).waitFor();
		await progressRequest;
		await assertNoContinue(f);
		f.release([{ dialogueId: "ordering-a-coffee", completedTaskIds: ["1"], updatedAt: "2026-01-01T00:00:00.000Z" }]);
		await assertContinueDestination(f, `/dialogue/${lessonId}/ordering-a-coffee/2`, "Continue appears only after confirmed progress loads");
		assert.deepEqual(f.pageErrors, []);
		console.log(`PASS ${locale} ${width}px: loading never guesses; confirmed data enables resume`);
	} finally { await f.close(); }
}

async function failedRequestWaitsForRetry(browser, locale, width) {
	const f = await fixture(browser, { locale, width, state: "failed" });
	try {
		await f.open();
		await f.page.getByRole("alert").filter({ hasText: f.t.progressUnavailable }).waitFor();
		await assertNoContinue(f);
		f.setSuccessful([{ dialogueId: "ordering-a-coffee", completedTaskIds: ["1"], updatedAt: "2026-01-01T00:00:00.000Z" }]);
		await f.page.getByRole("button", { name: f.t.retryProgressLoad, exact: true }).click();
		await assertContinueDestination(f, `/dialogue/${lessonId}/ordering-a-coffee/2`, "Retry restores saved progress before resume is offered");
		assert.deepEqual(f.pageErrors, []);
		console.log(`PASS ${locale} ${width}px: failed progress stays unavailable until retry succeeds`);
	} finally { await f.close(); }
}

async function guestKeepsCourseNavigation(browser, locale, width) {
	const f = await fixture(browser, { locale, width, signedIn: false });
	try {
		await f.open();
		await f.page.getByText(f.t.notStarted, { exact: true }).first().waitFor({ state: "attached" });
		await assertNoContinue(f);
		assert.equal(f.progressRequests, 0, "Guest navigation does not fetch saved account progress");
		await assertCourseOverviewRemains(f, "Guest start still opens the lesson overview");
		assert.deepEqual(f.pageErrors, []);
		console.log(`PASS ${locale} ${width}px: guest course navigation is unchanged`);
	} finally { await f.close(); }
}

(async () => {
	const browser = await chromium.launch({ channel: "chrome", headless: true });
	try {
		for (const locale of ["vi", "en"]) {
			for (const width of [390, 1280]) {
				await resumeWithinDialogue(browser, locale, width);
				await resumeNextDialogue(browser, locale, width);
				await confirmedZeroKeepsStartBehavior(browser, locale, width);
				await completedCourseKeepsReviewBehavior(browser, locale, width);
				await loadingWaitsForConfirmedProgress(browser, locale, width);
				await failedRequestWaitsForRetry(browser, locale, width);
				await guestKeepsCourseNavigation(browser, locale, width);
			}
		}
	} finally {
		await browser.close();
	}
})().catch(error => { console.error(error); process.exitCode = 1; });
