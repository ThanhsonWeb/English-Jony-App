// Local browser regression checks; APIs and media are mocked. No real account writes.
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const rules = require("../../../../server/data/dialogueTaskRules.json");
const t = require("../../../messages/en.json").DialogueFeature;
const baseURL = process.env.STUDYJONY_TEST_URL || "http://localhost:3000";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname));
const reminderKey = "studyjony-guest-progress-reminder-dismissed";
const userId = "aaaaaaaaaaaaaaaaaaaaaaaa";

async function fixture(browser, signedIn = false, width = 1280) {
	const context = await browser.newContext({ viewport: { width, height: 900 } });
	await context.addInitScript(() => {
		localStorage.setItem("studyjony-theme", "dark");
		HTMLMediaElement.prototype.play = function() { return Promise.resolve(); };
		HTMLMediaElement.prototype.pause = function() {};
		window.taskNavigations = [];
		const push = history.pushState.bind(history);
		history.pushState = function(state, unused, url) {
			window.taskNavigations.push(new URL(url, location.href).pathname);
			return push(state, unused, url);
		};
	});
	const saves = [];
	await context.route("**/*", route => new URL(route.request().url()).origin === new URL(baseURL).origin
		? route.continue() : route.fulfill({ body: "" }));
	await context.route("**/api/v1/**", route => {
		const path = new URL(route.request().url()).pathname;
		if (path.endsWith("/users/me")) return route.fulfill({ status: signedIn ? 200 : 401,
			json: signedIn ? { status: "success", data: { user: { _id: userId, name: "Reminder tester", theme: "dark" } } } : { status: "fail" } });
		let data = { progress: [], vocabularies: [], topics: [], activities: [] };
		if (path.endsWith("/attempt")) data = { attemptId: "a".repeat(64), expiresAt: new Date(Date.now() + 600000).toISOString(), readyAfterMs: 0 };
		if (route.request().method() === "PATCH") {
			saves.push(path);
			const [, , , , lessonId, dialogueId] = path.split("/");
			data = { progress: { user: userId, lessonId, dialogueId, completedTaskIds: [path.split("/").at(-1)] } };
		}
		return route.fulfill({ json: { status: "success", data } });
	});
	const page = await context.newPage();
	const errors = [];
	page.on("pageerror", error => errors.push(error.message));
	const path = (ids, task) => `/en/dialogue/${ids.join("/")}/${task}`;
	async function answer(ids, task, wrong = false) {
		const rule = rules.find(rule => rule.ids.join("/") === [...ids, String(task)].join("/"));
		assert.equal(rule.type, "fillBlank");
		const inputs = page.locator('input[placeholder="..."]');
		for (const [index, value] of rule.answers.entries()) await inputs.nth(index).fill(wrong ? "wrong answer" : value);
		await inputs.last().press("Enter");
	}
	return { context, page, path, answer, saves, errors };
}

async function guestDismissal(browser, method, width) {
	const f = await fixture(browser, false, width);
	const ids = ["ten-minutes-a-day", "the-old-book"];
	const { page } = f;
	try {
		await page.goto(baseURL + f.path(ids, 1));
		await f.answer(ids, 1, true);
		await page.waitForTimeout(550);
		assert.equal(new URL(page.url()).pathname, f.path(ids, 1), "Wrong answers do not advance");
		assert.equal(await page.locator("#guest-progress-title").count(), 0);
		await f.answer(ids, 1);
		await page.locator("#guest-progress-title").waitFor();
		await page.keyboard.press("Enter");
		await page.waitForTimeout(900);
		assert.equal(new URL(page.url()).pathname, f.path(ids, 1), "Reminder must hold the first exercise past 400ms");
		assert.equal(await page.locator("#guest-progress-title").isVisible(), true);
		if (method === "later") await page.getByRole("button", { name: t.guestLater, exact: true }).click();
		else if (method === "close") await page.getByRole("button", { name: t.guestClose, exact: true }).click();
		else await page.keyboard.press("Escape");
		await page.waitForURL(url => url.pathname === f.path(ids, 2));
		await page.waitForTimeout(550);
		assert.equal(await page.locator("#guest-progress-title").count(), 0);
		assert.equal(await page.evaluate(key => sessionStorage.getItem(key), reminderKey), "true");
		assert.equal(await page.evaluate(path => window.taskNavigations.filter(url => url === path).length, f.path(ids, 2)), 1);
		await f.answer(ids, 2);
		await page.waitForTimeout(150);
		assert.equal(new URL(page.url()).pathname, f.path(ids, 2), "Later exercises retain the feedback delay");
		await page.waitForURL(url => url.pathname === f.path(ids, 3));
		assert.equal(await page.locator("#guest-progress-title").count(), 0, "Subsequent exercises auto-advance normally");
		await page.goto(baseURL + f.path(ids, 1));
		await f.answer(ids, 1);
		await page.waitForURL(url => url.pathname === f.path(ids, 2));
		assert.equal(await page.locator("#guest-progress-title").count(), 0, "Session flag survives route reload");
		assert.deepEqual(f.saves, [], "Guest progress is not submitted as signed-in progress");
		assert.deepEqual(f.errors, []);
		console.log(`PASS guest ${method} ${width}px: wrong answer, persistent reminder, single resume, later exercises and session reload`);
	} finally { await f.context.close(); }
}

