// Run against an isolated local test account and backend only.
const assert = require("node:assert/strict");
const { chromium } = require("playwright");

async function main() {
	const base = new URL(process.env.STUDYJONY_TEST_URL || "http://localhost:3100");
	if (!["localhost", "127.0.0.1"].includes(base.hostname) || base.protocol !== "http:") throw new Error("Local test URL required");
	const email = process.env.STUDYJONY_TEST_EMAIL;
	const password = process.env.STUDYJONY_TEST_PASSWORD;
	const imagePath = process.env.STUDYJONY_TEST_IMAGE;
	if (!email || !password || !imagePath) throw new Error("Local test credentials and image required");
	const browser = await chromium.launch({ headless: true, ...(process.env.STUDYJONY_TEST_BROWSER ? { executablePath: process.env.STUDYJONY_TEST_BROWSER } : {}) });
	try {
		const page = await browser.newPage();
		await page.goto(`${base.origin}/login`);
		await page.locator("#login-email").fill(email);
		await page.locator("#login-password").fill(password);
		await page.locator("form").evaluate(form => form.requestSubmit());
		await page.waitForURL(url => !url.pathname.includes("/login"));
		await page.goto(`${base.origin}/profile`);
		await page.locator('input[type="file"] + button:not(:disabled)').waitFor();
		let requests = 0;
		await page.route("**/api/v1/users/avatar", route => { requests++; return route.fulfill({ status: 500, body: "{}" }); });
		await page.evaluate(() => {
			const original = HTMLCanvasElement.prototype.toBlob;
			HTMLCanvasElement.prototype.toBlob = function (callback, ...args) {
				original.call(this, blob => { window.releaseAvatarEncoding = () => callback(blob); }, ...args);
			};
		});
		const input = page.locator('input[type="file"]');
		const dialog = page.getByRole("dialog");
		await input.setInputFiles(imagePath);
		await dialog.locator("button").last().click();
		await page.waitForFunction(() => window.releaseAvatarEncoding);
		await dialog.locator("button").first().click();
		await dialog.waitFor({ state: "hidden" });
		await page.evaluate(() => window.releaseAvatarEncoding());
		await page.waitForTimeout(250);
		assert.equal(requests, 0, "cancelled encoding must not upload");
		await page.evaluate(() => { delete window.releaseAvatarEncoding; });
		await input.setInputFiles(imagePath);
		const save = dialog.locator("button").last();
		await page.waitForFunction(() => { const button = document.querySelector('[aria-labelledby="avatar-crop-title"] button:last-child'); return button && !button.disabled; });
		await save.evaluate(button => { button.click(); button.click(); });
		await page.waitForFunction(() => window.releaseAvatarEncoding);
		const response = page.waitForResponse(result => result.url().includes("/users/avatar") && result.request().method() === "PATCH");
		await page.evaluate(() => window.releaseAvatarEncoding());
		await response;
		assert.equal(requests, 1, "duplicate save must send at most one upload");
		console.log("Avatar encoding cancellation and duplicate-save regression passed");
	} finally { await browser.close(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
