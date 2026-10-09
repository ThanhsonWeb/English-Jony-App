// Run with Playwright available and Next dev running on localhost:3000.
// API calls and speech are mocked; this test never changes live learner data.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const path = require("node:path");
const baseURL = process.env.STUDYJONY_TEST_URL || "http://localhost:3000";
const topicId = "000000000000000000000099";
const words = ["coffee", "apple", "water"].map((english, i) => ({
	_id: String(i + 1).padStart(24, "0"), english,
	vietnamese: ["cà phê", "quả táo", "nước"][i], pronunciation: "/test/",
	example: `I like ${english}.`, nextReview: "2020-01-01", reviewCount: 0,
}));

async function setup(browser, width, locale, theme, touch = width < 768) {
	const page = await browser.newPage({ viewport: { width, height: 700 }, hasTouch: touch, isMobile: width < 768, colorScheme: theme });
	const errors = [];
	page.on("pageerror", error => errors.push(error.message));
	await page.addInitScript(theme => {
		localStorage.setItem("studyjony-theme", theme);
		window.testInputFocusCalls = 0;
		window.testPronunciations = [];
		const focus = HTMLElement.prototype.focus;
		HTMLElement.prototype.focus = function (...args) {
			if (this.id === "write-answer") window.testInputFocusCalls++;
			return focus.apply(this, args);
		};
		Object.defineProperty(window, "speechSynthesis", { value: {
			cancel() {}, speak(utterance) { window.testPronunciations.push(utterance.text); },
		} });
	}, theme);
	await page.route("**/api/v1/**", route => {
		const url = new URL(route.request().url());
		if (url.pathname === "/api/v1/users/me") return route.fulfill({ json: { data: {
			user: { _id: "learner", name: "Learner", theme },
		} } });
		if (url.pathname === "/api/v1/vocab") return route.fulfill({ json: { data: { vocabularies: words } } });
		if (url.pathname.endsWith("/review")) return route.fulfill({ json: { status: "success", data: { updatedVocab: words[0] } } });
		return route.fulfill({ json: { data: {} } });
	});
	const prefix = locale === "en" ? "/en" : "";
	async function ready() { await page.waitForFunction(theme => document.documentElement.dataset.theme === theme, theme); }
	async function finish() {
		assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "No horizontal overflow");
		assert.deepEqual(errors, [], "No browser runtime errors");
		await page.close();
	}
	return { page, prefix, ready, finish };
}

async function checkWriting(browser, width, locale, theme, touch = width < 768, topic = false) {
	const { page, prefix, ready, finish } = await setup(browser, width, locale, theme, touch);
	await page.goto(`${baseURL}${prefix}/wordlist/${topic ? `${topicId}/learn` : "review"}/write`);
	const input = page.locator("#write-answer");
	await input.waitFor();
	await ready();
	const automaticFocus = !touch && width >= 768;
	async function assertFocus() {
		if (automaticFocus) await page.waitForFunction(() => document.activeElement?.id === "write-answer");
		assert.equal(await input.evaluate(element => element === document.activeElement), automaticFocus);
		if (!automaticFocus) assert.equal(await page.evaluate(() => window.testInputFocusCalls), 0,
			"Touch/mobile questions must never call input.focus()");
	}
	await assertFocus();
	if (touch) await input.tap();
	else await input.click();
	assert.equal(await input.evaluate(element => element === document.activeElement), true, "Intentional tap focuses input");
	await input.fill("coffee");
	await page.locator('button[type="submit"]').click();
	await page.getByRole("heading", { name: "quả táo", exact: true }).waitFor();
	await assertFocus();
	if (touch) await input.tap();
	else await input.click();
	await input.fill("wrong-answer");
	await page.locator('button[type="submit"]').click();
	await page.waitForFunction(() => document.querySelector("#write-answer")?.disabled);
	await page.locator('button[type="submit"]').click();
	await page.getByRole("heading", { name: "nước", exact: true }).waitFor();
	await assertFocus();
	await finish();
}

