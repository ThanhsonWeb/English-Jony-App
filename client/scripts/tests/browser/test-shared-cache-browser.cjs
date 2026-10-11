// Local UI with stateful mocked API responses. No real account or data is used.
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const messages = require("../../../messages/en.json");
const base = process.env.STUDYJONY_TEST_URL || "http://localhost:3000";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
const topic = "000000000000000000000099";
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const word = (id, english, user = "account-a") => ({ _id: id, english, vietnamese: `${english}-meaning`, user, topic,
	nextReview: "2020-01-01", reviewCount: 0, learningLevel: 0, status: false });
const navigate = async (page, path) => {
	await page.evaluate(path => window.next.router.push(`/en${path}`), path);
	await page.waitForURL(url => url.pathname === `/en${path}`);
};
const snapshot = page => page.evaluate(() => Object.fromEntries(Object.keys(sessionStorage)
	.filter(key => key.startsWith("studyjony-resources:v1:")).map(key => { const entry = JSON.parse(sessionStorage.getItem(key)); return [entry.key, entry]; })));

async function setup(browser, width) {
	const context = await browser.newContext({ viewport: { width, height: 950 }, hasTouch: width < 768 });
	await context.addCookies([{ name: "jwt", value: "isolated-cookie-fixture", url: base, httpOnly: true, sameSite: "Lax" }]);
	const page = await context.newPage(), errors = [], requests = [];
	page.setDefaultTimeout(20000);
	page.on("pageerror", error => errors.push(error.message));
	let active = "account-a", words = [word("word-one", "hello")], xp = 0, count = 0;
	let failSave = false, failReads = false, holdSave = null;
	const progress = {};
	const user = id => ({ _id: id, name: id, email: `${id}@example.test`, role: "user", theme: "dark" });
	await page.route("**/api/v1/**", async route => {
		const request = route.request(), url = new URL(request.url()), method = request.method();
		requests.push({ path: url.pathname, method, topic: url.searchParams.get("topic") });
		const fulfill = (data, status = 200) => route.fulfill({ status, json: { status: status < 400 ? "success" : "fail", data } });
		if (url.pathname === "/api/v1/users/me") return fulfill({ user: active ? user(active) : null }, active ? 200 : 401);
		if (url.pathname === "/api/v1/auth/logout") { active = null; return fulfill({}); }
		if (url.pathname === "/api/v1/auth/credentials/login") {
			active = "account-b"; words = [word("word-b", "private-b", active)];
			return fulfill({ user: user(active), credentialAttempt: request.headers()["x-studyjony-auth-attempt"] });
		}
		if (url.pathname === "/api/v1/topics") return fulfill({ topics: [{ _id: topic, name: "Cache topic" }] });
		if (url.pathname === "/api/v1/vocab" && method === "GET") {
			if (failReads) return fulfill({}, 503);
			return fulfill({ vocabularies: words.filter(item => !url.searchParams.get("topic") || item.topic === url.searchParams.get("topic")) });
		}
		if (url.pathname.startsWith("/api/v1/vocab")) {
			if (holdSave) { const release = holdSave; holdSave = null; await release; }
			if (failSave) return fulfill({}, 503);
			const id = url.pathname.split("/")[4], input = request.postDataJSON();
			if (method === "DELETE") { words = words.filter(item => item._id !== id); return route.fulfill({ status: 204 }); }
			if (url.pathname.endsWith("/review")) {
				const existing = words.find(item => item._id === id);
				Object.assign(existing, { reviewCount: existing.reviewCount + 1, learningLevel: 2, nextReview: "2099-01-01" });
				xp += 2; count++;
				return fulfill({ updatedVocab: existing, correct: true, xp: { awarded: 2, total: xp } });
			}
			if (method === "POST") { const added = { ...word("added", input.english), ...input, topic }; words.push(added); return fulfill({ newVocab: added }, 201); }
			const existing = words.find(item => item._id === id);
			Object.assign(existing, input, { english: input.english.trim().toLowerCase() });
			return fulfill({ updatedVocab: existing });
		}
		if (url.pathname === "/api/v1/leaderboard") return fulfill({ leaderboard: [], currentUser: {
			id: active, name: active, isCurrentUser: true, rank: null, avatar: "", lifetimeXp: xp, periodXp: xp,
			level: 1, currentLevelXp: xp, nextLevelXp: 100, nextLevelTotalXp: 100, xpToNextLevel: 100 - xp, progressPercent: xp,
			streakDays: xp ? 1 : 0, completedWeekdays: [false, false, false, false, false, false, Boolean(xp)],
		} });
		if (url.pathname === "/api/v1/study-activities") return fulfill({ activities: xp ? [{ date: today, count, hasQualifiedStudy: true }] : [] });
		if (url.pathname.startsWith("/api/v1/dialogue-progress/")) {
			const [, , , , lessonId, dialogueId, , taskId, attempt] = url.pathname.split("/");
			if (attempt === "attempt") return fulfill({ attemptId: "a".repeat(64), expiresAt: new Date(Date.now() + 600000).toISOString(), readyAfterMs: 0 });
			if (method === "GET") return fulfill({ progress: progress[lessonId] || [] });
			if (failSave) return fulfill({}, 503);
			const current = (progress[lessonId] ||= []);
			let entry = current.find(item => item.dialogueId === dialogueId);
			if (!entry) { entry = { lessonId, dialogueId, user: active, completedTaskIds: [] }; current.push(entry); }
			if (!entry.completedTaskIds.includes(taskId)) { entry.completedTaskIds.push(taskId); xp += 10; }
			entry.lastTaskId = taskId; entry.updatedAt = new Date().toISOString();
			return fulfill({ progress: entry, xp: { awarded: 10, total: xp } });
		}
		return fulfill({});
	});
	await page.route("**/_vercel/insights/**", route => route.fulfill({ body: "", contentType: "application/javascript" }));
	await page.goto(`${base}/en/wordlist`);
	await page.getByRole("rowheader", { name: /hello/ }).waitFor();
	return { page, context, errors, requests, setFail(value) { failSave = value; }, setReadFailure(value) { failReads = value; },
		hold(promise) { holdSave = promise; }, getXP() { return xp; } };
}

