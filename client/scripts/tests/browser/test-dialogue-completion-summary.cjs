// Final Dialogue completion feedback on the existing Useful Words page.
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const { chromium } = require("playwright");

const baseURL = process.env.STUDYJONY_TEST_URL || "http://localhost:3000";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname));
const userId = "aaaaaaaaaaaaaaaaaaaaaaaa";
const lessonId = "restaurant";
const dialogueId = "getting-a-table";
const finalTaskId = "25";
const allTaskIds = Array.from({ length: 25 }, (_, index) => String(index + 1));
const previouslyCompleted = allTaskIds.slice(0, -1);
const finalAnswers = ["How many", "for two", "reservation", "do not", "window", "quiet", "quiet area", "sounds good", "would like", "ready", "Thank you", "your meal"];
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

async function until(predicate, label) {
	const deadline = Date.now() + 20000;
	while (!predicate()) {
		assert.ok(Date.now() < deadline, `Timed out waiting for ${label}`);
		await pause(25);
	}
}

function contrastRatio(foreground, background) {
	const luminance = color => {
		const values = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(value => {
			const channel = value / 255;
			return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
		});
		return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
	};
	const first = luminance(foreground), second = luminance(background);
	return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

async function assertCompletionContrast(page) {
	const colors = await page.getByTestId("dialogue-completion-card").evaluate(card => ({
		background: getComputedStyle(card).backgroundColor,
		title: getComputedStyle(card.querySelector("[data-completion-title]")).color,
		body: getComputedStyle(card.querySelector("[data-completion-description]")).color,
	}));
	assert.ok(contrastRatio(colors.title, colors.background) >= 4.5, "Completion title meets normal-text contrast");
	assert.ok(contrastRatio(colors.body, colors.background) >= 4.5, "Completion description meets normal-text contrast");
}

async function fixture(browser, { locale, signedIn, outcome = "success", theme = "light" }) {
	const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
	const page = await context.newPage();
	const prefix = locale === "en" ? "/en" : "";
	const messages = require(`../../../messages/${locale}.json`).DialogueFeature;
	const taskIds = signedIn ? previouslyCompleted.slice() : [];
	let patchSeen = false;
	let releasePatch;
	const patchGate = new Promise(resolve => { releasePatch = resolve; });
	let holdPatch = outcome === "pending";
	await context.addCookies([{ name: "sj_guest_language", value: locale, url: baseURL }]);
	await context.addInitScript(themeName => localStorage.setItem("studyjony-theme", themeName), theme);
	await context.route("**/*", route => new URL(route.request().url()).origin === new URL(baseURL).origin
		? route.continue()
		: route.fulfill({ contentType: "application/javascript", body: "" }));
	await context.route("**/api/v1/**", async route => {
		const request = route.request();
		const path = new URL(request.url()).pathname;
		const json = data => route.fulfill({ json: { status: "success", data } });
		if (path.endsWith("/users/me")) return signedIn
			? json({ user: { _id: userId, name: "Completion tester", theme, language: locale } })
			: route.fulfill({ status: 401, json: { status: "fail" } });
		if (path === `/api/v1/dialogue-progress/${lessonId}`) {
			const progress = taskIds.length ? [{ lessonId, dialogueId, completedTaskIds: [...taskIds] }] : [];
			return json({ progress });
		}
		if (path === `/api/v1/vocab`) return json({ vocabularies: [] });
		if (path.endsWith("/attempt")) {
			return json({ attemptId: createHash("sha256").update(path).digest("hex"), expiresAt: new Date(Date.now() + 600000).toISOString(), readyAfterMs: 0 });
		}
		if (request.method() === "PATCH" && path.includes("/dialogue-progress/")) {
			patchSeen = true;
			if (holdPatch) await patchGate;
			if (outcome === "failed") return route.fulfill({ status: 403, json: { status: "fail" } });
			taskIds.push(finalTaskId);
			return json({ progress: { user: userId, lessonId, dialogueId, completedTaskIds: [...taskIds] }, xp: { awarded: 0, total: 100, reason: "already_awarded" } });
		}
		return json({ progress: [], vocabularies: [], topics: [], activities: [] });
	});
	return {
		context,
		page,
		prefix,
		messages,
		get patchSeen() { return patchSeen; },
		holdPatch() { holdPatch = true; },
		releasePatch() { holdPatch = false; releasePatch(); },
		async openFinalTask() {
			await page.goto(`${baseURL}${prefix}/dialogue/${lessonId}/${dialogueId}/${finalTaskId}`, { waitUntil: "domcontentloaded", timeout: 90000 });
			await page.getByRole("button", { name: messages.typeAnswer, exact: true }).click();
			const inputs = page.locator("[data-cloze-line] input");
			for (let index = 0; index < finalAnswers.length; index++) await inputs.nth(index).fill(finalAnswers[index]);
			await page.getByRole("button", { name: messages.check, exact: true }).click();
		},
		async close() { await context.close(); },
	};
}

async function guestCompletion(browser, locale) {
	const f = await fixture(browser, { locale, signedIn: false, theme: "light" });
	try {
		await f.openFinalTask();
		await f.page.waitForURL(url => url.pathname === `${f.prefix}/dialogue/${lessonId}/${dialogueId}/useful-words` && url.searchParams.get("completed") === "1");
		await f.page.getByText(f.messages.dialogueCompletionGuest, { exact: true }).waitFor();
		assert.equal(await f.page.locator("html").getAttribute("data-theme"), "light", "Completion message respects Light Mode");
		await assertCompletionContrast(f.page);
		const completionArt = f.page.locator('[data-testid="dialogue-completion-card"] img');
		const imageSource = await completionArt.getAttribute("src");
		assert.equal(new URL(imageSource, baseURL).searchParams.get("url") || imageSource, "/dialogue-completion-boy-cat.png");
		assert.equal(await completionArt.getAttribute("alt"), "", "Celebration art is decorative for screen readers");
		assert.equal(await f.page.getByText(f.messages.dialogueCompletionSaved.replace("{completed}", "25").replace("{total}", "25"), { exact: true }).count(), 0, "Guests do not see unsaved task counts");
		assert.equal(f.patchSeen, false, "Guest completion does not save progress");
		assert.ok(await f.page.getByRole("button", { name: f.messages.continueWithoutSaving, exact: true }).isVisible(), "Existing guest continue action remains available");
		assert.ok(await f.page.getByRole("button", { name: f.messages.skip, exact: true }).isVisible(), "Existing guest skip action remains available");
		await f.page.getByRole("button", { name: f.messages.skip, exact: true }).click();
		await f.page.waitForURL(url => url.pathname === `${f.prefix}/dialogue/${lessonId}`);
		console.log(`PASS ${locale} guest completion message and existing Useful Words actions`);
	} finally { await f.close(); }
}

async function confirmedCompletion(browser, locale, theme) {
	const f = await fixture(browser, { locale, signedIn: true, outcome: "pending", theme });
	try {
		await f.openFinalTask();
		await f.page.waitForURL(url => url.pathname === `${f.prefix}/dialogue/${lessonId}/${dialogueId}/useful-words`);
		assert.equal(await f.page.getByText(f.messages.dialogueCompletionTitle, { exact: true }).count(), 0, "Pending final save must not show completion");
		assert.equal(f.patchSeen, true, "Final completion reached the progress API");
		f.releasePatch();
		await f.page.getByText(f.messages.dialogueCompletionTitle, { exact: true }).waitFor();
		assert.equal(await f.page.locator("html").getAttribute("data-theme"), theme, `Completion message respects ${theme} mode`);
		await assertCompletionContrast(f.page);
		const expectedCount = f.messages.dialogueCompletionSaved.replace("{completed}", "25").replace("{total}", "25");
		await f.page.getByText(expectedCount, { exact: true }).waitFor();
		assert.equal(await f.page.getByRole("button", { name: f.messages.skip, exact: true }).count(), 1, "Existing skip action remains present after confirmation");
		const unsavedWordCount = await f.page.locator("button[aria-pressed]").count();
		const saveWordsLabel = f.messages.saveWords.replace("{count}", String(unsavedWordCount));
		const saveWordsButton = f.page.getByRole("button", { name: saveWordsLabel, exact: true });
		assert.ok(await saveWordsButton.isVisible(), "Existing vocabulary save action remains available");
		assert.equal(await f.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "Completion banner fits the mobile viewport");
		await saveWordsButton.click();
		await f.page.getByText(f.messages.savedWords.replace("{count}", String(unsavedWordCount)), { exact: true }).waitFor();
		await f.page.getByRole("button", { name: f.messages.continue, exact: true }).waitFor();
		await f.page.getByRole("link", { name: /^(Next:|Tiếp theo:)/ }).waitFor();
		await assertCompletionContrast(f.page);
		console.log(`PASS ${locale} signed-in ${theme} completion waits for confirmed final save and shows 25/25`);
	} finally { f.releasePatch(); await f.close(); }
}

async function failedSave(browser) {
	const f = await fixture(browser, { locale: "en", signedIn: true, outcome: "failed", theme: "dark" });
	try {
		await f.openFinalTask();
		await f.page.waitForURL(url => url.pathname === `${f.prefix}/dialogue/${lessonId}/${dialogueId}/useful-words`);
		await f.page.getByRole("alert").filter({ hasText: f.messages.progressSaveFailed }).waitFor();
		assert.equal(await f.page.getByText(f.messages.dialogueCompletionTitle, { exact: true }).count(), 0, "Failed save must not show completion");
		console.log("PASS failed final save does not show completion");
	} finally { f.releasePatch(); await f.close(); }
}

async function directVisit(browser, locale, signedIn) {
	const f = await fixture(browser, { locale, signedIn, theme: "dark" });
	try {
		await f.page.goto(`${baseURL}${f.prefix}/dialogue/${lessonId}/${dialogueId}/useful-words`, { waitUntil: "domcontentloaded", timeout: 90000 });
		await f.page.getByRole("heading", { name: f.messages.usefulWordsTitle, exact: true }).waitFor();
		assert.equal(await f.page.getByText(f.messages.dialogueCompletionTitle, { exact: true }).count(), 0, "Direct visit does not claim a just-completed lesson");
		console.log(`PASS ${locale} ${signedIn ? "signed-in" : "guest"} direct visit has no completion claim`);
	} finally { await f.close(); }
}

(async () => {
	const browser = await chromium.launch({ channel: "chrome", headless: true });
	try {
		for (const locale of ["vi", "en"]) {
			await guestCompletion(browser, locale);
			await confirmedCompletion(browser, locale, locale === "vi" ? "light" : "dark");
			await directVisit(browser, locale, false);
			await directVisit(browser, locale, true);
		}
		await failedSave(browser);
	} finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
