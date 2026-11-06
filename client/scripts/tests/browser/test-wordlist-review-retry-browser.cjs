// Retry failed vocabulary loading on the global Flashcards, Quiz, and Writing routes.
const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const baseURL = process.env.STUDYJONY_TEST_URL || "http://localhost:3000";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname));
const userId = "aaaaaaaaaaaaaaaaaaaaaaaa";
const words = [
	{ _id: "word-apple", english: "apple", vietnamese: "quả táo", example: "I ate an apple.", reviewCount: 0, status: false },
	{ _id: "word-book", english: "book", vietnamese: "quyển sách", example: "This book is new.", reviewCount: 0, status: false },
	{ _id: "word-water", english: "water", vietnamese: "nước", example: "Drink some water.", reviewCount: 0, status: false },
	{ _id: "word-coffee", english: "coffee", vietnamese: "cà phê", example: "Coffee is ready.", reviewCount: 0, status: false },
];
const modes = {
	flashcard: { route: "/wordlist/review/flashcard", section: "flashcard", error: "flashcard.loadError" },
	quiz: { route: "/wordlist/review/quiz", section: "quiz", error: "common.loadError" },
	write: { route: "/wordlist/review/write", section: "writing", error: "common.loadError" },
};

async function run(browser, locale, width, mode) {
	const prefix = locale === "en" ? "/en" : "";
	const messages = require(`../../../messages/${locale}.json`);
	const context = await browser.newContext({
		viewport: { width, height: 844 },
		isMobile: width < 768,
		hasTouch: width < 768,
	});
	await context.addCookies([{ name: "sj_guest_language", value: locale, url: baseURL }]);
	let vocabularyRequests = 0;
	let reviewWrites = 0;
	await context.route("**/*", route => new URL(route.request().url()).origin === new URL(baseURL).origin
		? route.continue() : route.fulfill({ body: "" }));
	await context.route("**/api/v1/**", route => {
		const request = route.request();
		const path = new URL(request.url()).pathname;
		if (path.endsWith("/users/me")) return route.fulfill({ json: { status: "success", data: { user: {
			_id: userId, name: "Review retry tester", language: locale,
		} } } });
		if (path.endsWith("/vocab")) {
			if (request.method() !== "GET") reviewWrites++;
			if (request.method() === "GET") {
				vocabularyRequests++;
				return vocabularyRequests <= 2
					? route.fulfill({ status: 503, json: { status: "error" } })
					: route.fulfill({ json: { status: "success", data: { vocabularies: words } } });
			}
		}
		return route.fulfill({ json: { status: "success", data: { progress: [], vocabularies: [], topics: [], activities: [] } } });
	});
	const page = await context.newPage();
	page.setDefaultTimeout(20000);
	const pageErrors = [];
	page.on("pageerror", error => pageErrors.push(error.message));
	const reviewMessages = messages.WordlistReview;
	const modeMessages = reviewMessages[mode.section];
	const errorMessage = mode.error.split(".").reduce((value, key) => value[key], reviewMessages);
	const expectedTitle = modeMessages.title;
	try {
		await page.goto(`${baseURL}${prefix}${mode.route}`, { waitUntil: "domcontentloaded", timeout: 90000 });
		await page.getByText(errorMessage, { exact: true }).waitFor();
		const originalTimeOrigin = await page.evaluate(() => performance.timeOrigin);
		const retry = () => page.getByRole("button", { name: messages.ErrorPages.retry, exact: true });
		assert.equal(await retry().count(), 1, `${locale} ${width}px ${mode.route}: localized retry is available`);
		assert.equal(vocabularyRequests, 1, "Initial vocabulary request fails once");

		await retry().click();
		await page.getByText(errorMessage, { exact: true }).waitFor();
		assert.equal(vocabularyRequests, 2, "A repeated failure starts a fresh vocabulary request");
		assert.equal(await retry().count(), 1, "Retry remains available after another failure");

		await retry().click();
		await page.getByRole("heading", { name: expectedTitle, exact: true }).waitFor();
		assert.equal(vocabularyRequests, 3, "The next retry recovers with fresh vocabulary");
		assert.equal(await retry().count(), 0, "Retry screen clears after successful recovery");
		assert.equal(new URL(page.url()).pathname, `${prefix}${mode.route}`, "Recovery stays on the practice route");
		assert.equal(await page.evaluate(() => performance.timeOrigin), originalTimeOrigin, "Retry does not reload the page");
		assert.equal(reviewWrites, 0, "Loading retries do not submit reviews or alter SRS/XP");
		assert.deepEqual(pageErrors, []);
		console.log(`PASS ${locale} ${width}px ${mode.route}: failed -> repeated failure -> retry success in place`);
	} finally {
		await context.close();
	}
}

(async () => {
	const browser = await chromium.launch({ channel: "chrome", headless: true });
	try {
		for (const locale of ["vi", "en"]) {
			for (const width of [390, 1280]) {
				for (const mode of Object.keys(modes)) await run(browser, locale, width, modes[mode]);
			}
		}
	} finally {
		await browser.close();
	}
})().catch(error => { console.error(error); process.exitCode = 1; });
