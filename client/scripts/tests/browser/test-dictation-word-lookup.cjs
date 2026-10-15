const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const labels = require("../../../messages/en.json").DialogueFeature;

const baseURL = process.env.STUDYJONY_TEST_URL || "http://127.0.0.1:3000";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname));

(async () => {
	const browser = await chromium.launch({ channel: "chrome", headless: true });
	try {
		for (const width of [375, 1280]) {
			const context = await browser.newContext({ viewport: { width, height: 900 }, hasTouch: width < 640 });
			await context.addInitScript(() => {
				localStorage.setItem("studyjony-theme", "dark");
				window.audioPlays = 0;
				window.spokenWords = [];
				window.speechSynthesis.speak = utterance => window.spokenWords.push({ text: utterance.text, lang: utterance.lang });
				HTMLMediaElement.prototype.play = function () { window.audioPlays += 1; this.dispatchEvent(new Event("play")); return Promise.resolve(); };
			});
			await context.route("**/api/v1/**", route => {
				const path = new URL(route.request().url()).pathname;
				const data = path.endsWith("/users/me")
					? { user: { _id: "aaaaaaaaaaaaaaaaaaaaaaaa", name: "Tester", theme: "dark" } }
					: { progress: [], vocabularies: [], topics: [], activities: [] };
				return route.fulfill({ json: { status: "success", data } });
			});
			const page = await context.newPage();
			const errors = [];
			page.on("pageerror", error => errors.push(error.message));
			try {
				await page.goto(`${baseURL}/en/dialogue/naruto-season-1/the-lonely-boy/1`);
				await page.locator('[data-dictionary-token="true"]').first().waitFor();
				await page.waitForFunction(() => window.audioPlays === 1);
				assert.equal(await page.locator('input[placeholder="..."]').evaluate(input => input === document.activeElement), true);
				assert.equal(await page.locator('[data-dictionary-token="true"]').filter({ hasText: /^alone$/i }).count(), 0, "Hidden answer is not clickable");
				await page.locator('[data-dictionary-token="true"]').filter({ hasText: /^are$/i }).click();
				const popup = page.locator(".dialogue-word-popup");
				await popup.waitFor();
				assert.equal(await popup.locator("strong").textContent(), "are");
				assert.equal(await popup.locator("p.mt-2").textContent(), "là, ở");
				assert.equal(await popup.evaluate(element => {
					const bounds = element.getBoundingClientRect();
					return bounds.left >= 0 && bounds.right <= innerWidth + 1;
				}), true, "Popup stays in viewport");
				await page.keyboard.press("Escape");
				assert.equal(await popup.count(), 0);
				assert.equal(await page.locator('input[placeholder="..."]').count(), 1);
				assert.equal(await page.locator('input[placeholder="..."]').inputValue(), "");
				assert.equal(await page.evaluate(() => window.audioPlays), 1, "Word lookup does not replay audio");
				const leftWords = page.locator('.dialogue-subtitle-text [data-dictionary-token="true"]');
				assert.equal(await leftWords.first().isVisible(), false, "Subtitles stay hidden until enabled");
				await page.getByRole("button", { name: labels.toggleSubtitles }).click();
				await leftWords.filter({ hasText: /^alone$/i }).click();
				await popup.waitFor();
				assert.equal(await popup.locator("strong").textContent(), "alone");
				assert.equal(await popup.locator("p.mt-2").textContent(), "một mình");
				assert.equal(await page.locator('input[placeholder="..."]').locator("xpath=..").locator('[data-dictionary-token="true"]').filter({ hasText: /^alone$/i }).count(), 0, "Right-side blank stays hidden");
				await popup.getByRole("button", { name: labels.pronounceWord.replace("{word}", "alone") }).click();
				assert.deepEqual(await page.evaluate(() => window.spokenWords.at(-1)), { text: "alone", lang: "en-US" });
				await page.getByRole("button", { name: labels.toggleSubtitles }).click();
				assert.equal(await popup.count(), 0, "Hiding captions also hides the popup");
				await page.getByRole("button", { name: labels.toggleSubtitles }).click();
				assert.equal(await popup.count(), 0, "Old popup does not return with captions");
				assert.equal(await page.evaluate(() => window.audioPlays), 1, "Subtitle clicks do not replay audio");
				await page.goto(`${baseURL}/en/dialogue/naruto-season-1/the-lonely-boy/2`);
				await page.waitForFunction(() => window.audioPlays >= 1);
				await page.getByRole("button", { name: labels.toggleSubtitles }).click();
				await leftWords.filter({ hasText: /^talk$/i }).click();
				await popup.waitFor();
				assert.equal(await popup.locator("strong").textContent(), "talk to");
				assert.equal(await popup.locator("p.mt-2").textContent(), "nói chuyện với");
				await popup.locator('[data-dictionary-switch="true"]').click();
				assert.equal(await popup.locator("strong").textContent(), "talk");
				await page.goto(`${baseURL}/en/dialogue/asking-for-directions/finding-a-cafe/1`);
				await page.locator('[data-dictionary-token="true"]').filter({ hasText: /^Hi$/i }).first().click();
				await popup.waitFor();
				assert.equal((await popup.locator("strong").textContent()).toLowerCase(), "hi");
				assert.equal(await page.locator('[data-dictionary-token="true"]').filter({ hasText: /^find$/i }).count(), 0, "Dialogue blank stays hidden");
				await page.goto(`${baseURL}/en/dialogue/naruto-season-1/the-lonely-boy`);
				await page.getByRole("button", { name: "Transcript", exact: true }).click();
				await page.getByRole("button").filter({ has: page.locator("p.mt-1") }).first().click();
				await page.locator('.dialogue-subtitle-text [data-dictionary-token="true"]').filter({ hasText: /^are$/i }).click();
				await popup.waitFor();
				assert.equal(await popup.locator("p.mt-2").textContent(), "là, ở", "Listening keeps the shared popup");
				assert.deepEqual(errors, []);
				console.log(`PASS ${width}px: left subtitles, contextual word and phrase, pronunciation, hidden blanks, audio, and Listening popup`);
			} finally { await context.close(); }
		}
	} finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
