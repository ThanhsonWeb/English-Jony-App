// Keep the global Feedback launcher clear of mobile Sign-up and Dialogue overview controls.
const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const baseURL = process.env.STUDYJONY_TEST_URL || "http://localhost:3000";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname));

function documentRect(element) {
	return element.evaluate(node => {
		const rect = node.getBoundingClientRect();
		return { x: rect.left + scrollX, y: rect.top + scrollY, width: rect.width, height: rect.height };
	});
}

function overlaps(a, b) {
	return a.x < b.x + b.width && a.x + a.width > b.x &&
		a.y < b.y + b.height && a.y + a.height > b.y;
}

async function tapCenter(page, locator, width) {
	await locator.scrollIntoViewIfNeeded();
	const rect = await locator.boundingBox();
	const x = rect.x + rect.width / 2;
	const y = rect.y + rect.height / 2;
	if (width < 768) await page.touchscreen.tap(x, y);
	else await page.mouse.click(x, y);
}

async function fixture(browser, locale, theme, width) {
	const prefix = locale === "en" ? "/en" : "";
	const messages = require(`../../../messages/${locale}.json`);
	const context = await browser.newContext({
		viewport: { width, height: 844 },
		isMobile: width < 768,
		hasTouch: width < 768,
	});
	await context.addInitScript(selectedTheme => localStorage.setItem("studyjony-theme", selectedTheme), theme);
	const apiRequests = [];
	await context.route("**/*", route => new URL(route.request().url()).origin === new URL(baseURL).origin
		? route.continue()
		: route.fulfill({ status: 200, contentType: "application/javascript", body: "" }));
	await context.route("**/api/v1/**", async route => {
		const request = route.request();
		const path = new URL(request.url()).pathname;
		apiRequests.push({ path, method: request.method() });
		if (path.endsWith("/users/me")) return route.fulfill({ status: 401, json: { status: "fail", data: { user: null } } });
		if (path.endsWith("/auth/credentials/signup")) return route.fulfill({
			status: 400,
			json: { status: "fail", message: "Mocked test response" },
		});
		return route.fulfill({ json: { status: "success", data: { progress: [], vocabularies: [], topics: [], activities: [] } } });
	});
	const page = await context.newPage();
	page.setDefaultTimeout(15000);
	const errors = [];
	page.on("pageerror", error => errors.push(error.message));
	return { context, page, prefix, messages, apiRequests, errors };
}

async function checkFeedback(page, messages, width) {
	const button = page.getByRole("button", { name: messages.Feedback.button, exact: true });
	await button.waitFor({ state: "visible" });
	assert.equal(await button.getAttribute("aria-haspopup"), "dialog");
	assert.equal(await button.getAttribute("aria-expanded"), "false");
	assert.ok(parseFloat(await button.evaluate(node => getComputedStyle(node).minHeight)) >= 44);
	const position = await button.evaluate(node => getComputedStyle(node).position);
	assert.equal(position, width < 768 ? "relative" : "fixed", "mobile flows after content; desktop remains floating");
	if (width < 768) {
		await button.scrollIntoViewIfNeeded();
		const bounds = await button.boundingBox();
		assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= 844, "feedback launcher remains reachable after scrolling");
	}
	await button.focus();
	await page.keyboard.press("Enter");
	const dialog = page.getByRole("dialog", { name: messages.Feedback.title });
	await dialog.waitFor();
	assert.equal(await button.getAttribute("aria-expanded"), "true");
	await page.keyboard.press("Escape");
	await dialog.waitFor({ state: "detached" });
	assert.equal(await button.getAttribute("aria-expanded"), "false");
}

async function signup(browser, locale, theme, width) {
	const f = await fixture(browser, locale, theme, width);
	try {
		await f.page.goto(`${baseURL}${f.prefix}/signup`, { waitUntil: "domcontentloaded", timeout: 90000 });
		await f.page.waitForFunction(expected => document.documentElement.dataset.theme === expected, theme);
		const submit = f.page.locator('form button[type="submit"]');
		await submit.waitFor({ state: "visible" });
		const feedback = f.page.getByRole("button", { name: f.messages.Feedback.button, exact: true });
		const submitRect = await documentRect(submit);
		const feedbackRect = await documentRect(feedback);
		if (width < 768) assert.equal(overlaps(submitRect, feedbackRect), false, `${locale} ${theme} ${width}px: feedback does not cover Sign-up submit`);

		await f.page.locator("#signup-name").fill("Mobile UX tester");
		await f.page.locator("#signup-email").fill("mobile-ux@example.test");
		await f.page.locator("#signup-password").fill("safe-test-password");
		await f.page.locator("#signup-password-confirm").fill("safe-test-password");
		await tapCenter(f.page, submit, width);
		await f.page.getByRole("alert").waitFor();
		assert.equal(f.apiRequests.filter(item => item.path.endsWith("/auth/credentials/signup") && item.method === "POST").length, 1,
			"the Sign-up button submits only to the intercepted mock");
		await checkFeedback(f.page, f.messages, width);
		assert.deepEqual(f.errors, []);
		console.log(`PASS Sign-up ${locale} ${theme} ${width}px: submit and Feedback are reachable without overlap`);
	} finally {
		await f.context.close();
	}
}

async function dialogueOverview(browser, locale, theme, width) {
	const f = await fixture(browser, locale, theme, width);
	try {
		await f.page.goto(`${baseURL}${f.prefix}/dialogue/coffee-shop`, { waitUntil: "domcontentloaded", timeout: 90000 });
		await f.page.waitForFunction(expected => document.documentElement.dataset.theme === expected, theme);
		const heading = f.page.getByRole("heading", { name: f.messages.DialogueFeature.dialoguesHeading, exact: true });
		const section = f.page.locator("section").filter({ has: heading });
		const rows = section.locator('button[aria-expanded]');
		await rows.first().waitFor({ state: "visible" });
		const row = rows.nth(2);
		await row.scrollIntoViewIfNeeded();
		const rowRect = await documentRect(row);
		const feedback = f.page.getByRole("button", { name: f.messages.Feedback.button, exact: true });
		const feedbackRect = await documentRect(feedback);
		if (width < 768) assert.equal(overlaps(rowRect, feedbackRect), false, `${locale} ${theme} ${width}px: feedback does not cover Dialogue cards`);
		assert.equal(await row.getAttribute("aria-expanded"), "false");
		await tapCenter(f.page, row, width);
		await row.waitFor({ state: "visible" });
		assert.equal(await row.getAttribute("aria-expanded"), "true", "Dialogue card expands by touch/pointer");
		await checkFeedback(f.page, f.messages, width);
		assert.deepEqual(f.errors, []);
		console.log(`PASS Dialogue overview ${locale} ${theme} ${width}px: card expand and Feedback are reachable without overlap`);
	} finally {
		await f.context.close();
	}
}

(async () => {
	const browser = await chromium.launch({ channel: "chrome", headless: true });
	try {
		for (const locale of ["vi", "en"])
			for (const theme of ["light", "dark"])
				for (const width of [390, 1280]) {
					await signup(browser, locale, theme, width);
					await dialogueOverview(browser, locale, theme, width);
				}
	} finally {
		await browser.close();
	}
})().catch(error => { console.error(error); process.exitCode = 1; });
