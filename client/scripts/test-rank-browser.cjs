// Run with Playwright available: node scripts/test-rank-browser.cjs
// Uses the local Next dev server and controlled API responses; no database writes.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const path = require("node:path");
const os = require("node:os");

async function run() {
	const browser = await chromium.launch({ channel: "chrome", headless: true });
	try {
		for (const width of [1440, 390]) {
			const page = await browser.newPage({ viewport: { width, height: 1000 } });
			const errors = [];
			page.on("pageerror", error => errors.push(error.message));
			let mode = "normal";
			const requests = [];
			const person = (rank, self = false) => ({
				id: self ? "self" : `user-${rank}`, rank, name: self ? "Current Learner" : `Learner ${rank}`,
				avatar: "", periodXp: rank === null ? 0 : 1200 - rank * 10, lifetimeXp: 9876, isCurrentUser: self,
				level: 5, currentLevelXp: 8876, nextLevelXp: null, progressPercent: 100,
				streakDays: self ? 2 : 0, completedWeekdays: [false, false, true, true, false, false, false],
			});
			await page.route("**/api/v1/**", async route => {
				const url = new URL(route.request().url());
				if (url.pathname !== "/api/v1/leaderboard") return route.fulfill({ status: 401, json: { status: "fail" } });
				requests.push(Object.fromEntries(url.searchParams));
				const selectedMode = mode;
				if (selectedMode === "slow") await new Promise(resolve => setTimeout(resolve, 700));
				if (selectedMode === "error" || selectedMode === "auth") return route.fulfill({ status: selectedMode === "auth" ? 401 : 500, json: { status: "fail" } });
				const currentUser = person(selectedMode === "empty" ? null : selectedMode === "podium" ? 1 : 42, true);
				if (selectedMode === "podium") Object.assign(currentUser, { lifetimeXp: 175, level: 2, currentLevelXp: 75, nextLevelXp: 150, progressPercent: 50 });
				const leaderboard = selectedMode === "empty" ? [] : Array.from({ length: selectedMode === "podium" ? 1 : 10 }, (_, i) => person(i + 1));
				if (selectedMode === "podium") leaderboard[0] = currentUser;
				await route.fulfill({ json: { status: "success", data: { leaderboard, currentUser } } });
			});
			const open = () => page.goto(`${process.env.RANK_TEST_URL || "http://localhost:3000"}/en/rank`);
			await open();
			await page.getByRole("cell", { name: "42", exact: true }).waitFor();
			assert.deepEqual(requests.at(-1), { period: "month", timeframe: "current", limit: "10" });
			assert.equal(await page.locator("article").count(), 3);
			assert.equal(await page.locator('tr[aria-current="true"]').count(), 1);
			assert.match(await page.locator('tr[aria-current="true"]').innerText(), /780 KN/);
			assert.match(await page.locator('tr[aria-current="true"]').innerText(), /2 days/);
			assert.equal(await page.getByRole("list", { name: "Study days this week" }).getByRole("listitem", { name: /: Studied$/ }).count(), 2);
			assert.equal(await page.getByText("9,876 KN", { exact: true }).count(), 1);
			assert.equal(await page.getByText("Lv. 5", { exact: true }).count(), 1);
			assert.equal(await page.getByRole("progressbar").getAttribute("value"), "100");
			assert.equal(await page.getByText("Max level", { exact: true }).count(), 1);
			await page.getByRole("button", { name: "Week", exact: true }).click();
			await page.getByRole("columnheader", { name: "Weekly KN" }).waitFor({ state: "attached" });
			await page.getByRole("cell", { name: "42", exact: true }).waitFor();
			assert.equal(requests.at(-1).period, "week");
			await page.getByRole("combobox", { name: "Choose ranking period" }).selectOption("previous");
			await page.getByRole("cell", { name: "42", exact: true }).waitFor();
			assert.equal(requests.at(-1).timeframe, "previous");
			await page.getByRole("button", { name: "Month", exact: true }).click();
			await page.getByRole("cell", { name: "42", exact: true }).waitFor();
			await page.getByRole("combobox", { name: "Choose ranking period" }).selectOption("previous");
			await page.getByRole("cell", { name: "42", exact: true }).waitFor();
			assert.deepEqual(requests.at(-1), { period: "month", timeframe: "previous", limit: "10" });
			assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
			await page.screenshot({ path: path.join(os.tmpdir(), `studyjony-rank-${width}.png`), fullPage: true });

			mode = "empty";
			await open();
			await page.getByText("No XP earned in this period yet.").waitFor();
			assert.equal(await page.getByText("Unranked", { exact: true }).count(), 1);
			assert.equal(await page.locator("article").count(), 0);
			assert.match(await page.locator('tr[aria-current="true"]').innerText(), /0 KN/);
			assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
			mode = "error";
			await open();
			await page.getByRole("alert").filter({ hasText: "Could not load" }).waitFor();
			mode = "podium";
			await page.getByRole("button", { name: "Try again" }).click();
			await page.getByRole("article", { name: "Rank 1: Current Learner" }).waitFor();
			assert.equal(await page.locator("article").count(), 1);
			assert.equal(await page.getByText("Lv. 2", { exact: true }).count(), 1);
			assert.equal(await page.getByText("75 / 150 KN", { exact: true }).count(), 1);
			assert.equal(await page.getByRole("progressbar").getAttribute("value"), "50");
			assert.equal(await page.locator('tr[aria-current="true"]').count(), 1);
			mode = "slow";
			await page.getByRole("button", { name: "Week", exact: true }).click();
			await page.getByRole("status").filter({ hasText: "Loading leaderboard" }).waitFor();
			mode = "empty";
			await page.getByRole("button", { name: "Month", exact: true }).click();
			await page.getByText("No XP earned in this period yet.").waitFor();
			await page.waitForTimeout(850);
			assert.equal(await page.locator("article").count(), 0, "stale response must not replace newer results");
			mode = "auth";
			await open();
			await page.getByText("Sign in to see the leaderboard.").waitFor();
			mode = "empty";
			await page.context().clearCookies();
			await page.setExtraHTTPHeaders({ "Accept-Language": "vi" });
			await page.goto(`${process.env.RANK_TEST_URL || "http://localhost:3000"}/rank`);
			await page.getByText("Chưa xếp hạng", { exact: true }).waitFor();
			assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
			await page.screenshot({ path: path.join(os.tmpdir(), `studyjony-rank-vi-${width}.png`), fullPage: true });
			assert.deepEqual(errors, []);
			console.log(`PASS ${width}px: filters, podium, own rank, empty/unranked, retry, loading, stale requests, auth, no overflow`);
			await page.close();
		}
	} finally {
		await browser.close();
	}
}
run().catch(error => { console.error(error); process.exitCode = 1; });
