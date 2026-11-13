// Homepage Start learning selects the first A1 dialogue or returns to the catalogue for learners with progress.
const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const baseURL = process.env.STUDYJONY_TEST_URL || "http://localhost:3000";
const userId = "aaaaaaaaaaaaaaaaaaaaaaaa";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname));

async function fixture(browser, { locale, signedIn = false, completedTaskIds = [] }) {
	const prefix = locale === "en" ? "/en" : "";
	const messages = require(`../../../messages/${locale}.json`);
	const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
	await context.addCookies([{ name: "sj_guest_language", value: locale, url: baseURL }]);
	await context.route("**/*", route => new URL(route.request().url()).origin === new URL(baseURL).origin
		? route.continue() : route.fulfill({ body: "" }));
	await context.route("**/api/v1/**", route => {
		const request = route.request();
		const path = new URL(request.url()).pathname;
		if (path.endsWith("/users/me")) return signedIn
			? route.fulfill({ json: { status: "success", data: { user: {
				_id: userId, name: "Onboarding tester", language: locale, theme: "dark",
			} } } })
			: route.fulfill({ status: 401, json: { status: "fail" } });
		if (request.method() === "GET" && path.startsWith("/api/v1/dialogue-progress/")) {
			const courseId = path.split("/").at(-1);
			return route.fulfill({ json: { status: "success", data: { progress: courseId === "coffee-shop" && completedTaskIds.length
				? [{ dialogueId: "ordering-a-coffee", completedTaskIds, updatedAt: "2026-01-01T00:00:00.000Z" }]
				: [] } } });
		}
		return route.fulfill({ json: { status: "success", data: { progress: [], vocabularies: [], topics: [], activities: [] } } });
	});
	return { context, page: await context.newPage(), prefix, messages };
}

async function openHome(f) {
	await f.page.goto(`${baseURL}${f.prefix}`, { waitUntil: "domcontentloaded", timeout: 90000 });
}

async function startLearning(browser, locale, signedIn, completedTaskIds, expectedPath) {
	const f = await fixture(browser, { locale, signedIn, completedTaskIds });
	try {
		await openHome(f);
		const startLinks = f.page.getByRole("link", { name: f.messages.Home.startLearning, exact: true });
		await startLinks.first().waitFor({ state: "visible" });
		assert.equal(await startLinks.count(), 2, "Both homepage Start learning buttons use the onboarding route");
		for (const link of await startLinks.all()) {
			const url = new URL(await link.getAttribute("href"), baseURL);
			assert.equal(url.pathname, `${f.prefix}/dialogue`);
			assert.equal(url.searchParams.get("onboarding"), "start");
		}
		await startLinks.first().click();
		await f.page.waitForURL(url => url.pathname === `${f.prefix}${expectedPath}`);
		if (expectedPath === "/dialogue") {
			const continueLink = f.page.getByRole("link", { name: f.messages.DialogueLanding.continue, exact: true });
			await continueLink.waitFor({ state: "visible" });
			assert.equal(new URL(await continueLink.getAttribute("href"), baseURL).pathname,
				`${f.prefix}/dialogue/coffee-shop/ordering-a-coffee/2`);
		}
		console.log(`PASS ${locale} ${signedIn ? completedTaskIds.length ? "returning" : "zero-progress" : "guest"}: Start learning -> ${expectedPath}`);
	} finally { await f.context.close(); }
}

async function exploreRemainsCatalogue(browser) {
	const f = await fixture(browser, { locale: "en" });
	try {
		await openHome(f);
		await f.page.getByRole("link", { name: f.messages.Home.exploreDialogues, exact: true }).click();
		await f.page.waitForURL(url => url.pathname === "/en/dialogue");
		assert.equal(new URL(f.page.url()).searchParams.has("onboarding"), false);
		console.log("PASS en: Explore dialogues remains on the catalogue");
	} finally { await f.context.close(); }
}

(async () => {
	const browser = await chromium.launch({ channel: "chrome", headless: true });
	try {
		await startLearning(browser, "vi", false, [], "/dialogue/asking-for-directions/finding-a-cafe");
		await startLearning(browser, "en", true, [], "/dialogue/asking-for-directions/finding-a-cafe");
		await startLearning(browser, "en", true, ["1"], "/dialogue");
		await exploreRemainsCatalogue(browser);
	} finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
