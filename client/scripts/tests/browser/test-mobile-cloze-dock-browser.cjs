// Run with Playwright available and Next dev running on localhost:3000.
// All API requests are mocked; no live progress is changed.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const path = require("node:path");
const baseURL = process.env.STUDYJONY_TEST_URL || "http://localhost:3000";
const route = "/dialogue/coffee-shop/ordering-a-coffee/23";
const lesson = require("../../../app/[locale]/(main)/dialogue/_data/dialogues/coffee-shop/ordering-a-coffee.json");
const answers = lesson.tasks.find(task => task.type === "dialogueCloze").lines
	.flatMap(line => line.parts.filter(part => typeof part === "object").map(part => part.blank));

async function setup(browser, width, height, locale, theme, taskRoute = route) {
	const page = await browser.newPage({ viewport: { width, height }, isMobile: width < 768,
		hasTouch: width < 768, colorScheme: theme });
	const errors = [];
	page.on("pageerror", error => errors.push(error.message));
	page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
	await page.addInitScript(theme => localStorage.setItem("studyjony-theme", theme), theme);
	await page.route("https://accounts.google.com/**", request => request.abort());
	await page.route("**/api/v1/**", request => request.fulfill({ json: { data: {
		user: { _id: "learner", name: "Learner", theme }, progress: {},
	} } }));
	await page.goto(`${baseURL}${locale === "en" ? "/en" : ""}${taskRoute}`);
	await page.locator("aside div[id] button").first().waitFor();
	await page.waitForFunction(theme => document.documentElement.dataset.theme === theme, theme);
	return { page, errors, t: require(`../../../messages/${locale}.json`).DialogueFeature };
}

async function assertVisibleBlank(page) {
	await page.waitForFunction(() => {
		const blank = document.querySelector('section button[aria-pressed="true"]');
		if (!blank) return false;
		const rect = blank.getBoundingClientRect();
		const top = document.querySelector("header.sticky").getBoundingClientRect().bottom;
		const bottom = document.querySelector("aside").getBoundingClientRect().top;
		return rect.top >= top && rect.bottom <= bottom;
	});
}

async function tapBlank(page, index) {
	const blank = page.locator("section button[aria-pressed]").nth(index);
	await blank.evaluate(element => {
		const top = document.querySelector("header.sticky").getBoundingClientRect().bottom + 12;
		window.scrollBy(0, element.getBoundingClientRect().top - top);
	});
	await blank.tap();
	await assertVisibleBlank(page);
}

async function assertNoOverflow(page) {
	assert.equal(await page.evaluate(() => innerWidth), page.viewportSize().width, "Mobile layout must not expand the viewport");
	assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "No horizontal overflow");
}

