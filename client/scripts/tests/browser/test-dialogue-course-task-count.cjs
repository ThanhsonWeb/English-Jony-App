// Course overview keeps the factual dialogue count without an unsupported duration.
const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const baseURL = process.env.STUDYJONY_TEST_URL || "http://localhost:3000";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname));
const courseRoute = "/dialogue/asking-for-directions";
const expectedSummary = {
	vi: "4 hội thoại",
	en: "4 dialogues",
};
const expectedStarterCount = { vi: "25 bài luyện tập", en: "25 practice tasks" };

async function checkCourse(browser, locale, width) {
	const prefix = locale === "en" ? "/en" : "";
	const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: width < 768, hasTouch: width < 768 });
	await context.addCookies([{ name: "sj_guest_language", value: locale, url: baseURL }]);
	await context.route("**/*", (route) => new URL(route.request().url()).origin === new URL(baseURL).origin
		? route.continue() : route.fulfill({ body: "" }));
	await context.route("**/api/v1/**", (route) => {
		const path = new URL(route.request().url()).pathname;
		if (path.endsWith("/users/me")) return route.fulfill({ status: 401, json: { status: "fail" } });
		return route.fulfill({ json: { status: "success", data: { progress: [] } } });
	});
	const page = await context.newPage();
	try {
		const session = page.waitForResponse((response) => new URL(response.url()).pathname.endsWith("/users/me"));
		await page.goto(`${baseURL}${prefix}${courseRoute}`, { waitUntil: "domcontentloaded" });
		await session;
		await page.getByText(expectedSummary[locale], { exact: true }).waitFor({ state: "visible" });
		assert.equal(await page.getByText(/~\s*\d+\s*(min|minutes|phút)/i).count(), 0, "No generated time estimate is displayed");
		assert.equal(await page.getByText(/\b100\s+(practice tasks|bài luyện tập)\b/i).count(), 0, "No intimidating course-wide task total is displayed");
		const starter = page.getByTestId("beginner-starter-overview");
		await starter.waitFor({ state: "visible" });
		assert.equal(await starter.getByTestId("beginner-starter-task-count").innerText(), expectedStarterCount[locale], "The first dialogue keeps its specific practice count");
		assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "Course overview fits the viewport width");
		console.log(`PASS ${locale} ${width}px: ${expectedSummary[locale]}, per-dialogue count retained, no duration estimate`);
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
})().catch((error) => { console.error(error); process.exitCode = 1; });
