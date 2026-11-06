// Confirm responsive Dialogue lesson status badges never imply unknown progress.
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const AxeBuilder = require("@axe-core/playwright").default;

const baseURL = process.env.STUDYJONY_TEST_URL || "http://localhost:3000";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname));
const lessonId = "coffee-shop";
const userId = "aaaaaaaaaaaaaaaaaaaaaaaa";
const prefixFor = locale => locale === "en" ? "/en" : "";
const catalogue = require("../../../../server/data/dialogueTaskCatalogue.json");
const taskIdsByDialogue = new Map();
for (const [courseId, dialogueId, taskId] of catalogue) {
	if (courseId !== lessonId) continue;
	if (!taskIdsByDialogue.has(dialogueId)) taskIdsByDialogue.set(dialogueId, []);
	taskIdsByDialogue.get(dialogueId).push(String(taskId));
}

const completeStatuses = [
	{ dialogueId: "ordering-a-coffee", completedTaskIds: taskIdsByDialogue.get("ordering-a-coffee") },
	{ dialogueId: "choosing-a-snack", completedTaskIds: ["1"] },
];

async function fixture(browser, { locale, width, theme = "light", state = "confirmed", progress = completeStatuses }) {
	const context = await browser.newContext({
		viewport: { width, height: 900 },
		isMobile: width < 768,
		hasTouch: width < 768,
	});
	const prefix = prefixFor(locale);
	const messages = require(`../../../messages/${locale}.json`).DialogueFeature;
	await context.addCookies([{ name: "sj_guest_language", value: locale, url: baseURL }]);
	await context.addInitScript(selectedTheme => localStorage.setItem("studyjony-theme", selectedTheme), theme);
	let holdProgress = state === "loading";
	let failProgress = state === "failed";
	let savedProgress = progress;
	let progressRequests = 0;
	let releaseProgress;
	const progressGate = new Promise(resolve => { releaseProgress = resolve; });
	await context.route("**/*", route => new URL(route.request().url()).origin === new URL(baseURL).origin
		? route.continue() : route.fulfill({ body: "" }));
	await context.route("**/api/v1/**", async route => {
		const request = route.request();
		const path = new URL(request.url()).pathname;
		if (path.endsWith("/users/me")) {
			return state === "guest"
				? route.fulfill({ status: 401, json: { status: "fail" } })
				: route.fulfill({ json: { status: "success", data: { user: {
					_id: userId, name: "Progress status tester", theme, language: locale,
				} } } });
		}
		if (request.method() === "GET" && path.startsWith("/api/v1/dialogue-progress/")) {
			progressRequests++;
			if (holdProgress) await progressGate;
			if (failProgress) return route.fulfill({ status: 503, json: { status: "error" } });
			return route.fulfill({ json: { status: "success", data: {
				progress: path.endsWith(`/${lessonId}`) ? savedProgress : [],
			} } });
		}
		return route.fulfill({ json: { status: "success", data: { progress: [], vocabularies: [], topics: [], activities: [] } } });
	});
	const page = await context.newPage();
	page.setDefaultTimeout(20000);
	const pageErrors = [];
	page.on("pageerror", error => pageErrors.push(error.message));
	return {
		context,
		page,
		locale,
		width,
		theme,
		prefix,
		messages,
		pageErrors,
		get progressRequests() { return progressRequests; },
		async open() {
			const session = page.waitForResponse(response => new URL(response.url()).pathname.endsWith("/users/me"));
			await page.goto(`${baseURL}${prefix}/dialogue/${lessonId}`, { waitUntil: "domcontentloaded", timeout: 90000 });
			await session;
		},
		release(nextProgress = []) {
			holdProgress = false;
			failProgress = false;
			savedProgress = nextProgress;
			releaseProgress();
		},
		succeedRetry(nextProgress = completeStatuses) {
			failProgress = false;
			savedProgress = nextProgress;
		},
		async close() {
			holdProgress = false;
			releaseProgress();
			await context.close();
		},
	};
}

function dialogueRows(f) {
	const section = f.page.locator("section").filter({ has: f.page.getByRole("heading", { name: f.messages.dialoguesHeading, exact: true }) });
	return section.locator('button[aria-expanded]');
}

async function visibleStatus(row) {
	const badges = await row.getByTestId("dialogue-progress-status").all();
	const visible = [];
	for (const badge of badges) if (await badge.isVisible()) visible.push(badge);
	assert.equal(visible.length, 1, "Exactly one responsive status badge is visible per dialogue");
	const box = await visible[0].boundingBox();
	const style = await visible[0].evaluate(element => getComputedStyle(element));
	assert.ok(box.height <= 28, "The status badge stays compact");
	assert.ok(parseFloat(style.fontSize) >= 12, "The status label remains readable");
	return visible[0].innerText();
}

