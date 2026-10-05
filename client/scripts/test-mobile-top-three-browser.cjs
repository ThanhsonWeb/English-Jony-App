// Run with Playwright available and Next dev running on localhost:3000.
// API calls are mocked; this test never creates accounts or changes live data.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");

const baseURL = process.env.STUDYJONY_TEST_URL || "http://localhost:3000";
const statuses = ["all", "new", "learning", "review", "mastered"];
const words = [{
	_id: "000000000000000000000001", english: "coffee", vietnamese: "cà phê",
	pronunciation: "/test/", example: "I like coffee.", reviewCount: 0,
	nextReview: "2099-01-01", learningLevel: 0,
}];

async function setup(browser, width, locale, theme, authenticated = false) {
	const page = await browser.newPage({
		viewport: { width, height: 568 }, isMobile: true, hasTouch: true,
		colorScheme: theme,
	});
	await page.addInitScript((theme) => {
		localStorage.setItem("studyjony-theme", theme);
	}, theme);
	await page.route("https://accounts.google.com/**", route => route.abort());
	await page.route("**/api/v1/**", route => {
		const url = new URL(route.request().url());
		if (url.pathname === "/api/v1/users/me") {
			return route.fulfill({ status: authenticated ? 200 : 401, json: {
				data: { user: authenticated ? { _id: "learner", name: "Learner", theme } : null },
			} });
		}
		if (url.pathname === "/api/v1/vocab") {
			assert.equal(route.request().method(), "GET");
			return route.fulfill({ json: { data: { vocabularies: words } } });
		}
		return route.fulfill({ status: 401, json: { status: "fail", message: "Test response" } });
	});
	return { page, prefix: locale === "en" ? "/en" : "" };
}

async function assertNoOverflow(page) {
	assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
		"Page must fit the phone width");
}

async function assertTheme(page, theme) {
	await page.waitForFunction(theme => document.documentElement.dataset.theme === theme, theme);
}

async function checkAuth(browser, width, locale, theme, route) {
	const { page, prefix } = await setup(browser, width, locale, theme);
	// A keyboard reduces the visual viewport while the layout viewport stays tall.
	await page.addInitScript(() => {
		const viewport = new EventTarget();
		let heightOverride;
		Object.defineProperty(viewport, "height", { get: () => heightOverride ?? innerHeight });
		viewport.offsetTop = 0;
		Object.defineProperty(window, "visualViewport", { configurable: true, value: viewport });
		window.setTestVisualViewport = (height, offsetTop) => {
			heightOverride = height;
			viewport.offsetTop = offsetTop;
			viewport.dispatchEvent(new Event("resize"));
			viewport.dispatchEvent(new Event("scroll"));
		};
	});
	await page.goto(`${baseURL}${prefix}/${route}`);
	const submit = page.locator('button[type="submit"]');
	await submit.waitFor();
	// Locate the fixed scrolling ancestor rather than relying on CSS module names.
	async function scrollToSubmit() {
		await submit.evaluate(element => {
			let ancestor = element.parentElement;
			while (ancestor && getComputedStyle(ancestor).position !== "fixed") ancestor = ancestor.parentElement;
			ancestor.scrollTop = ancestor.scrollHeight;
		});
		await submit.click({ trial: true });
	}
	await assertTheme(page, theme);
	await assertNoOverflow(page);
	await scrollToSubmit();
	await page.locator('input').last().focus();
	await page.evaluate(() => window.setTestVisualViewport(280, 64));
	await page.waitForFunction(() => [...document.querySelectorAll('div')].some(element =>
		getComputedStyle(element).position === "fixed" && element.style.height === "280px"));
	await scrollToSubmit();
	const bounds = await submit.boundingBox();
	assert.ok(bounds.y >= 64 && bounds.y + bounds.height <= 344, "Submit must be reachable above the keyboard");
	await page.evaluate(() => window.setTestVisualViewport(568, 0));
	await scrollToSubmit();
	await assertNoOverflow(page);
	await page.close();
}

async function checkWordlist(browser, width, locale, theme) {
	const { page, prefix } = await setup(browser, width, locale, theme, true);
	await page.goto(`${baseURL}${prefix}/wordlist`);
	const t = require(`../messages/${locale}.json`).Notebook;
	const filters = page.locator('button[aria-pressed]');
	await filters.first().waitFor();
	await assertTheme(page, theme);
	assert.deepEqual(await filters.allTextContents(), statuses.map(status => t[status]));
	await filters.nth(1).click();
	assert.equal(await filters.nth(1).getAttribute("aria-pressed"), "true");
	await assertNoOverflow(page);
	await page.close();
}

async function checkUsefulWords(browser, width, locale, theme) {
	const { page, prefix } = await setup(browser, width, locale, theme, true);
	await page.goto(`${baseURL}${prefix}/dialogue/coffee-shop/ordering-a-coffee/useful-words`);
	const t = require(`../messages/${locale}.json`).DialogueFeature;
	const skip = page.getByRole("button", { name: t.skip, exact: true });
	await skip.waitFor();
	await assertTheme(page, theme);
	const bar = skip.locator('..');
	const nav = page.locator('nav').filter({ has: page.locator('a[href$="/profile"]') }).last();
	const session = await page.context().newCDPSession(page);
	for (const safeArea of [0, 34]) {
		await session.send("Emulation.setSafeAreaInsetsOverride", { insets: { top: 0, left: 0, right: 0, bottom: safeArea } });
		assert.equal(await bar.evaluate(element => parseFloat(getComputedStyle(element).bottom)), 76 + safeArea);
		for (const scroll of [0, 250, 500, 100000]) {
			await page.evaluate(y => window.scrollTo(0, y), scroll);
			const actionBounds = await bar.boundingBox();
			const navBounds = await nav.boundingBox();
			assert.ok(actionBounds.y + actionBounds.height <= navBounds.y + 1,
				`Action bar overlaps bottom navigation with ${safeArea}px safe area`);
		}
		await skip.click({ trial: true });
	}
	await assertNoOverflow(page);
	await page.close();
}

async function run() {
	const browser = await chromium.launch({ channel: "chrome", headless: true });
	try {
		for (const width of [320, 375, 430]) {
			for (const locale of ["vi", "en"]) {
				for (const theme of ["light", "dark"]) {
					for (const route of ["login", "signup"]) await checkAuth(browser, width, locale, theme, route);
					await checkWordlist(browser, width, locale, theme);
					await checkUsefulWords(browser, width, locale, theme);
					console.log(`PASS ${width}px ${locale} ${theme}: auth scroll/keyboard, filters, actions/safe area`);
				}
			}
		}
	} finally { await browser.close(); }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
