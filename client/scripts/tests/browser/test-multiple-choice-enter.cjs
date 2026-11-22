const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const rules = require("../../../../server/data/dialogueTaskRules.json");
const { createHash } = require("node:crypto");
const base = process.env.STUDYJONY_TEST_URL || "http://localhost:3000";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname));

(async () => {
	const browser = await chromium.launch({ channel: "chrome", headless: true });
	try {
		for (const ids of [["asking-for-directions", "finding-a-cafe", "2"], ["everyday-plans", "making-plans-after-work", "3"]]) {
			const context = await browser.newContext();
			const page = await context.newPage();
			let writes = 0, payload, completed = false;
			await context.route("**/*", (route) => {
				const url = new URL(route.request().url());
				if (url.origin !== new URL(base).origin) return route.abort();
				if (!url.pathname.startsWith("/api/")) return route.continue();
				if (url.pathname.endsWith("/users/me")) return route.fulfill({ json: { status: "success", data: { user: { _id: "aaaaaaaaaaaaaaaaaaaaaaaa", name: "Test", language: "en" } } } });
				if (url.pathname.endsWith("/attempt")) return route.fulfill({ json: { status: "success", data: { attemptId: createHash("sha256").update(url.pathname).digest("hex"), expiresAt: new Date(Date.now() + 600000).toISOString(), readyAfterMs: 0 } } });
				if (url.pathname === `/api/v1/dialogue-progress/${ids[0]}`) return route.fulfill({ json: { status: "success", data: { progress: completed ? [{ user: "aaaaaaaaaaaaaaaaaaaaaaaa", lessonId: ids[0], dialogueId: ids[1], completedTaskIds: [ids[2]] }] : [] } } });
				if (route.request().method() === "PATCH") {
					writes++;
					payload = route.request().postDataJSON();
					return route.fulfill({ json: { status: "success", data: { progress: { user: "aaaaaaaaaaaaaaaaaaaaaaaa", lessonId: ids[0], dialogueId: ids[1], completedTaskIds: [ids[2]] } } } });
				}
				return route.fulfill({ json: { status: "success", data: { progress: [], vocabularies: [], topics: [], activities: [] } } });
			});
			try {
				const rule = rules.find((item) => item.ids.join("/") === ids.join("/"));
				await page.goto(`${base}/en/dialogue/${ids.join("/")}`, { waitUntil: "domcontentloaded", timeout: 90000 });
				const options = page.locator("div.mt-6.overflow-hidden button");
				await options.nth(2).click();
				await options.nth(0).click();
				assert.match(await options.nth(0).getAttribute("class"), /bg-violet-500\/10/);
				await page.getByRole("button", { name: "Check", exact: true }).waitFor({ state: "visible" });
				await page.waitForFunction(() => [...document.querySelectorAll("button")].some((button) => button.textContent.trim() === "Check" && !button.disabled));
				await page.keyboard.press("Enter");
				if (rule.answers[0] !== 0) {
					await page.getByText("Not quite.", { exact: true }).waitFor();
					assert.match(await options.nth(0).getAttribute("class"), /bg-violet-500\/10/);
					assert.doesNotMatch(await options.nth(2).getAttribute("class"), /bg-violet-500\/10/);
					assert.equal(writes, 0);
					await options.nth(rule.answers[0]).focus();
					await page.keyboard.press("Space");
					await page.getByRole("button", { name: "Check", exact: true }).focus();
					await page.keyboard.press("Enter");
				}
				await page.getByText("Correct!", { exact: true }).waitFor();
				await page.getByRole("button", { name: "Continue", exact: true }).waitFor();
				await page.waitForFunction(() => [...document.querySelectorAll("button")].some((button) => button.textContent.trim() === "Continue" && !button.disabled));
				await page.getByRole("button", { name: "Continue", exact: true }).focus();
				await page.keyboard.press("Enter");
				await page.waitForURL((url) => !url.pathname.endsWith(`/${ids[2]}`));
				assert.equal(writes, 1);
				assert.equal(payload.optionIndex, rule.answers[0]);
				completed = true;
				await page.goto(`${base}/en/dialogue/${ids.join("/")}`, { waitUntil: "domcontentloaded" });
				await page.getByText("Completed exercise — the correct answer is shown above.", { exact: true }).waitFor();
				assert.equal(await options.nth(rule.answers[0]).isDisabled(), true);
				assert.match(await options.nth(rule.answers[0]).getAttribute("class"), /bg-emerald-500/);
				await page.getByRole("link", { name: "Continue", exact: true }).focus();
				await page.keyboard.press("Enter");
				await page.waitForURL((url) => !url.pathname.endsWith(`/${ids[2]}`));
				assert.equal(writes, 1);
				console.log(`PASS ${ids.join("/")}: wrong, mouse reselect, Enter check and Continue`);
			} finally { await context.close(); }
		}
	} finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
