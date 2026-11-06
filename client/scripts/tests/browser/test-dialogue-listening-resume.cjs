// Listening CTA resumes the first incomplete task without guessing during loading/errors.
const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const baseURL = process.env.STUDYJONY_TEST_URL || "http://localhost:3000";
const lessonId = "restaurant";
const dialogueId = "getting-a-table";
const userId = "aaaaaaaaaaaaaaaaaaaaaaaa";
const prefixFor = locale => locale === "en" ? "/en" : "";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname));

const taskCatalogue = require("../../../../server/data/dialogueTaskCatalogue.json");
const taskIds = taskCatalogue
	.filter(([courseId, currentDialogueId]) => courseId === lessonId && currentDialogueId === dialogueId)
	.map(([, , taskId]) => String(taskId))
	.sort((first, second) => Number(first) - Number(second));
assert.ok(taskIds.length > 1, "The listening fixture needs multiple practice tasks");

async function fixture(browser, { locale, width, state = "success", signedIn = true, completedTaskIds = [] }) {
	const t = require(`../../../messages/${locale}.json`).DialogueFeature;
	const prefix = prefixFor(locale);
	const context = await browser.newContext({
		viewport: { width, height: 900 },
		isMobile: width < 768,
		hasTouch: width < 768,
	});
	const page = await context.newPage();
	await context.addCookies([{ name: "sj_guest_language", value: locale, url: baseURL }]);
	await context.addInitScript(() => {
		HTMLMediaElement.prototype.play = function() { return Promise.resolve(); };
		HTMLMediaElement.prototype.pause = function() {};
	});
	let hold = state === "loading";
	let fail = state === "failed";
	let resolvedTaskIds = completedTaskIds;
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
				? route.fulfill({ json: { status: "success", data: { user: { _id: userId, name: "Listening resume tester", theme: "dark", language: locale } } } })
				: route.fulfill({ status: 401, json: { status: "fail" } });
		}
		if (request.method() === "GET" && path === `/api/v1/dialogue-progress/${lessonId}`) {
			progressRequests++;
			if (hold) await gate;
			if (fail) return route.fulfill({ status: 503, json: { status: "error" } });
			return route.fulfill({ json: { status: "success", data: { progress: [{ dialogueId, completedTaskIds: resolvedTaskIds }] } } });
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
				new URL(request.url()).pathname === `/api/v1/dialogue-progress/${lessonId}`);
		},
		async open() {
			await page.goto(`${baseURL}${prefix}/dialogue/${lessonId}/${dialogueId}`, { waitUntil: "domcontentloaded", timeout: 90000 });
		},
		release(taskIds = []) {
			hold = false;
			fail = false;
			resolvedTaskIds = taskIds;
			releaseGate();
		},
		setSuccessful(taskIds = []) {
			fail = false;
			resolvedTaskIds = taskIds;
		},
		async close() {
			hold = false;
			releaseGate();
			await context.close();
		},
	};
}

function continueLink(f) {
	return f.page.getByRole("link", { name: f.t.continueToPractice, exact: true });
}

async function assertDestination(f, taskId, label, click = true) {
	const link = continueLink(f);
	await link.waitFor();
	const expectedPath = `${f.prefix}/dialogue/${lessonId}/${dialogueId}/${taskId}`;
	assert.equal(new URL(await link.getAttribute("href"), baseURL).pathname, expectedPath, label);
	if (click) {
		await link.click();
		await f.page.waitForURL(url => url.pathname === expectedPath);
	}
}

async function savedProgressResumesFirstIncomplete(browser, locale, width) {
	const f = await fixture(browser, { locale, width, completedTaskIds: [taskIds[0]] });
	try {
		await f.open();
		await assertDestination(f, taskIds[1], "Listening CTA resumes after the completed task");
		assert.deepEqual(f.pageErrors, []);
		console.log(`PASS ${locale} ${width}px: signed-in progress resumes at the first incomplete task`);
	} finally { await f.close(); }
}

async function zeroProgressKeepsStartingTask(browser, locale, width) {
	const f = await fixture(browser, { locale, width });
	try {
		await f.open();
		await assertDestination(f, taskIds[0], "Confirmed zero progress keeps the existing first-task route");
		assert.deepEqual(f.pageErrors, []);
		console.log(`PASS ${locale} ${width}px: confirmed zero progress starts at task 1`);
	} finally { await f.close(); }
}

async function completedDialogueKeepsReviewRoute(browser, locale, width) {
	const f = await fixture(browser, { locale, width, completedTaskIds: taskIds });
	try {
		await f.open();
		await assertDestination(f, taskIds[0], "All completed keeps the existing task 1 review route", false);
		assert.deepEqual(f.pageErrors, []);
		console.log(`PASS ${locale} ${width}px: completed dialogue retains its existing review route`);
	} finally { await f.close(); }
}

async function guestKeepsStartingTask(browser, locale, width) {
	const f = await fixture(browser, { locale, width, signedIn: false, completedTaskIds: [taskIds[0]] });
	try {
		await f.open();
		await assertDestination(f, taskIds[0], "Guest retains the existing first-task route");
		assert.equal(f.progressRequests, 0, "Guests do not fetch saved account progress");
		assert.deepEqual(f.pageErrors, []);
		console.log(`PASS ${locale} ${width}px: guest navigation is unchanged`);
	} finally { await f.close(); }
}

async function loadingWaitsForConfirmedProgress(browser, locale, width) {
	const f = await fixture(browser, { locale, width, state: "loading" });
	try {
		const request = f.waitForProgressRequest();
		await f.open();
		await f.page.getByRole("status").filter({ hasText: f.t.progressLoading }).waitFor();
		await request;
		assert.equal(await continueLink(f).count(), 0, "No starting destination is offered while saved progress is loading");
		f.release([taskIds[0]]);
		await assertDestination(f, taskIds[1], "Confirmed progress enables the resume destination");
		assert.deepEqual(f.pageErrors, []);
		console.log(`PASS ${locale} ${width}px: pending progress does not assume zero`);
	} finally { await f.close(); }
}

async function failedProgressWaitsForRetry(browser, locale, width) {
	const f = await fixture(browser, { locale, width, state: "failed" });
	try {
		await f.open();
		await f.page.getByRole("alert").filter({ hasText: f.t.progressUnavailable }).waitFor();
		assert.equal(await continueLink(f).count(), 0, "No starting destination is offered after an unconfirmed failure");
		f.setSuccessful([taskIds[0]]);
		await f.page.getByRole("button", { name: f.t.retryProgressLoad, exact: true }).click();
		await assertDestination(f, taskIds[1], "Retry resolves progress before offering resume");
		assert.deepEqual(f.pageErrors, []);
		console.log(`PASS ${locale} ${width}px: failed progress stays unavailable until retry succeeds`);
	} finally { await f.close(); }
}

(async () => {
	const browser = await chromium.launch({ channel: "chrome", headless: true });
	try {
		for (const locale of ["vi", "en"]) {
			for (const width of [390, 1280]) {
				await savedProgressResumesFirstIncomplete(browser, locale, width);
				await zeroProgressKeepsStartingTask(browser, locale, width);
				await completedDialogueKeepsReviewRoute(browser, locale, width);
				await guestKeepsStartingTask(browser, locale, width);
				await loadingWaitsForConfirmedProgress(browser, locale, width);
				await failedProgressWaitsForRetry(browser, locale, width);
			}
		}
	} finally {
		await browser.close();
	}
})().catch(error => { console.error(error); process.exitCode = 1; });
