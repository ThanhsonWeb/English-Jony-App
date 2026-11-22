// Local-only browser test: APIs are mocked and the R2 outage is simulated.
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const base = process.env.STUDYJONY_TEST_URL || "http://127.0.0.1:3147";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
const r2Host = "pub-a0c593a050834420b5faa3e260029a02.r2.dev";

(async () => {
	const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--autoplay-policy=no-user-gesture-required"] });
	try {
		for (const [course, lesson, task] of [["everyday-plans", "making-plans-after-work", "2"], ["everyday-plans", "making-plans-after-work", "3"], ["asking-for-directions", "finding-a-cafe", "2"]]) {
			const context = await browser.newContext();
			let remoteFailures = 0;
			await context.route("**/*", route => {
				const url = new URL(route.request().url());
				if (url.hostname === r2Host) { remoteFailures++; return route.abort(); }
				if (url.origin !== new URL(base).origin) return route.abort();
				if (url.pathname.startsWith("/api/")) return route.fulfill({ status: 401, json: { status: "fail" } });
				return route.continue();
			});
			try {
				const page = await context.newPage();
				await page.goto(`${base}/en/dialogue/${course}/${lesson}/${task}`, { waitUntil: "domcontentloaded", timeout: 90000 });
				const audio = page.locator("audio[src]");
				await audio.waitFor({ state: "attached" });
				await page.getByRole("button", { name: "Play audio", exact: true }).click();
				await page.waitForFunction(() => document.querySelector("audio")?.currentTime > 0, null, { timeout: 15000 });
				const src = await audio.evaluate(node => node.src);
				assert.equal(new URL(src).origin, new URL(base).origin);
				assert.ok(src.includes(`/dialogue/${course}/${lesson}/audio/`));
				if (course === "everyday-plans") assert.ok(remoteFailures > 0, "R2 requests must have been blocked");
				console.log(`PASS ${course}/${task}: local audio plays${course === "everyday-plans" ? " after R2 failure" : ""}`);
			} finally { await context.close(); }
		}
	} finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
