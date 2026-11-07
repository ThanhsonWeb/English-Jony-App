// Guest reminder wording and navigation across locales and screen sizes.
const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const baseURL = process.env.STUDYJONY_TEST_URL || "http://localhost:3000";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname));
const exercise = "/dialogue/ten-minutes-a-day/the-old-book/1";
const copy = {
	vi: "Tiến độ học khi chưa đăng nhập sẽ không được lưu. Đăng nhập để lưu tiến độ học từ bây giờ.",
	en: "Progress made as a guest is not saved. Sign in to save your learning progress from now on.",
};

async function openReminder(browser, locale, width) {
	const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: width < 768, hasTouch: width < 768 });
	await context.addCookies([{ name: "sj_guest_language", value: locale, url: baseURL }]);
	await context.route("**/*", (route) => new URL(route.request().url()).origin === new URL(baseURL).origin
		? route.continue() : route.fulfill({ body: "" }));
	let progressWrites = 0;
	await context.route("**/api/v1/**", (route) => {
		const request = route.request();
		const path = new URL(request.url()).pathname;
		if (path.endsWith("/users/me")) return route.fulfill({ status: 401, json: { status: "fail" } });
		if (path.includes("dialogue-progress") && request.method() !== "GET") progressWrites++;
		return route.fulfill({ json: { status: "success", data: {} } });
	});
	const page = await context.newPage();
	page.setDefaultTimeout(20000);
	const errors = [];
	page.on("pageerror", (error) => errors.push(error.message));
	const prefix = locale === "en" ? "/en" : "";
	const session = page.waitForResponse((response) => new URL(response.url()).pathname.endsWith("/users/me"));
	await page.goto(`${baseURL}${prefix}${exercise}`);
	await session;
	const input = page.locator('input[placeholder="..."]').first();
	await input.waitFor({ state: "visible" });
	await input.fill("book");
	await input.press("Enter");
	const reminder = page.locator('[role="status"][aria-labelledby="guest-progress-title"]');
	await reminder.waitFor({ state: "visible" });
	return { context, page, reminder, errors, prefix, getProgressWrites: () => progressWrites };
}

async function checkCase(browser, locale, width) {
	const t = require(`../../../messages/${locale}.json`).DialogueFeature;
	let f = await openReminder(browser, locale, width);
	try {
		assert.equal(await f.reminder.locator("#guest-progress-description").innerText(), copy[locale]);
		assert.equal(await f.reminder.getAttribute("aria-describedby"), "guest-progress-description");
		assert.equal(f.getProgressWrites(), 0, "Guests do not save progress or earn a server reward");
		const login = f.reminder.getByRole("link", { name: t.signIn, exact: true });
		await login.click();
		await f.page.waitForURL((url) => url.pathname === `${f.prefix}/login`);
		assert.equal(new URL(f.page.url()).searchParams.get("returnTo"), exercise);
		const signup = f.page.locator('a[href*="/signup"]');
		await signup.waitFor({ state: "visible" });
		assert.equal(new URL(await signup.getAttribute("href"), baseURL).searchParams.get("returnTo"), exercise);
		await signup.click();
		await f.page.waitForURL((url) => url.pathname === `${f.prefix}/signup`);
		assert.equal(new URL(f.page.url()).searchParams.get("returnTo"), exercise);
		assert.deepEqual(f.errors, []);
	} finally { await f.context.close(); }

	f = await openReminder(browser, locale, width);
	try {
		await f.reminder.getByRole("button", { name: t.guestLater, exact: true }).click();
		await f.page.waitForURL((url) => url.pathname === `${f.prefix}/dialogue/ten-minutes-a-day/the-old-book/2`);
		assert.equal(f.getProgressWrites(), 0);
		assert.deepEqual(f.errors, []);
	} finally { await f.context.close(); }
	console.log(`PASS ${locale} ${width}px: reminder copy, sign-in/sign-up return path, and Later`);
}

(async () => {
	const browser = await chromium.launch({ channel: "chrome", headless: true });
	try {
		for (const locale of ["vi", "en"]) for (const width of [390, 1280]) await checkCase(browser, locale, width);
	} finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
