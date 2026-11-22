// Uses only mocked API responses and blocks requests outside the local server.
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const base = process.env.STUDYJONY_TEST_URL || "http://localhost:3000";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
const userId = "aaaaaaaaaaaaaaaaaaaaaaaa";

async function run(browser, { course, dialogue, id, answer, locale, guest = false, delayed = false, delayReview = false, fail = false, mismatch = false }) {
	const context = await browser.newContext();
	const page = await context.newPage();
	const t = require(`../../../messages/${locale}.json`).DialogueFeature;
	let release, requested;
	const held = new Promise((resolve) => { release = resolve; });
	const requestSeen = new Promise((resolve) => { requested = resolve; });
	let patches = 0;
	await context.route("**/*", async (route) => {
		const url = new URL(route.request().url());
		if (url.origin !== new URL(base).origin) return route.abort();
		if (!url.pathname.startsWith("/api/")) return route.continue();
		if (url.pathname.endsWith("/users/me")) return guest
			? route.fulfill({ status: 401, json: { status: "fail" } })
			: route.fulfill({ json: { status: "success", data: { user: { _id: userId, name: "Test", language: locale } } } });
		if (url.pathname === `/api/v1/dialogue-progress/${course}`) {
			requested();
			if (delayed || delayReview) await held;
			if (fail) return route.fulfill({ status: 503, json: { status: "fail" } });
			return route.fulfill({ json: { status: "success", data: { progress: [{ user: mismatch ? "bbbbbbbbbbbbbbbbbbbbbbbb" : userId, lessonId: course, dialogueId: dialogue, completedTaskIds: [id] }] } } });
		}
		if (route.request().method() === "PATCH") patches++;
		return route.fulfill({ json: { status: "success", data: { progress: [], vocabularies: [], topics: [], activities: [] } } });
	});
	try {
		await page.goto(`${base}${locale === "en" ? "/en" : ""}/dialogue/${course}/${dialogue}/${id}`, { waitUntil: "domcontentloaded", timeout: 90000 });
		const input = page.locator('input[placeholder="..."]').first();
		await input.waitFor();
		if (delayReview) {
			await requestSeen;
			await page.waitForTimeout(300);
			assert.equal(await input.evaluate((node) => document.activeElement === node), false);
			release();
		}
		if (delayed) { await requestSeen; await input.fill("my unfinished answer"); release(); }
		if (!guest && !delayed && !fail && !mismatch) {
			await page.getByText(t.completedCorrectAnswers, { exact: true }).waitFor();
			await page.reload({ waitUntil: "domcontentloaded" });
			await page.getByText(t.completedCorrectAnswers, { exact: true }).waitFor();
			assert.equal(await input.inputValue(), answer);
			assert.equal(await input.getAttribute("readonly"), "");
			assert.equal(await input.getAttribute("tabindex"), "-1");
			assert.equal(await input.evaluate((node) => document.activeElement === node), false);
			const style = await input.evaluate((node) => ({ cursor: getComputedStyle(node).cursor, border: getComputedStyle(node).borderBottomColor, caret: getComputedStyle(node).caretColor }));
			assert.equal(style.cursor, "default");
			assert.equal(style.border, "rgba(148, 163, 184, 0.55)");
			assert.equal(style.caret, "rgba(0, 0, 0, 0)");
			await input.click();
			assert.equal(await input.evaluate((node) => document.activeElement === node), false);
			assert.ok(await page.locator("audio[src]").count());
			assert.equal(await page.getByRole("button", { name: t.check, exact: true }).count(), 0);
			await page.getByRole("button", { name: t.grammar, exact: false }).click();
			assert.equal(await page.getByRole("button", { name: t.grammar, exact: false }).getAttribute("aria-expanded"), "true");
			await page.getByRole("link", { name: t.continue, exact: true }).click();
			await page.waitForURL((url) => !url.pathname.endsWith(`/${id}`));
		} else {
			await page.waitForTimeout(800);
			if (guest || fail || mismatch) assert.equal(await input.evaluate((node) => document.activeElement === node), true);
			assert.equal(await input.inputValue(), delayed ? "my unfinished answer" : "");
			assert.equal(await input.getAttribute("readonly"), null);
			assert.equal(await page.getByText(t.completedCorrectAnswers, { exact: true }).count(), 0);
		}
		assert.equal(patches, 0);
		console.log(`PASS ${course} ${locale} ${guest ? "guest" : delayed ? "typing while loading" : fail ? "progress failure" : mismatch ? "account mismatch" : "completed review and refresh"}`);
	} finally { release(); await context.close(); }
}

(async () => {
	const browser = await chromium.launch({ channel: "chrome", headless: true });
	try {
		const a2 = { course: "everyday-plans", dialogue: "making-plans-after-work", id: "14", answer: "am" };
		const a1 = { course: "asking-for-directions", dialogue: "finding-a-cafe", id: "6", answer: "straight ahead" };
		await run(browser, { ...a2, locale: "en" });
		await run(browser, { ...a2, locale: "en", delayReview: true });
		await run(browser, { ...a2, locale: "vi" });
		await run(browser, { ...a2, locale: "vi", delayed: true });
		await run(browser, { ...a2, locale: "en", fail: true });
		await run(browser, { ...a2, locale: "en", guest: true });
		await run(browser, { ...a2, locale: "en", mismatch: true });
		await run(browser, { ...a1, locale: "en" });
	} finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