async function checkPhone(browser, width, height, locale, theme, initialOrder) {
	const { page, errors, t } = await setup(browser, width, height, locale, theme);
	const dock = page.locator("aside");
	const words = page.locator("aside div[id]");
	const section = page.locator("section[aria-label]");
	const nav = page.locator("nav").filter({ has: page.locator('a[href$="/profile"]') }).last();
	assert.deepEqual(await words.locator("button").allTextContents(), initialOrder, "SSR/client shuffled order must match");
	assert.notDeepEqual(initialOrder, answers, "Word bank must stay shuffled");
	assert.equal(await section.evaluate(element => getComputedStyle(element).maxHeight), "none");
	assert.equal(await section.evaluate(element => getComputedStyle(element).overflowY), "visible");
	assert.equal(await dock.evaluate(element => getComputedStyle(element).position), "fixed");
	assert.ok((await dock.boundingBox()).height <= 160, "Dock stays compact on short/normal phones");
	assert.ok(await words.evaluate(element => element.scrollHeight > element.clientHeight), "Only bank scrolls internally");
	const session = await page.context().newCDPSession(page);
	for (const safeArea of [0, 34]) {
		await session.send("Emulation.setSafeAreaInsetsOverride", { insets: { top: 0, left: 0, right: 0, bottom: safeArea } });
		assert.equal(await dock.evaluate(element => parseFloat(getComputedStyle(element).bottom)), 76 + safeArea);
		for (const y of [0, 400, 100000]) {
			await page.evaluate(y => window.scrollTo(0, y), y);
			const bounds = await dock.boundingBox();
			assert.ok(bounds.y + bounds.height <= (await nav.boundingBox()).y, "Dock clears navigation including safe area");
		}
		await tapBlank(page, 9);
		await words.getByRole("button", { name: answers[9], exact: true }).tap();
		await page.locator('section button[aria-pressed="true"]').filter({ hasText: /^\s*$/ }).first().waitFor();
		assert.equal(await page.locator("section button[aria-pressed]").nth(0).getAttribute("aria-pressed"), "true", "Advance wraps to first empty blank");
		await assertVisibleBlank(page);
		await page.getByRole("button", { name: t.collapseWordBank, exact: true }).tap();
		await words.waitFor({ state: "hidden" });
		assert.ok((await dock.boundingBox()).height <= 64, "Collapsed bank frees reading space");
		await page.getByRole("button", { name: t.expandWordBank, exact: true }).tap();
		await assertVisibleBlank(page);
		if (process.env.STUDYJONY_SCREENSHOTS && safeArea === 34 && width === 320 && height === 480 && locale === "en") {
			await page.screenshot({ path: path.join(process.env.STUDYJONY_SCREENSHOTS, `cloze-dock-${theme}.png`) });
		}
		const clear = page.getByRole("button", { name: t.clearBlank.replace("{number}", "10"), exact: true });
		await clear.evaluate(element => window.scrollBy(0, element.getBoundingClientRect().top - 100));
		await clear.tap();
		await assertVisibleBlank(page);
		await words.getByRole("button", { name: answers[9], exact: true }).waitFor();
		await assertNoOverflow(page);
	}
	// Exercise check/error/correction/completion, including reaching the action above the dock.
	for (let index = 0; index < answers.length; index++) {
		await tapBlank(page, index);
		const answer = answers[index === 0 ? 1 : index === 1 ? 0 : index];
		await words.getByRole("button", { name: answer, exact: true }).tap();
		await assertVisibleBlank(page);
	}
	const check = page.getByRole("button", { name: t.check, exact: true });
	await check.evaluate(element => window.scrollBy(0, element.getBoundingClientRect().top - 100));
	await check.tap();
	await page.locator('[aria-live="polite"]').filter({ hasText: t.clozeWrong }).waitFor();
	await assertVisibleBlank(page);
	assert.equal(await page.locator("section button[aria-pressed]").nth(2).isDisabled(), true, "Correct blanks stay locked");
	for (const index of [0, 1]) {
		const clear = page.getByRole("button", { name: t.clearBlank.replace("{number}", String(index + 1)), exact: true });
		await clear.evaluate(element => window.scrollBy(0, element.getBoundingClientRect().top - 100));
		await clear.tap();
	}
	for (const index of [0, 1]) {
		await tapBlank(page, index);
		await words.getByRole("button", { name: answers[index], exact: true }).tap();
		await assertVisibleBlank(page);
	}
	await check.evaluate(element => window.scrollBy(0, element.getBoundingClientRect().top - 100));
	await check.tap();
	const complete = page.getByRole("link", { name: t.completeDialogue, exact: true });
	await complete.evaluate(element => window.scrollBy(0, element.getBoundingClientRect().top - 100));
	await complete.click({ trial: true });
	assert.ok((await complete.boundingBox()).y + (await complete.boundingBox()).height < (await dock.boundingBox()).y,
		"Completion action stays reachable above dock");
	await page.getByRole("button", { name: t.typeAnswer, exact: true }).click();
	assert.equal(await dock.evaluate(element => getComputedStyle(element).position), "static", "Typing has no fixed dock");
	assert.equal(await section.evaluate(element => getComputedStyle(element).overflowY), "auto");
	assert.equal(await page.locator("section input").count(), answers.length);
	assert.equal(await dock.locator("button").count(), 0, "Typing suggestions stay display-only");
	assert.deepEqual(await dock.locator(".grid > div").allTextContents(), initialOrder, "Mode switch preserves shuffled order");
	await page.getByRole("button", { name: t.chooseWords, exact: true }).click();
	await assertNoOverflow(page);
	assert.deepEqual(errors, [], "No hydration/runtime/console errors");
	await page.close();
}