async function vocabularyScenario(browser, width) {
	const c = await setup(browser, width), { page } = c;
	try {
		await navigate(page, `/wordlist/${topic}`);
		await page.getByText("hello", { exact: true }).waitFor();
		await navigate(page, "/wordlist");
		await page.getByRole("rowheader", { name: /hello/ }).waitFor();
		const initialGets = c.requests.filter(r => r.path === "/api/v1/vocab" && r.method === "GET").length;
		await page.getByRole("button", { name: messages.Notebook.addWord, exact: true }).click();
		const dialog = page.getByRole("dialog");
		await dialog.locator('[name="english"]').fill("newword");
		await dialog.locator('[name="vietnamese"]').fill("new-meaning");
		await dialog.getByRole("button", { name: messages.Notebook.save, exact: true }).click();
		await page.getByRole("rowheader", { name: /newword/ }).waitFor();
		await navigate(page, `/wordlist/${topic}`);
		await page.getByText("newword", { exact: true }).waitFor();
		assert.equal(c.requests.filter(r => r.path === "/api/v1/vocab" && r.method === "GET").length, initialGets, "Both primed views update without refetching");
		await navigate(page, "/wordlist");
		const row = page.locator("tbody tr").filter({ hasText: "newword" });
		await row.getByRole("button", { name: /Edit/ }).click();
		await dialog.locator('[name="english"]').fill("EDITED");
		await dialog.getByRole("button", { name: messages.Notebook.save, exact: true }).click();
		await page.getByRole("rowheader", { name: /edited/ }).waitFor();
		await navigate(page, `/wordlist/${topic}`);
		await page.getByText("edited", { exact: true }).waitFor();
		await page.reload();
		await page.getByText("edited", { exact: true }).waitFor();
		assert.equal(c.requests.filter(r => r.path === "/api/v1/vocab" && r.method === "GET").length, initialGets, "Refresh restores server-confirmed edits");
		await navigate(page, "/wordlist");
		c.setFail(true);
		await page.locator("tbody tr").filter({ hasText: "edited" }).getByRole("button", { name: /Edit/ }).click();
		await dialog.locator('[name="english"]').fill("unsaved");
		await dialog.getByRole("button", { name: messages.Notebook.save, exact: true }).click();
		await dialog.getByRole("alert").waitFor();
		assert.equal((await snapshot(page))["vocab:all"].data.find(w => w._id === "added").english, "edited");
		await dialog.getByRole("button", { name: messages.Notebook.cancel, exact: true }).click();
		c.setFail(false);
		await page.locator("tbody tr").filter({ hasText: "edited" }).getByRole("button", { name: /Delete/ }).click();
		await dialog.getByRole("button", { name: messages.Notebook.remove, exact: true }).click();
		await page.waitForFunction(() => !document.querySelector("dialog[open]"));
		assert.equal(await page.getByRole("rowheader", { name: /edited/ }).count(), 0);
		await navigate(page, `/wordlist/${topic}`);
		assert.equal(await page.getByText("edited", { exact: true }).count(), 0);
		await page.reload();
		await page.getByText("hello", { exact: true }).waitFor();
		assert.equal(await page.getByText("edited", { exact: true }).count(), 0);
		// Actual logout UI, then a credential login for a different account.
		await page.locator("header button.group").click();
		await page.getByRole("button", { name: messages.Header.logout, exact: true }).click();
		await page.waitForURL(url => url.pathname === "/en");
		assert.deepEqual(await snapshot(page), {});
		await navigate(page, "/login");
		await page.locator("#login-email").fill("account-b@example.test");
		await page.locator("#login-password").fill("isolated-browser-password");
		await page.locator("form").evaluate(form => form.requestSubmit());
		await page.getByRole("rowheader", { name: /private-b/ }).waitFor();
		assert.equal(await page.getByRole("rowheader", { name: /hello|edited|newword/ }).count(), 0);
		await page.reload();
		await page.getByRole("rowheader", { name: /private-b/ }).waitFor();
		assert.ok(Object.values(await snapshot(page)).every(entry => entry.userId === "account-b"));
		assert.deepEqual(c.errors, []);
		console.log(`PASS ${width}px: add/edit/delete, navigation, refresh, failed save, logout and account switch`);
	} finally { await c.context.close(); }
}

