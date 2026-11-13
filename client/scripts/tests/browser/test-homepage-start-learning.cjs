// Homepage Start learning selects the first A1 dialogue or returns to the catalogue for learners with progress.
const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const baseURL = process.env.STUDYJONY_TEST_URL || "http://localhost:3000";
const userId = "aaaaaaaaaaaaaaaaaaaaaaaa";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname));

async function fixture(browser, { locale, signedIn = false, completedTaskIds = [], delays = null }) {
	const prefix = locale === "en" ? "/en" : "";
	const messages = require(`../../../messages/${locale}.json`);
	const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
	await context.addCookies([{ name: "sj_guest_language", value: locale, url: baseURL }]);
	await context.route("**/*", route => new URL(route.request().url()).origin === new URL(baseURL).origin
		? route.continue() : route.fulfill({ body: "" }));
	await context.route("**/api/v1/**", async route => {
		const request = route.request();
		const path = new URL(request.url()).pathname;
		if (path.endsWith("/users/me")) return signedIn
			? route.fulfill({ json: { status: "success", data: { user: {
				_id: userId, name: "Onboarding tester", language: locale, theme: "dark",
			} } } })
			: route.fulfill({ status: 401, json: { status: "fail" } });
		if (request.method() === "GET" && path.startsWith("/api/v1/dialogue-progress/")) {
			const courseId = path.split("/").at(-1);
			if (delays) {
				delays.progressStarted();
				await delays.progress;
			}
			return route.fulfill({ json: { status: "success", data: { progress: courseId === "coffee-shop" && completedTaskIds.length
				? [{ dialogueId: "ordering-a-coffee", completedTaskIds, updatedAt: "2026-01-01T00:00:00.000Z" }]
				: [] } } });
		}
		return route.fulfill({ json: { status: "success", data: { progress: [], vocabularies: [], topics: [], activities: [] } } });
	});
	const page = await context.newPage();
	const browserErrors = [];
	page.on("pageerror", error => browserErrors.push(error.message));
	page.on("console", message => {
		if (message.type() === "error" && /hydration|did not match|server rendered html/i.test(message.text())) {
			browserErrors.push(message.text());
		}
	});
	return { context, page, prefix, messages, browserErrors };
}

function assertNoBrowserErrors(f) {
	assert.deepEqual(f.browserErrors, [], "No page errors or hydration warnings occurred");
}

function createDelay() {
	let release;
	let signal;
	const promise = new Promise(resolve => { release = resolve; });
	const started = new Promise(resolve => { signal = resolve; });
	return { promise, release, started, signal };
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
			await continueLink.click();
			await f.page.waitForURL(url => url.pathname === `${f.prefix}/dialogue/coffee-shop/ordering-a-coffee/2`);
		}
		assertNoBrowserErrors(f);
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
		await f.page.getByTestId("dialogue-catalogue").waitFor({ state: "visible" });
		assertNoBrowserErrors(f);
		console.log("PASS en: Explore dialogues remains on the catalogue");
	} finally { await f.context.close(); }
}

async function practicePreviewKeepsPracticeAccessible(browser, locale, signedIn = false) {
	const f = await fixture(browser, { locale, signedIn });
	try {
		await openHome(f);
		await f.page.getByRole("link", { name: f.messages.Home.startLearning, exact: true }).first().click();
		await f.page.waitForURL(url => url.pathname === `${f.prefix}/dialogue/asking-for-directions/finding-a-cafe`);

		const previewKey = signedIn ? "practicePreviewSignedIn" : "practicePreview";
		const preview = f.messages.DialogueFeature[previewKey].replace("{count}", "25");
		await f.page.getByRole("note").getByText(preview, { exact: true }).waitFor({ state: "visible" });
		await f.page.getByRole("link", { name: f.messages.DialogueFeature.continueToPractice, exact: true }).click();
		await f.page.waitForURL(url => url.pathname === `${f.prefix}/dialogue/asking-for-directions/finding-a-cafe/1`);
		assertNoBrowserErrors(f);
		console.log(`PASS ${locale} ${signedIn ? "signed-in" : "guest"}: practice preview shows 25 activities and continues directly`);
	} finally { await f.context.close(); }
}

async function delayedResponsesDoNotShowCatalogue(browser, locale) {
	const progress = createDelay();
	const f = await fixture(browser, {
		locale,
		signedIn: true,
		delays: {
			progress: progress.promise,
			progressStarted: progress.signal,
		},
	});
	try {
		await f.context.addInitScript(() => {
			window.__dialogueCatalogueObserved = false;
			const observeCatalogue = () => {
				new MutationObserver(records => {
					for (const record of records) {
						for (const node of record.addedNodes) {
							if (node.nodeType !== Node.ELEMENT_NODE) continue;
							if (node.matches('[data-testid="dialogue-catalogue"]') || node.querySelector('[data-testid="dialogue-catalogue"]')) {
								window.__dialogueCatalogueObserved = true;
								return;
							}
						}
					}
				}).observe(document.documentElement, { childList: true, subtree: true });
			};
			if (document.documentElement) observeCatalogue();
			else document.addEventListener("DOMContentLoaded", observeCatalogue, { once: true });
		});
		await openHome(f);
		await f.page.getByRole("link", { name: f.messages.Home.startLearning, exact: true }).first().click();
		await f.page.waitForURL(url => url.pathname === `${f.prefix}/dialogue` && url.searchParams.get("onboarding") === "start");
		await progress.started;
		await f.page.getByRole("status").waitFor({ state: "visible" });
		assert.equal(await f.page.getByTestId("dialogue-catalogue").count(), 0, `${locale}: catalogue stays hidden while progress is pending`);
		assert.equal(await f.page.evaluate(() => window.__dialogueCatalogueObserved), false, `${locale}: catalogue was never rendered before progress resolved`);

		progress.release();
		await f.page.waitForURL(url => url.pathname === `${f.prefix}/dialogue/asking-for-directions/finding-a-cafe`);
		assertNoBrowserErrors(f);
		console.log(`PASS ${locale}: delayed progress shows loading without catalogue flash`);
	} finally {
		progress.release();
		await f.context.close();
	}
}

(async () => {
	const browser = await chromium.launch({ channel: "chrome", headless: true });
	try {
		await startLearning(browser, "vi", false, [], "/dialogue/asking-for-directions/finding-a-cafe");
		await startLearning(browser, "en", true, [], "/dialogue/asking-for-directions/finding-a-cafe");
		await startLearning(browser, "en", true, ["1"], "/dialogue");
		await exploreRemainsCatalogue(browser);
		await practicePreviewKeepsPracticeAccessible(browser, "vi");
		await practicePreviewKeepsPracticeAccessible(browser, "en");
		await practicePreviewKeepsPracticeAccessible(browser, "en", true);
		await delayedResponsesDoNotShowCatalogue(browser, "vi");
		await delayedResponsesDoNotShowCatalogue(browser, "en");
	} finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