async function assertNoStatuses(f) {
	const rows = dialogueRows(f);
	for (const row of await rows.all()) {
		assert.equal(await row.getByTestId("dialogue-progress-status").count(), 0, "Unknown progress has no confirmed-looking badge");
	}
	assert.equal(await f.page.getByText("0%", { exact: true }).count(), 0, "Unknown progress does not show an assumed zero percentage");
}

async function waitForVisibleStatus(f, status) {
	await f.page.waitForFunction(expected => [...document.querySelectorAll('[data-testid="dialogue-progress-status"]')]
		.some(element => element.getClientRects().length > 0 && element.textContent.trim() === expected), status);
}

async function confirmed(browser, locale, width, theme) {
	const f = await fixture(browser, { locale, width, theme });
	try {
		await f.open();
		await f.page.waitForFunction(expected => document.documentElement.dataset.theme === expected, theme);
		const rows = await dialogueRows(f).all();
		assert.equal(rows.length, 4, "The Coffee Shop lesson has four dialogue cards");
		const expected = [f.messages.completed, f.messages.continue, f.messages.notStarted, f.messages.notStarted];
		for (const [index, row] of rows.entries()) assert.equal(await visibleStatus(row), expected[index]);
		const axe = await new AxeBuilder({ page: f.page })
			.include('[data-testid="dialogue-progress-status"]')
			.withRules(["color-contrast"]).analyze();
		assert.deepEqual(axe.violations, [], `${locale} ${width}px ${theme}: status label contrast`);
		assert.deepEqual(f.pageErrors, []);
		console.log(`PASS ${locale} ${width}px ${theme}: Completed, Continue, and Not started badges match confirmed progress`);
	} finally { await f.close(); }
}

async function guest(browser, locale, width) {
	const f = await fixture(browser, { locale, width, state: "guest", progress: [] });
	try {
		await f.open();
		await f.page.getByText(f.messages.guestProgressNotSaved, { exact: true }).waitFor();
		await assertNoStatuses(f);
		assert.equal(f.progressRequests, 0, "Guests do not receive saved-progress requests");
		assert.deepEqual(f.pageErrors, []);
		console.log(`PASS ${locale} ${width}px guest: no unconfirmed status badge or assumed progress`);
	} finally { await f.close(); }
}

async function loading(browser, locale, width) {
	const f = await fixture(browser, { locale, width, state: "loading", progress: [] });
	try {
		await f.open();
		await f.page.getByRole("status").filter({ hasText: f.messages.progressLoading }).waitFor();
		await assertNoStatuses(f);
		f.release([]);
		await waitForVisibleStatus(f, f.messages.notStarted);
		const rows = await dialogueRows(f).all();
		for (const row of rows) assert.equal(await visibleStatus(row), f.messages.notStarted);
		assert.deepEqual(f.pageErrors, []);
		console.log(`PASS ${locale} ${width}px loading: no status until the zero-progress response is confirmed`);
	} finally { await f.close(); }
}

async function failedThenRetry(browser, locale, width) {
	const f = await fixture(browser, { locale, width, state: "failed", progress: [] });
	try {
		await f.open();
		await f.page.getByRole("alert").filter({ hasText: f.messages.progressUnavailable }).waitFor();
		await assertNoStatuses(f);
		f.succeedRetry();
		await f.page.getByRole("button", { name: f.messages.retryProgressLoad, exact: true }).click();
		await waitForVisibleStatus(f, f.messages.continue);
		const rows = await dialogueRows(f).all();
		const expected = [f.messages.completed, f.messages.continue, f.messages.notStarted, f.messages.notStarted];
		for (const [index, row] of rows.entries()) assert.equal(await visibleStatus(row), expected[index]);
		assert.deepEqual(f.pageErrors, []);
		console.log(`PASS ${locale} ${width}px failed/retry: badges appear after saved progress is restored`);
	} finally { await f.close(); }
}

(async () => {
	const browser = await chromium.launch({ channel: "chrome", headless: true });
	try {
		for (const locale of ["vi", "en"]) {
			for (const width of [390, 1280]) {
				for (const theme of ["light", "dark"]) await confirmed(browser, locale, width, theme);
				await guest(browser, locale, width);
				await loading(browser, locale, width);
				await failedThenRetry(browser, locale, width);
			}
		}
	} finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
