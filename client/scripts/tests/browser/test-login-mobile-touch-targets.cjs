// Check localized Login controls and touch targets without submitting credentials.
const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const baseURL = process.env.STUDYJONY_TEST_URL || "http://localhost:3000";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname));

function hitArea(element, pseudo = "::after") {
	return element.evaluate((node, pseudoElement) => {
		const rect = node.getBoundingClientRect();
		const style = getComputedStyle(node, pseudoElement);
		const width = parseFloat(style.width);
		const height = parseFloat(style.height);
		const centerX = rect.left + rect.width / 2;
		const centerY = rect.top + rect.height / 2;
		return { x: centerX - width / 2, y: centerY - height / 2, width, height };
	}, pseudo);
}

function overlaps(a, b) {
	return a.x < b.x + b.width && a.x + a.width > b.x &&
		a.y < b.y + b.height && a.y + a.height > b.y;
}

async function activateAt(page, area, mobile) {
	if (mobile) await page.touchscreen.tap(area.x + 1, area.y + 1);
	else await page.mouse.click(area.x + 1, area.y + 1);
}

async function run(browser, locale, theme, width) {
	const prefix = locale === "en" ? "/en" : "";
	const messages = require(`../../../messages/${locale}.json`).Auth;
	const context = await browser.newContext({
		viewport: { width, height: 844 },
		isMobile: width < 768,
		hasTouch: width < 768,
	});
	await context.addInitScript(value => localStorage.setItem("studyjony-theme", value), theme);
	await context.route("**/api/v1/**", route => {
		const path = new URL(route.request().url()).pathname;
		if (path.endsWith("/users/me")) return route.fulfill({ status: 401, json: { status: "fail", data: { user: null } } });
		return route.fulfill({ json: { status: "success", data: {} } });
	});
	const page = await context.newPage();
	page.setDefaultTimeout(15000);
	const errors = [];
	page.on("pageerror", error => errors.push(error.message));
	try {
		await page.goto(`${baseURL}${prefix}/login`, { waitUntil: "domcontentloaded", timeout: 90000 });
		await page.waitForFunction(value => document.documentElement.dataset.theme === value, theme);
		await page.getByRole("heading", { name: messages.login, exact: true }).waitFor();

		const close = page.getByRole("link", { name: messages.close, exact: true });
		const email = page.getByRole("textbox", { name: messages.email, exact: true });
		const password = page.getByLabel(messages.password, { exact: true });
		const showPassword = page.getByRole("button", { name: messages.showPassword, exact: true });
		const eye = page.locator("button[aria-pressed]");
		const signup = page.getByRole("link", { name: messages.signup, exact: true });
		for (const control of [close, showPassword, signup]) assert.equal(await control.count(), 1, `${locale}: labeled control exists`);

		const closeHitArea = await hitArea(close);
		const signupHitArea = await hitArea(signup);
		const eyeBounds = await eye.boundingBox();
		const eyeHitArea = { x: eyeBounds.x, y: eyeBounds.y, width: eyeBounds.width, height: eyeBounds.height };
		for (const [name, area] of [["close", closeHitArea], ["password visibility", eyeHitArea], ["sign-up", signupHitArea]]) {
			assert.ok(area.width >= 44 && area.height >= 44, `${locale} ${width}px ${name} hit area is at least 44x44: ${area.width}x${area.height}`);
		}
		assert.ok(!overlaps(closeHitArea, eyeHitArea) && !overlaps(closeHitArea, signupHitArea) && !overlaps(eyeHitArea, signupHitArea), "Login touch targets do not overlap");
		assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "No horizontal overflow");

		const visibleSizes = await page.evaluate(() => ({
			close: getComputedStyle(document.querySelector('a[aria-label]')).fontSize,
			eye: getComputedStyle(document.querySelector('#login-password + button svg')).width,
			signup: getComputedStyle(document.querySelector('a[href$="/signup"]')).fontSize,
		}));
		assert.equal(visibleSizes.close, "24px", "Close icon text size is unchanged");
		assert.equal(visibleSizes.eye, "20px", "Password eye icon size is unchanged");
		assert.equal(visibleSizes.signup, "14px", "Sign-up text size is unchanged");

		await email.focus();
		await page.keyboard.press("Tab");
		assert.equal(await password.evaluate(node => node === document.activeElement), true, "Tab reaches the password field");
		await page.keyboard.press("Tab");
		assert.equal(await eye.evaluate(node => node === document.activeElement), true, "Tab reaches password visibility toggle");
		await page.keyboard.press("Space");
		assert.equal(await password.getAttribute("type"), "text", "Space toggles password visibility");
		assert.equal(await eye.getAttribute("aria-pressed"), "true");
		assert.equal(await page.getByRole("button", { name: messages.hidePassword, exact: true }).count(), 1);
		await page.keyboard.press("Space");
		assert.equal(await password.getAttribute("type"), "password", "Space toggles password back to hidden");
		assert.equal(await eye.getAttribute("aria-pressed"), "false");
		assert.equal(await page.getByRole("button", { name: messages.showPassword, exact: true }).count(), 1);
		await eye.click({ position: { x: 1, y: 1 } });
		assert.equal(await password.getAttribute("type"), "text", "Password toggle remains pointer-clickable");

		await signup.focus();
		await page.keyboard.press("Enter");
		await page.waitForURL(url => url.pathname === `${prefix}/signup`);
		await page.goto(`${baseURL}${prefix}/login`, { waitUntil: "domcontentloaded" });
		await page.waitForFunction(value => document.documentElement.dataset.theme === value, theme);
		const signupAgain = page.getByRole("link", { name: messages.signup, exact: true });
		const pointerSignupPoint = await hitArea(signupAgain);
		await activateAt(page, pointerSignupPoint, width < 768);
		await page.waitForURL(url => url.pathname === `${prefix}/signup`);
		await page.goto(`${baseURL}${prefix}/login`, { waitUntil: "domcontentloaded" });
		await page.waitForFunction(value => document.documentElement.dataset.theme === value, theme);
		const closeAgain = page.getByRole("link", { name: messages.close, exact: true });
		const closePoint = await hitArea(closeAgain);
		await activateAt(page, closePoint, width < 768);
		await page.waitForURL(url => url.pathname === (prefix || "/"));

		await page.goto(`${baseURL}${prefix}/login`, { waitUntil: "domcontentloaded" });
		await page.waitForFunction(value => document.documentElement.dataset.theme === value, theme);
		const keyboardClose = page.getByRole("link", { name: messages.close, exact: true });
		await keyboardClose.focus();
		await page.keyboard.press("Enter");
		await page.waitForURL(url => url.pathname === (prefix || "/"));
		assert.deepEqual(errors, []);
		console.log(`PASS ${locale} ${theme} ${width}px: close ${closeHitArea.width}x${closeHitArea.height}px, password ${eyeHitArea.width}x${eyeHitArea.height}px, sign-up ${signupHitArea.width}x${signupHitArea.height}px; pointer and keyboard access`);
	} finally {
		await context.close();
	}
}

(async () => {
	const browser = await chromium.launch({ channel: "chrome", headless: true });
	try {
		for (const locale of ["vi", "en"])
			for (const theme of ["light", "dark"])
				for (const width of [390, 1280]) await run(browser, locale, theme, width);
	} finally {
		await browser.close();
	}
})().catch(error => { console.error(error); process.exitCode = 1; });
