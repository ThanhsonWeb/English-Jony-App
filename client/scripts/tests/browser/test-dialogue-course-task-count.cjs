// Course summary remains factual, compact, and localized without the starter panel.
const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const baseURL = process.env.STUDYJONY_TEST_URL || "http://localhost:3000";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname));
const expectedSummary = { vi: "4 hội thoại", en: "4 dialogues" };

async function checkCourse(browser, locale, width) {
	const prefix = locale === "en" ? "/en" : "";
	const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: width < 768, hasTouch: width < 768 });
	await context.addCookies([{ name: "sj_guest_language", value: locale, url: baseURL }]);
	await context.route("**/*", route => new URL(route.request().url()).origin === new URL(baseURL).origin
		? route.continue() : route.fulfill({ body: "" }));
	await context.route("**/api/v1/**", route => {
		const path = new URL(route.request().url()).pathname;
		if (path.endsWith("/users/me")) return route.fulfill({ status: 401, json: { status: "fail" } });
		return route.fulfill({ json: { status: "success", data: { progress: [] } } });
	});
	const page = await context.newPage();
	try {
		const session = page.waitForResponse(response => new URL(response.url()).pathname.endsWith("/users/me"));
		await page.goto(`${baseURL}${prefix}/dialogue/asking-for-directions`, { waitUntil: "domcontentloaded" });
		await session;
		const count = page.getByText(expectedSummary[locale], { exact: true });
		await count.waitFor({ state: "visible" });
		assert.equal(await count.count(), 1, "The four-dialogue summary appears once");
		assert.equal(await page.getByText(/~\s*\d+\s*(min|minutes|phút)/i).count(), 0, "No unsupported duration is shown");
		assert.equal(await page.getByText(/\b100\s+(practice tasks|bài luyện tập)\b/i).count(), 0, "No extra course-wide task total competes with the dialogue count");
		assert.equal(await page.getByTestId("beginner-starter-overview").count(), 0, "Starter panel is removed");
		assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "Summary fits the viewport width");
		console.log(`PASS ${locale} ${width}px: one ${expectedSummary[locale]} summary, no duration or starter panel`);
	} finally {
		await context.close();
	}
}

(async () => {
	const browser = await chromium.launch({ channel: "chrome", headless: true });
	try {
		for (const locale of ["vi", "en"]) for (const width of [390, 1280]) await checkCourse(browser, locale, width);
	} finally {
		await browser.close();
	}
})().catch(error => { console.error(error); process.exitCode = 1; });
