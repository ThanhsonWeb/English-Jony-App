// Local Next UI with controlled progress latency/failures. No live services.
const assert = require("node:assert/strict");
const { createHash } = require("node:crypto");
const { chromium } = require("playwright");
const rules = require("../../../../server/data/dialogueTaskRules.json");
const baseURL = process.env.STUDYJONY_TEST_URL || "http://localhost:3000";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname));
const userId = "aaaaaaaaaaaaaaaaaaaaaaaa";
const queuePrefix = `studyjony-progress-v1:${userId}:`;
const taskPath = ids => "/dialogue/" + ids.join("/");
const apiPath = ids => `/api/v1/dialogue-progress/${ids[0]}/${ids[1]}/tasks/${ids[2]}`;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check) {
	const deadline = Date.now() + 20000;
	while (!check()) { assert.ok(Date.now() < deadline, "Timed out waiting for mock server"); await pause(20); }
}
async function expectNoProgressNotice(page, t) {
	assert.equal(await page.getByText(t.progressSaving, { exact: true }).count(), 0, "No background saving banner");
	assert.equal(await page.locator("div.mx-auto.mt-4.w-full.max-w-6xl").count(), 0, "No notice wrapper or reserved space");
}
async function waitForConfirmedStorage(page) {
	await page.waitForFunction(prefix => Object.keys(localStorage).filter(key => key.startsWith(prefix)).every(key => JSON.parse(localStorage.getItem(key)).status === "saved"), queuePrefix);
}
async function fixture(browser, width, locale, unsafeStorage = false) {
	const context = await browser.newContext({ viewport: { width, height: 900 }, hasTouch: width < 768 });
	await context.addInitScript(({ unsafeStorage }) => {
		localStorage.setItem("studyjony-theme", "dark");
		if (unsafeStorage) {
			const setItem = Storage.prototype.setItem;
			Storage.prototype.setItem = function(key, value) {
				if (key.startsWith("studyjony-progress-v1:")) throw new DOMException("Quota exceeded", "QuotaExceededError");
				return setItem.call(this, key, value);
			};
		}
	}, { unsafeStorage });
	const page = await context.newPage(), errors = [], writes = [], confirmed = [], attempts = new Map();
	let serial = 0, gate, release, failures = 0, rejectPermanently = false, loseReply = false;
	page.setDefaultTimeout(20000);
	page.on("pageerror", error => errors.push(error.message));
	page.on("dialog", dialog => dialog.accept());
	await context.route("**/*", route => new URL(route.request().url()).origin === new URL(baseURL).origin ? route.continue()
		: route.fulfill({ contentType: "application/javascript", body: "" }));
	await context.route("**/api/v1/**", async route => {
		const request = route.request(), path = new URL(request.url()).pathname;
		const json = data => route.fulfill({ json: { status: "success", data } });
		if (path === "/api/v1/users/me") return json({ user: { _id: userId, name: "Progress tester", email: "test@example.test", theme: "dark" } });
		if (path.endsWith("/attempt")) {
			assert.equal(request.headers()["x-studyjony-progress-user"], userId);
			const task = path.slice(0, -8);
			if (!attempts.has(task)) attempts.set(task, { attemptId: createHash("sha256").update(task + ++serial).digest("hex"), expiresAt: new Date(Date.now() + 600000).toISOString(), readyAfterMs: 0 });
			return json(attempts.get(task));
		}
		if (request.method() === "PATCH" && path.includes("/dialogue-progress/")) {
			assert.equal(request.headers()["x-studyjony-progress-user"], userId);
			const body = request.postDataJSON(); writes.push({ path, body });
			if (gate) await gate;
			if (failures-- > 0) return route.fulfill({ status: 503, json: { status: "error" } });
			if (rejectPermanently) return route.fulfill({ status: 403, json: { status: "fail" } });
			const ids = path.split("/"), taskId = ids.at(-1), dialogueId = ids.at(-3), lessonId = ids.at(-4);
			const progress = { user: userId, lessonId, dialogueId, completedTaskIds: [taskId] };
			confirmed.push({ path, body });
			if (loseReply) { loseReply = false; return route.abort("connectionreset"); }
			try { await json({ progress }); } catch (error) { if (!/closed|handled|intercept/i.test(error.message)) throw error; }
			return;
		}
		return json({ progress: path.endsWith("/latest") ? null : [], vocabularies: [], topics: [], activities: [] });
	});
	const prefix = locale === "en" ? "/en" : "";
	const t = require(`../../../messages/${locale}.json`).DialogueFeature;
	return {
		page, context, writes, confirmed, attempts, errors, t, prefix,
		hold() { gate = new Promise(resolve => { release = resolve; }); },
		release() { const done = release; gate = null; done?.(); },
		fail(count = 1) { failures = count; },
		permanent(value) { rejectPermanently = value; },
		loseReply() { loseReply = true; },
		async open(ids) {
			await page.goto(baseURL + prefix + taskPath(ids), { waitUntil: "domcontentloaded", timeout: 90000 });
			await until(() => attempts.has(apiPath(ids)));
		},
		async answer(rule, answer = rule.answers) {
			if (rule.type === "fillBlank") {
				const inputs = page.locator('input[placeholder="..."]');
				for (let index = 0; index < answer.length; index++) await inputs.nth(index).fill(answer[index]);
			} else if (rule.type === "multipleChoice") {
				await page.locator("div.mt-6.overflow-hidden button").nth(answer[0]).click();
			} else if (rule.type === "dialogueCloze") {
				await page.getByRole("button", { name: t.typeAnswer, exact: true }).click();
				const inputs = page.locator('[data-cloze-line] input');
				for (let index = 0; index < answer.length; index++) await inputs.nth(index).fill(answer[index]);
			}
			await page.getByRole("button", { name: t.check, exact: true }).click();
		},
		async pending() {
			return page.evaluate(prefix => Object.keys(localStorage).filter(key => key.startsWith(prefix)).map(key => JSON.parse(localStorage.getItem(key))).filter(record => record.status !== "saved"), queuePrefix);
		},
	};
}