async function assertTarget(button, size, iconSize) {
	const rect = await button.boundingBox();
	assert.equal(rect.width, size);
	assert.equal(rect.height, size);
	const icon = await button.locator("svg").boundingBox();
	assert.equal(icon.width, iconSize, "Icon size must stay unchanged");
	assert.equal(icon.height, iconSize);
}

async function checkWordlist(browser, width, locale, theme) {
	const { page, prefix, ready, finish } = await setup(browser, width, locale, theme);
	await page.goto(`${baseURL}${prefix}/wordlist`);
	const t = require(`../../../messages/${locale}.json`).Notebook;
	const audio = page.getByRole("button", { name: t.audio.replace("{word}", "coffee"), exact: true });
	const edit = page.getByRole("button", { name: `${t.edit} coffee`, exact: true });
	const remove = page.getByRole("button", { name: `${t.remove} coffee`, exact: true });
	await audio.waitFor();
	await ready();
	for (const [button, icon] of [[audio, 19], [edit, 17], [remove, 17]]) {
		await assertTarget(button, width < 768 ? 44 : icon + 10, icon);
		assert.ok(await button.evaluate(element => {
			const rect = element.getBoundingClientRect();
			const row = element.closest("tr").getBoundingClientRect();
			return rect.left >= row.left && rect.right <= row.right;
		}), "Expanded targets must fit their row");
	}
	await audio.click({ position: { x: 3, y: 3 } });
	assert.deepEqual(await page.evaluate(() => window.testPronunciations), ["coffee"]);
	await edit.click({ position: { x: 3, y: 3 } });
	await page.getByRole("dialog").getByRole("button", { name: t.close, exact: true }).click();
	await remove.click({ position: { x: 3, y: 3 } });
	await page.getByRole("dialog").getByRole("button", { name: t.cancel, exact: true }).click();
	if (process.env.STUDYJONY_SCREENSHOTS && width === 320 && locale === "en") {
		await page.screenshot({ path: path.join(process.env.STUDYJONY_SCREENSHOTS, `wordlist-targets-${theme}.png`), fullPage: true });
	}
	await finish();
}

async function checkViewControls(browser, width, locale, theme) {
	const { page, prefix, ready, finish } = await setup(browser, width, locale, theme);
	await page.goto(`${baseURL}${prefix}/wordlist/${topicId}`);
	const t = require(`../../../messages/${locale}.json`).WordlistDetail;
	const list = page.getByRole("button", { name: t.listView, exact: true });
	const card = page.getByRole("button", { name: t.cardView, exact: true });
	await list.waitFor();
	await ready();
	await assertTarget(list, width < 768 ? 44 : 32, 16);
	await assertTarget(card, width < 768 ? 44 : 32, 16);
	await card.click({ position: { x: 3, y: 3 } });
	assert.equal(await page.evaluate(() => localStorage.getItem("studyjony-word-view")), "card");
	assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
	await list.click({ position: { x: 3, y: 3 } });
	assert.equal(await page.evaluate(() => localStorage.getItem("studyjony-word-view")), "list");
	await finish();
}

async function run() {
	const browser = await chromium.launch({ channel: "chrome", headless: true });
	try {
		for (const width of [320, 375, 430, 1280]) for (const locale of ["vi", "en"]) for (const theme of ["light", "dark"]) {
			await checkWriting(browser, width, locale, theme);
			await checkWordlist(browser, width, locale, theme);
			await checkViewControls(browser, width, locale, theme);
			console.log(`PASS ${width}px ${locale} ${theme}: Write focus, Wordlist targets, topic view controls`);
		}
		await checkWriting(browser, 1280, "en", "light", true);
		await checkWriting(browser, 320, "en", "light", false);
		await checkWriting(browser, 375, "vi", "dark", true, true);
		console.log("PASS touchscreen desktop, narrow mouse viewport, and topic Write route focus");
	} finally { await browser.close(); }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
