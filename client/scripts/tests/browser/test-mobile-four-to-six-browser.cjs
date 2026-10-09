// Run with Playwright available and Next dev running on localhost:3000.
// All API calls are intercepted; no live account or vocabulary data is changed.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const path = require("node:path");

const baseURL = process.env.STUDYJONY_TEST_URL || "http://localhost:3000";
const longWord = {
	_id: "000000000000000000000001",
	english: "An unusually long English vocabulary phrase that must stay fully readable. ".repeat(5) + "unbroken".repeat(12),
	vietnamese: "Một nghĩa tiếng Việt rất dài để kiểm tra tất cả nội dung đều đọc được trên điện thoại. ".repeat(6),
	example: "This longer English example gives the learner enough context to understand and remember the complete meaning. ".repeat(12),
	pronunciation: "/test/", nextReview: "2020-01-01", reviewCount: 0,
};
const shortWord = { ...longWord, _id: "000000000000000000000002", english: "coffee", vietnamese: "cà phê", example: "" };

async function setup(browser, width, locale, theme, authenticated = true) {
	const page = await browser.newPage({ viewport: { width, height: 568 }, hasTouch: true, isMobile: width < 640, colorScheme: theme });
	const errors = [];
	page.on("pageerror", error => errors.push(error.message));
	await page.addInitScript(theme => localStorage.setItem("studyjony-theme", theme), theme);
	await page.route("**/api/v1/**", route => {
		const url = new URL(route.request().url());
		if (url.pathname === "/api/v1/users/me") return route.fulfill({ status: authenticated ? 200 : 401, json: {
			data: { user: authenticated ? { _id: "learner", name: "Learner", email: "learner@example.com", theme } : null },
		} });
		if (url.pathname === "/api/v1/vocab") return route.fulfill({ json: { data: { vocabularies: [longWord, shortWord] } } });
		if (url.pathname.endsWith("/review")) return route.fulfill({ json: { status: "success", data: { updatedVocab: longWord } } });
		if (url.pathname === "/api/v1/study-activities") return route.fulfill({ json: { data: { activities: [] } } });
		return route.fulfill({ json: { data: {} } });
	});
	const prefix = locale === "en" ? "/en" : "";
	async function ready() {
		await page.waitForFunction(theme => document.documentElement.dataset.theme === theme, theme);
	}
	async function finish() {
		assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "No page overflow");
		assert.deepEqual(errors, [], "No browser runtime errors");
		await page.close();
	}
	return { page, prefix, ready, finish };
}

async function checkProfile(browser, width, locale, theme) {
	const { page, prefix, ready, finish } = await setup(browser, width, locale, theme);
	await page.goto(`${baseURL}${prefix}/profile`);
	const language = page.getByRole("button", { name: locale === "vi" ? "Chọn ngôn ngữ" : "Choose language", exact: true }).last();
	await language.waitFor();
	await ready();
	const rows = language.locator('../..').locator('..').locator(':scope > div');
	assert.equal(await rows.count(), 3);
	for (const row of await rows.all()) {
		assert.ok(await row.evaluate(element => {
			const bounds = element.getBoundingClientRect();
			const [label, control] = [...element.children].map(child => child.getBoundingClientRect());
			const contained = [label, control].every(rect => rect.left >= bounds.left && rect.right <= bounds.right);
			return contained && (control.top >= label.bottom || control.left >= label.right);
		}), "Settings labels and controls must fit without overlap");
		if (width >= 640) assert.equal(await row.evaluate(element => getComputedStyle(element).flexWrap), "nowrap");
	}
	await language.click();
	const menu = language.locator('..').getByRole("menu");
	const bounds = await menu.boundingBox();
	assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width, "Language dropdown must fit");
	await language.click();
	await finish();
}