async function loginNavigation(browser) {
	const f = await fixture(browser);
	const ids = ["ten-minutes-a-day", "the-old-book"];
	try {
		await f.page.goto(baseURL + f.path(ids, 1));
		await f.answer(ids, 1);
		await f.page.locator("#guest-progress-title").waitFor();
		await f.page.waitForTimeout(550);
		await f.page.locator('aside[aria-labelledby="guest-progress-title"]').getByRole("link", { name: t.signIn, exact: true }).click();
		await f.page.waitForURL(url => url.pathname === "/en/login");
		await f.page.waitForTimeout(700);
		assert.equal(new URL(f.page.url()).pathname, "/en/login", "Login cannot race an exercise auto-next");
		assert.equal(await f.page.evaluate(path => window.taskNavigations.includes(path), f.path(ids, 2)), false);
		await f.page.goto(baseURL + f.path(ids, 1));
		await f.answer(ids, 1);
		await f.page.waitForURL(url => url.pathname === f.path(ids, 2));
		assert.equal(await f.page.locator("#guest-progress-title").count(), 0, "Leaving for login counts as showing the reminder this session");
		assert.deepEqual(f.errors, []);
		console.log("PASS guest login: preserved login destination, no competing task navigation");
	} finally { await f.context.close(); }
}

async function earlyDismissal(browser) {
	const f = await fixture(browser);
	const ids = ["ten-minutes-a-day", "the-old-book"];
	try {
		await f.page.goto(baseURL + f.path(ids, 1));
		await f.answer(ids, 1);
		await f.page.getByRole("button", { name: t.guestClose, exact: true }).click();
		await f.page.waitForURL(url => url.pathname === f.path(ids, 2));
		await f.page.waitForTimeout(700);
		assert.equal(new URL(f.page.url()).pathname, f.path(ids, 2));
		assert.equal(await f.page.evaluate(path => window.taskNavigations.filter(url => url === path).length, f.path(ids, 2)), 1);
		assert.deepEqual(f.errors, []);
		console.log("PASS early guest dismissal: one transition, no stale 400ms navigation");
	} finally { await f.context.close(); }
}

async function signedInAndCleanup(browser) {
	const f = await fixture(browser, true);
	const ids = ["restaurant", "during-the-meal"];
	try {
		await f.page.goto(baseURL + f.path(ids, 1));
		await f.answer(ids, 1);
		await f.page.keyboard.press("Enter");
		await f.page.waitForTimeout(150);
		assert.equal(new URL(f.page.url()).pathname, f.path(ids, 1), "Signed-in feedback delay is retained");
		await f.page.waitForURL(url => url.pathname === f.path(ids, 2));
		assert.equal(await f.page.locator("#guest-progress-title").count(), 0);
		assert.equal(f.saves.filter(path => path.endsWith("/tasks/1")).length, 1);
		await f.answer(ids, 2);
		await f.page.getByRole("link", { name: t.previousExercise, exact: true }).click();
		await f.page.waitForURL(url => url.pathname === f.path(ids, 1));
		await f.page.waitForTimeout(700);
		assert.equal(new URL(f.page.url()).pathname, f.path(ids, 1), "Leaving a completed task cancels its stale timer");
		assert.deepEqual(f.errors, []);
		console.log("PASS signed-in: normal 400ms progression, one save, no reminder, task-change timer cleanup");
	} finally { await f.context.close(); }
}

(async () => {
	const browser = await chromium.launch({ channel: "chrome", headless: true });
	try {
		for (const [method, width] of [["later", 375], ["close", 1280], ["escape", 1280]]) await guestDismissal(browser, method, width);
		await earlyDismissal(browser);
		await loginNavigation(browser);
		await signedInAndCleanup(browser);
	} finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
