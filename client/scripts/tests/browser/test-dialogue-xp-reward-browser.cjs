// Browser checks for server-confirmed Dialogue XP feedback.
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const { chromium } = require("playwright");
const rules = require("../../../../server/data/dialogueTaskRules.json");
const baseURL = process.env.STUDYJONY_TEST_URL || "http://localhost:3000";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname));
const userId = "aaaaaaaaaaaaaaaaaaaaaaaa";
const ids = ["ten-minutes-a-day", "the-old-book", "1"];
const rule = rules.find(item => item.ids.join("/") === ids.join("/"));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

async function scenario(browser, locale, kind) {
	const t = require(`../../../messages/${locale}.json`).DialogueFeature;
	const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
	await context.addInitScript(() => localStorage.setItem("studyjony-theme", "dark"));
	await context.route("**/*", route => new URL(route.request().url()).origin === new URL(baseURL).origin
		? route.continue() : route.fulfill({ body: "" }));
	let saves = 0;
	await context.route("**/api/v1/**", async route => {
		const request = route.request(), path = new URL(request.url()).pathname;
		const json = data => route.fulfill({ json: { status: "success", data } });
		if (path === "/api/v1/users/me") return json({ user: { _id: userId, name: "XP tester", email: "test@example.test", theme: "dark", language: locale } });
		if (path.endsWith("/attempt")) return json({ attemptId: createHash("sha256").update(path).digest("hex"), expiresAt: new Date(Date.now() + 600000).toISOString(), readyAfterMs: 0 });
		if (request.method() === "PATCH" && path.includes("/dialogue-progress/")) {
			saves++;
			if (kind === "retry" && saves === 1) return route.fulfill({ status: 403, json: { status: "fail" } });
			const taskId = path.split("/").at(-1);
			const xp = kind === "duplicate" ? { awarded: 0, total: 10, reason: "already_completed" } : { awarded: 10, total: 10, reason: "awarded" };
			return json({ progress: { user: userId, lessonId: ids[0], dialogueId: ids[1], completedTaskIds: [taskId] }, xp });
		}
		return json({ progress: [], vocabularies: [], topics: [], activities: [] });
	});
	const page = await context.newPage(), errors = [];
	page.on("pageerror", error => errors.push(error.message));
	page.setDefaultTimeout(15000);
	try {
		const prefix = locale === "en" ? "/en" : "";
		await page.goto(`${baseURL}${prefix}/dialogue/${ids.join("/")}`, { waitUntil: "domcontentloaded" });
		const inputs = page.locator('input[placeholder="..."]');
		for (const [index, answer] of rule.answers.entries()) await inputs.nth(index).fill(answer);
		await page.getByRole("button", { name: t.check, exact: true }).click();
		if (kind === "retry") {
			await page.getByRole("button", { name: t.retryProgressSave, exact: true }).waitFor();
			assert.equal(await page.getByText(t.xpRewardEarned.replace("{amount}", "10"), { exact: true }).count(), 0, "Failed saves cannot show XP");
			await page.getByRole("button", { name: t.retryProgressSave, exact: true }).click();
		}
		if (kind === "award" || kind === "retry") {
			await page.getByRole("status").filter({ hasText: t.xpRewardEarned.replace("{amount}", "10") }).waitFor();
			assert.equal(saves, kind === "retry" ? 2 : 1);
		} else {
			await page.waitForFunction(() => Object.keys(localStorage).some(key => key.startsWith("studyjony-progress-v1:") && JSON.parse(localStorage.getItem(key)).status === "saved"));
			await pause(100);
			assert.equal(await page.getByText(t.xpRewardEarned.replace("{amount}", "10"), { exact: true }).count(), 0, "Duplicate completions cannot show XP");
		}
		assert.deepEqual(errors, []);
		console.log(`PASS ${locale} ${kind}: ${saves} save request(s)`);
	} finally { await context.close(); }
}

(async () => {
	const browser = await chromium.launch({ channel: "chrome", headless: true });
	try {
		for (const locale of ["vi", "en"]) for (const kind of ["award", "duplicate", "retry"]) await scenario(browser, locale, kind);
	} finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