async function studyScenario(browser, width) {
	const c = await setup(browser, width), { page } = c;
	try {
		await navigate(page, "/dialogue");
		await page.waitForFunction(() => Object.keys(sessionStorage).some(key => key.includes("progress%3Acatalogue")));
		await navigate(page, "/rank");
		await page.getByText("0 KN", { exact: true }).first().waitFor();
		await navigate(page, "/profile");
		await page.waitForFunction(() => Object.keys(sessionStorage).some(key => key.includes("study-activities")));
		for (const [lessonId, dialogueId, answer] of [["asking-for-directions", "finding-a-cafe", "find"], ["grateful", "helping-in-return", "help"]]) {
			await navigate(page, `/dialogue/${lessonId}/${dialogueId}/1`);
			await page.getByRole("textbox").first().fill(answer);
			await page.getByRole("button", { name: messages.DialogueFeature.check, exact: true }).click();
			await page.getByText(messages.DialogueFeature.correct).first().waitFor();
			await page.waitForFunction(lessonId => Object.keys(sessionStorage).some(key => {
				if (!key.includes("progress%3Acatalogue")) return false;
				return JSON.parse(sessionStorage.getItem(key)).data[lessonId]?.some(entry => entry.completedTaskIds.includes("1"));
			}), lessonId);
			const data = await snapshot(page);
			assert.ok(data[`progress:${lessonId}`].data[0].completedTaskIds.includes("1"));
		}
		await navigate(page, "/rank");
		await page.getByText("20 KN", { exact: true }).first().waitFor();
		await page.getByText("1 day", { exact: true }).first().waitFor();
		await navigate(page, "/profile");
		await page.waitForFunction(() => Object.keys(sessionStorage).some(key => key.includes("study-activities") && JSON.parse(sessionStorage.getItem(key)).data.some(entry => entry.hasQualifiedStudy)));
		await navigate(page, "/wordlist/review/flashcard");
		await page.getByRole("button", { name: messages.WordlistReview.flashcard.reveal, exact: true }).click();
		await page.getByRole("button", { name: messages.WordlistReview.flashcard.hard }).click();
		await page.waitForFunction(() => Object.keys(sessionStorage).some(key => key.includes("vocab%3Aall") && JSON.parse(sessionStorage.getItem(key)).data[0]?.reviewCount === 1));
		await navigate(page, "/wordlist");
		await page.getByRole("rowheader", { name: /hello/ }).waitFor();
		assert.equal((await snapshot(page))["vocab:all"].data[0].nextReview, "2099-01-01");
		await navigate(page, "/rank");
		await page.getByText("22 KN", { exact: true }).first().waitFor();
		assert.equal(c.getXP(), 22);
		await page.reload();
		await page.getByText("22 KN", { exact: true }).first().waitFor();
		assert.deepEqual(c.errors, []);
		console.log(`PASS ${width}px: Dialogue + Story progress, XP, streak, activity and review status, including refresh`);
	} finally { await c.context.close(); }
}

