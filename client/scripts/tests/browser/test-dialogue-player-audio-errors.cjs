// Dialogue Listening Player audio failure feedback with mocked media and APIs.
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const baseURL = process.env.STUDYJONY_TEST_URL || "http://localhost:3000";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname));

async function run(browser, locale) {
	const t = require(`../../../messages/${locale}.json`).DialogueFeature;
	const prefix = locale === "en" ? "/en" : "";
	const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
	await context.addCookies([{ name: "sj_guest_language", value: locale, url: baseURL }]);
	await context.addInitScript(() => {
		window.audioFailureTest = { rejectNext: true, holdNext: false, playCalls: 0 };
		HTMLMediaElement.prototype.play = function() {
			const test = window.audioFailureTest;
			test.playCalls++;
			if (test.rejectNext) {
				test.rejectNext = false;
				return Promise.reject(new DOMException("Playback denied", "NotAllowedError"));
			}
			if (test.holdNext) {
				test.holdNext = false;
				return new Promise(() => {});
			}
			this.dispatchEvent(new Event("play"));
			return Promise.resolve();
		};
	});
	await context.route("**/api/v1/**", route => {
		const path = new URL(route.request().url()).pathname;
		if (path.endsWith("/users/me")) return route.fulfill({ status: 401, json: { status: "fail" } });
		return route.fulfill({ json: { status: "success", data: { progress: [], vocabularies: [], topics: [], activities: [] } } });
	});
	const page = await context.newPage();
	page.setDefaultTimeout(20000);
	const pageErrors = [];
	page.on("pageerror", error => pageErrors.push(error.message));
	try {
		await page.goto(`${baseURL}${prefix}/dialogue/restaurant/getting-a-table`, { waitUntil: "domcontentloaded" });
		const transcript = page.getByRole("button", { name: t.transcript, exact: true });
		assert.equal(await transcript.getAttribute("aria-expanded"), "false", `${locale}: Transcript starts closed`);
		assert.equal(await transcript.getAttribute("aria-controls"), "dialogue-transcript-panel");
		assert.equal(await page.locator("#dialogue-transcript-panel").getAttribute("hidden"), "");
		const alert = page.getByRole("alert").filter({ hasText: t.dialogueAudioPlaybackFailed });
		await page.getByRole("button", { name: t.play, exact: true }).click();
		await alert.getByText(t.dialogueAudioPlaybackFailed, { exact: true }).waitFor();
		await page.getByRole("button", { name: t.play, exact: true }).waitFor();
		assert.equal(await page.getByRole("button", { name: t.pause, exact: true }).count(), 0, "Rejected playback resets the control to Play");

		await page.getByRole("button", { name: t.play, exact: true }).click();
		await page.getByRole("button", { name: t.pause, exact: true }).waitFor();
		await alert.waitFor({ state: "detached" });

		await page.locator("audio").evaluate(audio => audio.dispatchEvent(new Event("error")));
		await alert.getByText(t.dialogueAudioPlaybackFailed, { exact: true }).waitFor();
		await page.getByRole("button", { name: t.play, exact: true }).waitFor();
		await page.getByRole("button", { name: t.play, exact: true }).click();
		await page.getByRole("button", { name: t.pause, exact: true }).waitFor();
		await alert.waitFor({ state: "detached" });

		await page.locator("audio").evaluate(audio => audio.dispatchEvent(new Event("error")));
		await alert.waitFor();
		await transcript.click();
		assert.equal(await transcript.getAttribute("aria-expanded"), "true", `${locale}: Transcript reports open`);
		assert.equal(await page.locator("#dialogue-transcript-panel").getAttribute("hidden"), null);
		await page.locator("button.w-full.rounded-lg.p-3").nth(1).waitFor();
		await page.evaluate(() => { window.audioFailureTest.holdNext = true; });
		await page.locator("button.w-full.rounded-lg.p-3").nth(1).click();
		await page.getByText("A table for two, please.", { exact: true }).first().waitFor();
		assert.equal(await alert.count(), 0, "Selecting another line clears the old error before playback resolves");
		await transcript.click();
		assert.equal(await transcript.getAttribute("aria-expanded"), "false", `${locale}: Transcript reports closed`);
		assert.equal(await page.locator("#dialogue-transcript-panel").getAttribute("hidden"), "");
		assert.deepEqual(pageErrors, []);
		console.log(`PASS ${locale}: rejected play, media error, Play retry, line-change reset, accessible alert`);
	} finally {
		await context.close();
	}
}

(async () => {
	const browser = await chromium.launch({ channel: "chrome", headless: true });
	try {
		for (const locale of ["vi", "en"]) await run(browser, locale);
	} finally {
		await browser.close();
	}
})().catch(error => { console.error(error); process.exitCode = 1; });