async function checkDesktop(browser, width, locale, theme, initialOrder) {
	const { page, errors, t } = await setup(browser, width, 800, locale, theme);
	const dock = page.locator("aside");
	const section = page.locator("section[aria-label]");
	assert.deepEqual(await page.locator("aside div[id] button").allTextContents(), initialOrder);
	assert.equal(await dock.evaluate(element => getComputedStyle(element).position), width >= 1024 ? "sticky" : "static");
	assert.equal(await page.getByRole("button", { name: t.collapseWordBank, exact: true, includeHidden: true }).isVisible(), false);
	assert.equal(await section.evaluate(element => getComputedStyle(element).overflowY), "auto");
	assert.equal(await section.evaluate(element => getComputedStyle(element).maxHeight), "520px");
	if (width >= 1024) {
		const bankBounds = await dock.boundingBox(); const dialogueBounds = await section.boundingBox();
		assert.equal(bankBounds.width, 280);
		assert.equal(bankBounds.y, dialogueBounds.y);
		assert.ok(bankBounds.x + bankBounds.width < dialogueBounds.x);
	}
	await page.locator("section button[aria-pressed]").last().click();
	const previousScroll = await section.evaluate(element => element.scrollTop);
	await page.locator("aside div[id] button").first().click();
	assert.equal(await section.evaluate(element => element.scrollTop), previousScroll, "Desktop has no new automatic scrolling");
	await page.getByRole("button", { name: t.typeAnswer, exact: true }).click();
	assert.equal(await section.evaluate(element => getComputedStyle(element).maxHeight), "520px");
	assert.equal(await dock.locator("button").count(), 0);
	await assertNoOverflow(page);
	assert.deepEqual(errors, []);
	await page.close();
}

async function checkLongPhrases(browser, width, locale, theme) {
	const { page, errors } = await setup(browser, width, 480, locale, theme, "/dialogue/grocery-store/checking-out/27");
	await assertNoOverflow(page);
	await tapBlank(page, 3);
	await page.locator("aside div[id]").getByRole("button", { name: "eighteen dollars and fifty cents", exact: true }).tap();
	await assertVisibleBlank(page);
	await assertNoOverflow(page);
	const filled = page.locator("section button[aria-pressed]").nth(3);
	assert.equal(await filled.textContent(), "eighteen dollars and fifty cents");
	assert.ok(await filled.evaluate(element => element.scrollWidth <= element.clientWidth), "Long filled answers wrap inside the blank");
	assert.deepEqual(errors, []);
	await page.close();
}

async function run() {
	const browser = await chromium.launch({ channel: "chrome", headless: true });
	try {
		const serverPage = await browser.newPage({ javaScriptEnabled: false });
		await serverPage.goto(`${baseURL}/en${route}`);
		const initialOrder = await serverPage.locator("aside div[id] button").allTextContents();
		assert.equal(initialOrder.length, answers.length);
		await serverPage.close();
		for (const width of [320, 375, 430]) for (const height of [480, 740])
			for (const locale of ["vi", "en"]) for (const theme of ["light", "dark"]) {
				await checkPhone(browser, width, height, locale, theme, initialOrder);
				console.log(`PASS ${width}x${height} ${locale} ${theme}: dock, safe areas, answers, typing, hydration`);
			}
		for (const width of [768, 1024, 1280]) for (const locale of ["vi", "en"]) for (const theme of ["light", "dark"]) {
			await checkDesktop(browser, width, locale, theme, initialOrder);
			console.log(`PASS ${width}px ${locale} ${theme}: tablet/desktop unchanged, hydration`);
		}
		for (const width of [320, 375, 430]) for (const locale of ["vi", "en"]) for (const theme of ["light", "dark"]) {
			await checkLongPhrases(browser, width, locale, theme);
			console.log(`PASS ${width}px ${locale} ${theme}: long phrases fit phone width`);
		}
	} finally { await browser.close(); }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
