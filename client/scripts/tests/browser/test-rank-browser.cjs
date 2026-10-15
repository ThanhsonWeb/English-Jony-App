// Run with Playwright available: node scripts/tests/browser/test-rank-browser.cjs
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
			let profileMode = "normal";
			const profileRequests = [];
			const requests = [];
			const person = (rank, self = false) => ({
				id: self ? "self" : `user-${rank}`, rank, name: self ? "Current Learner" : `Learner ${rank}`,
				avatar: "", periodXp: rank === null ? 0 : 1200 - rank * 10, lifetimeXp: 27500, isCurrentUser: self,
				level: 20, currentLevelXp: 0, nextLevelXp: null, nextLevelTotalXp: null, xpToNextLevel: null, progressPercent: 100,
				streakDays: self ? 2 : 0, completedWeekdays: [false, false, true, true, false, false, false],
			});
			await page.route("**/api/v1/**", async route => {
				const url = new URL(route.request().url());
				if (url.pathname.startsWith("/api/v1/leaderboard/users/")) {
					const id = url.pathname.split("/").at(-1);
					profileRequests.push(id);
					if (profileMode === "slow") await new Promise(resolve => setTimeout(resolve, 1000));
					if (profileMode === "error") return route.fulfill({ status: 500, json: { status: "fail" } });
					return route.fulfill({ json: { status: "success", data: { profile: {
						id, name: `Learner ${id.split("-").at(-1)}`, avatar: "", level: 5,
						monthlyRank: 7, monthlyXp: 456, streakDays: 3,
						email: "never-show@example.com", password: "never-show",
					} } } });
				}
				if (url.pathname !== "/api/v1/leaderboard") return route.fulfill({ status: 401, json: { status: "fail" } });
				requests.push(Object.fromEntries(url.searchParams));
				const selectedMode = mode;
				if (selectedMode === "slow") await new Promise(resolve => setTimeout(resolve, 700));
				if (selectedMode === "error" || selectedMode === "auth") return route.fulfill({ status: selectedMode === "auth" ? 401 : 500, json: { status: "fail" } });
				const currentUser = person(selectedMode === "empty" ? null : selectedMode === "podium" ? 1 : 42, true);
				if (selectedMode === "podium") Object.assign(currentUser, { lifetimeXp: 1422, level: 5, currentLevelXp: 22, nextLevelXp: 600, nextLevelTotalXp: 2000, xpToNextLevel: 578, progressPercent: 22 / 600 * 100 });
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
			assert.equal(await page.getByText("27,500 KN", { exact: true }).count(), 1);
			assert.equal(await page.getByRole("region", { name: "Level" }).getByText("Lv. 20", { exact: true }).count(), 1);
			assert.equal(await page.getByRole("progressbar").getAttribute("value"), "100");
			assert.equal(await page.getByText("Max level", { exact: true }).count(), 1);
			assert.equal(await page.getByRole("button", { name: "View Current Learner's profile" }).count(), 0);
			profileMode = "slow";
			await page.getByRole("button", { name: "View Learner 2's profile" }).first().click();
			const profileDialog = page.getByRole("dialog", { name: "Learner 2" });
			await profileDialog.waitFor();
			await profileDialog.getByRole("status").filter({ hasText: "Loading profile" }).waitFor();
			await profileDialog.getByText("Monthly rank").waitFor();
			assert.match(await profileDialog.innerText(), /Lv\. 5/);
			assert.match(await profileDialog.innerText(), /#7/);
			assert.match(await profileDialog.innerText(), /456 KN/);
			assert.match(await profileDialog.innerText(), /3 days/);
			assert.doesNotMatch(await profileDialog.innerText(), /never-show|@example.com/);
			assert.equal(profileRequests.at(-1), "user-2");
			const bounds = await profileDialog.evaluate(element => {
				const rect = element.getBoundingClientRect();
				return { centerX: rect.left + rect.width / 2, centerY: rect.top + rect.height / 2, bottom: rect.bottom };
			});
			if (width < 640) assert.ok(Math.abs(bounds.bottom - 1000) < 2, "Mobile profile is a bottom sheet");
			else assert.ok(Math.abs(bounds.centerX - width / 2) < 2 && Math.abs(bounds.centerY - 500) < 2, "Desktop profile is centered");
			await page.keyboard.press("Escape");
			assert.equal(await page.getByRole("dialog").count(), 0);
			profileMode = "error";
			await page.getByRole("row", { name: /Learner 4/ }).getByRole("button", { name: "View Learner 4's profile" }).click();
			await page.getByRole("dialog").getByRole("alert").waitFor();
			profileMode = "normal";
			await page.getByRole("dialog").getByRole("button", { name: "Try again" }).click();
			await page.getByRole("dialog").getByText("Monthly rank").waitFor();
			await page.mouse.click(5, 5);
			assert.equal(await page.getByRole("dialog").count(), 0, "Outside click closes profile");
			await page.getByRole("button", { name: "View Learner 3's profile" }).first().click();
			await page.getByRole("dialog").getByRole("button", { name: "Close profile" }).click();
			assert.equal(await page.getByRole("dialog").count(), 0, "X closes profile");
			await page.getByRole("button", { name: "Week", exact: true }).click();
			await page.getByRole("columnheader", { name: "Weekly KN" }).waitFor({ state: "attached" });
			await page.getByRole("cell", { name: "42", exact: true }).waitFor();
			assert.equal(requests.at(-1).period, "week");
			await page.getByRole("button", { name: "View Learner 2's profile" }).first().click();
			await page.getByRole("dialog").getByText("456 KN").waitFor();
			assert.equal(profileRequests.at(-1), "user-2", "Weekly view still fetches current-month profile");
			await page.keyboard.press("Escape");
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
			assert.equal(await page.getByRole("region", { name: "Level" }).getByText("Lv. 5", { exact: true }).count(), 1);
			assert.equal(await page.getByText("22 / 600 KN", { exact: true }).count(), 1);
			assert.equal(await page.getByRole("progressbar").getAttribute("value"), String(22 / 600 * 100));
			assert.equal(await page.locator('tr[aria-current="true"]').count(), 1);
			mode = "slow";
			await page.getByRole("button", { name: "Week", exact: true }).click();
			await page.getByRole("status").filter({ hasText: "Loading leaderboard" }).waitFor();
			await page.getByRole("button", { name: "Month", exact: true }).click();
			await page.getByRole("article", { name: "Rank 1: Current Learner" }).waitFor();
			await page.waitForTimeout(850);
			assert.equal(await page.locator("article").count(), 1, "stale response must not replace the cached month");
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