async function checkFlashcard(browser, width, locale, theme) {
	const { page, prefix, ready, finish } = await setup(browser, width, locale, theme);
	await page.goto(`${baseURL}${prefix}/wordlist/review/flashcard`);
	const t = require(`../../../messages/${locale}.json`).WordlistReview.flashcard;
	const card = page.getByRole("button", { name: t.reveal, exact: true });
	await card.waitFor();
	await ready();
	async function assertContentFits() {
		assert.ok(await card.evaluate(element => [...element.querySelectorAll('[aria-hidden]')]
			.filter(face => face.tagName === "SPAN" && face.hasAttribute("aria-hidden"))
			.every(face => face.scrollHeight <= face.clientHeight + 1 && face.scrollWidth <= face.clientWidth + 1)),
		"Both card faces must contain their full text");
	}
	await assertContentFits();
	const height = (await card.boundingBox()).height;
	assert.ok(height > 360, "Long content must grow the card");
	await card.click({ position: { x: 30, y: 90 } });
	const flipped = page.getByRole("button", { name: t.flipBack, exact: true });
	await flipped.waitFor();
	await page.waitForFunction(() => {
		const flipper = document.querySelector('[data-visible-face="back"]');
		return flipper && Math.abs(new DOMMatrix(getComputedStyle(flipper).transform).m11 + 1) < 0.001;
	});
	assert.equal((await flipped.boundingBox()).height, height, "Flip must not change card height");
	const back = flipped.locator('span[aria-hidden="false"]').first();
	assert.ok((await back.innerText()).includes(longWord.vietnamese.trim()));
	assert.ok((await back.innerText()).includes(longWord.example.trim()));
	assert.equal(await back.evaluate(element => getComputedStyle(element).backfaceVisibility), "hidden");
	await page.setViewportSize({ width, height: 280 });
	await flipped.locator('span[aria-hidden="false"]').first().locator(':scope > span').last().scrollIntoViewIfNeeded();
	assert.ok(await page.evaluate(() => scrollY > 0), "Long card remains readable by page scrolling on short screens");
	if (process.env.STUDYJONY_SCREENSHOTS && width === 320 && locale === "en") {
		await page.screenshot({ path: path.join(process.env.STUDYJONY_SCREENSHOTS, `flashcard-long-${theme}.png`), fullPage: true });
	}
	await page.getByRole("button", { name: new RegExp(t.forgot) }).click();
	await page.getByRole("button", { name: t.reveal, exact: true }).waitFor();
	assert.ok((await page.getByRole("button", { name: t.reveal, exact: true }).boundingBox()).height <= (width >= 640 ? 362 : 302),
		"Short card keeps its original minimum height");
	await finish();
}

async function checkNavigation(browser, width, locale, theme, authenticated) {
	const { page, prefix, ready, finish } = await setup(browser, width, locale, theme, authenticated);
	await page.goto(`${baseURL}${prefix}/wordlist`);
	await ready();
	const toggle = page.getByRole("button", { name: "Toggle menu" });
	await toggle.click();
	const menu = toggle.locator('..').locator(':scope > div');
	for (const height of [568, 280]) {
		await page.setViewportSize({ width, height });
		const bounds = await menu.boundingBox();
		assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= height + 1, "Menu must end within the viewport");
		if (height === 280) assert.ok(await menu.evaluate(element => element.scrollHeight > element.clientHeight), "Short menu must scroll internally");
		const lastLink = menu.getByRole("link").last();
		await lastLink.scrollIntoViewIfNeeded();
		await lastLink.click({ trial: true });
	}
	await toggle.click();
	await finish();
}

async function run() {
	const browser = await chromium.launch({ channel: "chrome", headless: true });
	try {
		for (const width of [320, 375, 430]) for (const locale of ["vi", "en"]) for (const theme of ["light", "dark"]) {
			await checkProfile(browser, width, locale, theme);
			await checkFlashcard(browser, width, locale, theme);
			for (const authenticated of [false, true]) await checkNavigation(browser, width, locale, theme, authenticated);
			console.log(`PASS ${width}px ${locale} ${theme}: settings, long/short flashcards, guest/user menu at 568/280px heights`);
		}
		for (const width of [768, 1280]) {
			await checkProfile(browser, width, "en", "light");
			await checkFlashcard(browser, width, "en", "light");
			console.log(`PASS ${width}px: profile tablet/desktop layout and flashcard size/animation`);
		}
	} finally { await browser.close(); }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