async function concurrentScenario(browser, width) {
	const c = await setup(browser, width), { page } = c;
	let release;
	try {
		await navigate(page, `/wordlist/${topic}`);
		const edit = () => page.getByRole("button", { name: messages.WordlistDetail.editLabel.replace("{word}", "hello"), exact: true });
		await edit().click();
		const form = page.locator("form").filter({ has: page.locator("textarea") });
		await form.locator("input").first().fill("FIRST");
		c.hold(new Promise(resolve => { release = resolve; }));
		await form.getByRole("button", { name: messages.WordlistDetail.form.save, exact: true }).click();
		await page.waitForFunction(() => !document.querySelector("form textarea"));
		await edit().click();
		assert.equal(await form.locator("input").first().inputValue(), "hello", "Reopened editor starts from confirmed data, not a pending edit");
		await form.locator("input").first().fill("SECOND");
		await form.getByRole("button", { name: messages.WordlistDetail.form.save, exact: true }).click();
		await delay(150);
		assert.equal(c.requests.filter(r => r.method === "PATCH" && r.path.endsWith("word-one")).length, 1);
		assert.equal((await snapshot(page))["vocab:all"].data[0].english, "hello");
		release();
		await page.getByText("second", { exact: true }).waitFor();
		await navigate(page, "/wordlist");
		await page.getByRole("rowheader", { name: /second/ }).waitFor();
		await page.reload();
		await page.getByRole("rowheader", { name: /second/ }).waitFor();
		assert.equal(c.requests.filter(r => r.method === "PATCH" && r.path.endsWith("word-one")).length, 2);
		assert.deepEqual(c.errors, []);
		console.log(`PASS ${width}px: rapid edits wait in order, retain confirmed fields, and survive navigation/refresh`);
	} finally { release?.(); await c.context.close(); }
}

(async () => {
	const browser = await chromium.launch({ channel: "chrome", headless: true });
	try { for (const width of [1440, 390]) {
		if (!process.env.CACHE_TEST_SCENARIO || process.env.CACHE_TEST_SCENARIO === "vocabulary") await vocabularyScenario(browser, width);
		if (!process.env.CACHE_TEST_SCENARIO || process.env.CACHE_TEST_SCENARIO === "study") await studyScenario(browser, width);
		if (!process.env.CACHE_TEST_SCENARIO || process.env.CACHE_TEST_SCENARIO === "concurrent") await concurrentScenario(browser, width);
	} }
	finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
