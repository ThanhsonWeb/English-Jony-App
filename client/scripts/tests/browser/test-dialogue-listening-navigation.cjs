// Listening-to-practice navigation in Vietnamese and English.
const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const baseURL = process.env.STUDYJONY_TEST_URL || "http://localhost:3000";
const lessonId = "restaurant";
const dialogueId = "getting-a-table";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname));

async function run(browser, locale, signedIn) {
	const t = require(`../../../messages/${locale}.json`).DialogueFeature;
	const prefix = locale === "en" ? "/en" : "";
	const expectedPath = `${prefix}/dialogue/${lessonId}/${dialogueId}/1`;
	const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
	const progressWrites = [];
	let sessionReads = 0;
	await context.addCookies([{ name: "sj_guest_language", value: locale, url: baseURL }]);
	await context.addInitScript(() => {
		HTMLMediaElement.prototype.play = function() {
			this.dispatchEvent(new Event("play"));
			return Promise.resolve();
		};
		HTMLMediaElement.prototype.pause = function() {};
	});
	await context.route("**/api/v1/**", route => {
		const request = route.request();
		const path = new URL(request.url()).pathname;
		if (path.endsWith("/users/me")) {
			sessionReads++;
			return signedIn
				? route.fulfill({ json: { status: "success", data: { user: { _id: "aaaaaaaaaaaaaaaaaaaaaaaa", name: "Navigation tester", theme: "dark", language: locale } } } })
				: route.fulfill({ status: 401, json: { status: "fail" } });
		}
		if (path.includes("/dialogue-progress/") && request.method() === "PATCH") progressWrites.push(path);
		return route.fulfill({ json: { status: "success", data: { progress: [], vocabularies: [], topics: [], activities: [] } } });
	});
	const page = await context.newPage();
	const pageErrors = [];
	page.on("pageerror", error => pageErrors.push(error.message));
	try {
		await page.goto(`${baseURL}${prefix}/dialogue/${lessonId}/${dialogueId}`, { waitUntil: "domcontentloaded" });
		const continueLink = page.getByRole("link", { name: t.continueToPractice, exact: true });
		await continueLink.waitFor();
		assert.ok(sessionReads > 0, "The guest or signed-in session was checked");
		assert.equal(await page.getByText(t.watchedDialogue, { exact: true }).count(), 0, "Watched checkbox/toggle is removed");
		assert.equal(new URL(await continueLink.getAttribute("href"), baseURL).pathname, expectedPath, "CTA points to the first practice task");
		await continueLink.click();
		await page.waitForURL(url => url.pathname === expectedPath);
		assert.deepEqual(progressWrites, [], "Listening navigation does not write progress or award XP");
		assert.deepEqual(pageErrors, []);
		console.log(`PASS ${locale} ${signedIn ? "signed-in" : "guest"}: localized CTA opens task 1 without saving listening progress`);
	} finally {
		await context.close();
	}
}

(async () => {
	const browser = await chromium.launch({ channel: "chrome", headless: true });
	try {
		for (const locale of ["vi", "en"]) {
			for (const signedIn of [false, true]) await run(browser, locale, signedIn);
		}
	} finally {
		await browser.close();
	}
})().catch(error => { console.error(error); process.exitCode = 1; });