async function flow(browser, width, locale, ids) {
	const f = await fixture(browser, width, locale);
	const courseRules = rules.filter(rule => rule.ids[0] === ids[0] && rule.ids[1] === ids[1]);
	const rule = number => courseRules.find(rule => rule.ids[2] === String(number));
	try {
		f.hold(); await f.open(rule(1).ids);
		await f.answer(rule(1), ["wrong answer"]);
		await f.page.getByText(f.t.wrongTryAgain, { exact: false }).waitFor();
		assert.equal(f.writes.length, 0, "Wrong answers cannot submit completion");
		await f.answer(rule(1));
		const next = f.page.getByRole("link", { name: f.t.continueArrow, exact: true });
		await next.waitFor({ timeout: 1500 });
		await until(() => f.writes.length === 1);
		assert.equal(f.confirmed.length, 0); assert.equal((await f.pending()).length, 1);
		await expectNoProgressNotice(f.page, f.t);
		await f.page.keyboard.press("Enter");
		await f.page.waitForURL(url => url.pathname === f.prefix + taskPath(rule(2).ids));
		await f.answer(rule(2)); await next.waitFor({ timeout: 1500 }); await next.click();
		await f.page.waitForURL(url => url.pathname === f.prefix + taskPath(rule(3).ids));
		await f.answer(rule(3)); await next.waitFor({ timeout: 1500 });
		assert.equal(f.writes.length, 1, "Only one request is active while three exercises are complete");
		assert.equal((await f.pending()).length, 3);
		await expectNoProgressNotice(f.page, f.t);
		await f.page.getByRole("button", { name: f.t.exit, exact: true }).first().click();
		await f.page.getByRole("dialog").getByText(f.t.leaveUnsavedProgress, { exact: true }).waitFor();
		await f.page.keyboard.press("Enter");
		assert.equal(new URL(f.page.url()).pathname, f.prefix + taskPath(rule(3).ids), "Enter in the exit modal must not advance the exercise");
		await f.page.keyboard.press("Escape");
		assert.equal(await f.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
		f.release(); await until(() => f.confirmed.length === 3);
		assert.deepEqual(f.writes.map(write => write.path), [1, 2, 3].map(number => apiPath(rule(number).ids)));
		await f.page.waitForFunction(prefix => Object.keys(localStorage).filter(key => key.startsWith(prefix)).every(key => JSON.parse(localStorage.getItem(key)).status === "saved"), queuePrefix);

		// A temporary failure retries silently with the original attempt and keeps Continue.
		await f.open(rule(4).ids); f.fail(); await f.answer(rule(4));
		await f.page.waitForFunction(prefix => Object.keys(localStorage).filter(key => key.startsWith(prefix)).some(key => {
			const record = JSON.parse(localStorage.getItem(key));
			return record.status === "error" && record.nextRetry < Number.MAX_SAFE_INTEGER;
		}), queuePrefix);
		await expectNoProgressNotice(f.page, f.t);
		assert.equal(await f.page.getByText(f.t.progressSaveFailed, { exact: true }).count(), 0, "No save error notice during automatic retry");
		await next.waitFor(); await next.click();
		await f.page.waitForURL(url => url.pathname === f.prefix + taskPath(rule(5).ids));
		await until(() => f.writes.filter(write => write.path === apiPath(rule(4).ids)).length === 2);
		await until(() => f.confirmed.length === 4);
		const retried = f.writes.filter(write => write.path === apiPath(rule(4).ids));
		assert.deepEqual(retried[0].body, retried[1].body);

		// Refresh while saving; the server may have committed before the reply vanished.
		await f.open(rule(6).ids); f.permanent(true); await f.answer(rule(6));
		await f.page.getByRole("alert").getByText(f.t.progressSaveFailed, { exact: true }).waitFor();
		const before = f.writes.length, stored = (await f.pending())[0];
		f.permanent(false); f.loseReply();
		await f.page.reload({ waitUntil: "domcontentloaded" });
		await until(() => f.writes.length >= before + 2);
		const restored = f.writes.slice(before);
		assert.ok(restored.every(write => write.body.attemptId === stored.attempt.attemptId));
		await f.page.waitForFunction(prefix => Object.keys(localStorage).filter(key => key.startsWith(prefix)).every(key => JSON.parse(localStorage.getItem(key)).status === "saved"), queuePrefix);

		// Leaving through Exit keeps the worker running silently.
		f.hold(); await f.open(rule(7).ids); await f.answer(rule(7));
		await next.waitFor();
		await f.page.getByRole("button", { name: f.t.exit, exact: true }).first().click();
		await f.page.getByRole("dialog").getByRole("button", { name: f.t.exit, exact: true }).click();
		await f.page.waitForURL(url => url.pathname === f.prefix + "/dialogue/" + ids[0]);
		await expectNoProgressNotice(f.page, f.t);
		assert.equal((await f.pending()).length, 1);
		f.release(); await until(() => f.confirmed.some(write => write.path === apiPath(rule(7).ids)));

		// Final exercise can leave for useful words before the final PATCH confirms.
		f.hold(); await f.open(rule(25).ids); await f.answer(rule(25));
		const final = f.page.getByRole("link", { name: f.t.completeDialogue, exact: true });
		await final.waitFor({ timeout: 1500 }); await final.click();
		await f.page.waitForURL(url => url.pathname === f.prefix + taskPath(ids) + "/useful-words");
		await expectNoProgressNotice(f.page, f.t);
		assert.equal((await f.pending()).length, 1);
		f.release(); await until(() => f.confirmed.some(write => write.path === apiPath(rule(25).ids)));
		assert.deepEqual(f.errors, []);
		console.log(`PASS ${width}px ${locale} ${ids[0]}: feedback, slow saves, Enter, rapid tasks/FIFO, retry, refresh/lost reply, final exercise, mobile layout`);
	} finally { f.release(); await f.context.close(); }
}

(async () => {
	const browser = await chromium.launch({ channel: "chrome", headless: true });
	try {
		for (const width of [375, 1280]) for (const locale of ["vi", "en"]) {
			for (const ids of [["asking-for-directions", "finding-a-cafe"], ["ten-minutes-a-day", "the-old-book"]]) await flow(browser, width, locale, ids);
		}
		const f = await fixture(browser, 375, "en", true);
		try {
			const first = rules.find(rule => rule.ids.join("/") === "asking-for-directions/finding-a-cafe/1");
			f.hold(); await f.open(first.ids); await f.answer(first);
			await until(() => f.writes.length === 1);
			assert.equal(await f.page.getByRole("link", { name: f.t.continueArrow, exact: true }).count(), 0);
			await f.page.getByText(f.t.progressStorageUnavailable, { exact: true }).waitFor();
			f.release(); await f.page.getByRole("link", { name: f.t.continueArrow, exact: true }).waitFor();
			console.log("PASS unavailable device storage: Continue waits for server confirmation");
		} finally { f.release(); await f.context.close(); }
		const tabs = await fixture(browser, 1280, "en");
		try {
			const ids = ["asking-for-directions", "finding-a-cafe", "1"];
			const first = rules.find(rule => rule.ids.join("/") === ids.join("/"));
			tabs.hold(); await tabs.open(ids); await tabs.answer(first);
			await until(() => tabs.writes.length === 1);
			const second = await tabs.context.newPage();
			await second.goto(baseURL + tabs.prefix + taskPath(ids), { waitUntil: "domcontentloaded" });
			await second.locator('input[placeholder="..."]').fill("find");
			await second.getByRole("button", { name: tabs.t.check, exact: true }).click();
			await second.getByRole("link", { name: tabs.t.continueArrow, exact: true }).waitFor();
			assert.equal(tabs.writes.length, 1);
			tabs.release();
			await waitForConfirmedStorage(second);
			await expectNoProgressNotice(second, tabs.t);
			assert.equal(tabs.writes.length, 1, "Two tabs must coordinate the same pending completion");
			console.log("PASS two browser tabs: one pending completion, one confirmed save");
		} finally { tabs.release(); await tabs.context.close(); }
		const closed = await fixture(browser, 375, "en");
		try {
			const ids = ["ten-minutes-a-day", "the-old-book", "1"];
			const first = rules.find(rule => rule.ids.join("/") === ids.join("/"));
			closed.hold(); await closed.open(ids); await closed.answer(first);
			await until(() => closed.writes.length === 1);
			await closed.page.close();
			const reopened = await closed.context.newPage();
			await reopened.goto(baseURL + closed.prefix + taskPath(ids), { waitUntil: "domcontentloaded" });
			await until(() => closed.writes.length === 2);
			assert.deepEqual(closed.writes[0].body, closed.writes[1].body);
			closed.release();
			await waitForConfirmedStorage(reopened);
			await expectNoProgressNotice(reopened, closed.t);
			console.log("PASS close tab and reopen: pending answer and original attempt restored");
		} finally { closed.release(); await closed.context.close(); }
	} finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
