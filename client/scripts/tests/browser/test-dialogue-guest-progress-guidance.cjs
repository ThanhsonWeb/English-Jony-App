// Guest progress guidance across languages, themes, and common screen sizes.
const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const baseURL = process.env.STUDYJONY_TEST_URL || "http://localhost:3000";
const lessonId = "coffee-shop";
const userId = "aaaaaaaaaaaaaaaaaaaaaaaa";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname));

async function run(browser, { locale, theme, width, signedIn }) {
	const t = require(`../../../messages/${locale}.json`).DialogueFeature;
	const prefix = locale === "en" ? "/en" : "";
	const context = await browser.newContext({
		viewport: { width, height: 900 },
		isMobile: width < 768,
		hasTouch: width < 768,
		colorScheme: theme,
	});
	await context.addCookies([{ name: "sj_guest_language", value: locale, url: baseURL }]);
	await context.addInitScript(savedTheme => {
		localStorage.setItem("studyjony-theme", savedTheme);
	}, theme);
	let progressRequests = 0;
	const page = await context.newPage();
	const pageErrors = [];
	page.on("pageerror", error => pageErrors.push(error.message));
	await context.route("**/api/v1/**", route => {
		const request = route.request();
		const path = new URL(request.url()).pathname;
		if (path.endsWith("/users/me")) {
			return signedIn
				? route.fulfill({ json: { status: "success", data: { user: { _id: userId, name: "Progress guidance tester", theme, language: locale } } } })
				: route.fulfill({ status: 401, json: { status: "fail" } });
		}
		if (request.method() === "GET" && path.startsWith("/api/v1/dialogue-progress/")) {
			progressRequests++;
			return route.fulfill({ json: { status: "success", data: { progress: [] } } });
		}
		return route.fulfill({ json: { status: "success", data: { progress: [], vocabularies: [], topics: [], activities: [] } } });
	});

	try {
		await page.goto(`${baseURL}${prefix}/dialogue/${lessonId}`, { waitUntil: "domcontentloaded", timeout: 90000 });
		await page.waitForFunction(expected => document.documentElement.dataset.theme === expected, theme);
		const guestGuidance = page.getByRole("note").filter({ hasText: t.guestProgressNotSaved });
		if (signedIn) {
			await page.getByText("0%", { exact: true }).waitFor();
			assert.equal(await guestGuidance.count(), 0, "Signed-in learners do not see guest-only guidance");
			assert.ok(progressRequests > 0, "Signed-in progress is fetched normally");
		} else {
			await guestGuidance.waitFor();
			assert.equal(await page.getByText("0%", { exact: true }).count(), 0, "Guests must not see an assumed saved-progress percentage");
			assert.equal(progressRequests, 0, "Guest sessions do not request saved account progress");
		}
		assert.equal(await page.locator("html").getAttribute("data-theme"), theme);
		assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "Lesson layout fits the viewport");
		await page.locator('button[aria-expanded="false"]').filter({ hasText: /^1/ }).first().click();
		await page.locator(`a[href="${prefix}/dialogue/${lessonId}/ordering-a-coffee/1"]`).waitFor();
		assert.deepEqual(pageErrors, []);
		console.log(`PASS ${locale} ${theme} ${width}px ${signedIn ? "signed-in" : "guest"}: guidance visibility, theme, layout, and practice link`);
	} finally {
		await context.close();
	}
}

(async () => {
	const browser = await chromium.launch({ channel: "chrome", headless: true });
	try {
		for (const locale of ["vi", "en"]) {
			for (const theme of ["light", "dark"]) {
				for (const width of [390, 1280]) {
					for (const signedIn of [false, true]) await run(browser, { locale, theme, width, signedIn });
				}
			}
		}
	} finally {
		await browser.close();
	}
})().catch(error => { console.error(error); process.exitCode = 1; });
