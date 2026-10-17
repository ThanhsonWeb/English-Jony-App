// Local browser regression checks; all account APIs are mocked.
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const t = require("../../../messages/en.json").WordlistReview;
const notebook = require("../../../messages/en.json").Notebook;
const baseURL = process.env.STUDYJONY_TEST_URL || "http://localhost:3000";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname));
const userId = "aaaaaaaaaaaaaaaaaaaaaaaa";
const topicId = "bbbbbbbbbbbbbbbbbbbbbbbb";

function wordsFor(due, total = 16) {
	return Array.from({ length: total }, (_, index) => ({
		_id: String(index + 1).padStart(24, "0"), user: userId,
		english: `word-${index}`, vietnamese: `meaning-${index}`, topic: topicId,
		reviewCount: 1, learningLevel: 1, status: index >= due,
		lastReviewedAt: "2020-01-01T00:00:00.000Z",
		nextReview: index < due ? "2020-01-01T00:00:00.000Z" : "2099-01-01T00:00:00.000Z",
	}));
}

async function fixture(browser, width, { due = 1, total = 16, topic = false, failure, duplicate = false } = {}) {
	const context = await browser.newContext({ locale: "en", viewport: { width, height: 900 }, hasTouch: width < 600 });
	const words = wordsFor(due, total);
	if (duplicate) words.forEach(word => { word.vietnamese = "same meaning"; });
	const saves = [];
	const requests = [];
	const errors = [];
	await context.route("**/*", route => new URL(route.request().url()).origin === new URL(baseURL).origin
		? route.continue() : route.fulfill({ body: "" }));
	await context.route("**/api/v1/**", route => {
		const request = route.request();
		const url = new URL(request.url());
		if (url.pathname.endsWith("/users/me")) return route.fulfill({ json: { status: "success", data: { user: { _id: userId, name: "Quiz tester" } } } });
		if (url.pathname.endsWith("/review")) {
			const id = url.pathname.split("/").at(-2);
			saves.push({ id, input: request.postDataJSON() });
			if (failure === "save") return route.fulfill({ status: 503, json: { status: "error" } });
			return route.fulfill({ json: { status: "success", data: { updatedVocab: { ...words.find(word => word._id === id), nextReview: "2099-01-01" }, xp: { awarded: 5 } } } });
		}
		if (url.pathname === "/api/v1/vocab") {
			requests.push(url.search);
			if (failure === "load" || (failure === "choices" && !url.searchParams.has("topic"))) return route.fulfill({ status: 503, json: { status: "error" } });
			return route.fulfill({ json: { status: "success", data: { vocabularies: topic && url.searchParams.has("topic") ? words.slice(0, 1) : words } } });
		}
		return route.fulfill({ json: { status: "success", data: { topics: [], activities: [] } } });
	});
	const page = await context.newPage();
	page.on("pageerror", error => errors.push(error.message));
	await page.goto(`${baseURL}/en/wordlist/${topic ? `${topicId}/learn` : "review"}/quiz?reviewMode=due`);
	return { context, page, words, saves, requests, errors };
}

async function answer(page, word) {
	const card = page.locator(".quiz-review-card");
	await card.getByRole("heading", { name: word.english, exact: true }).waitFor();
	assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), "Quiz must fit the viewport");
	const choices = card.locator('button[type="button"]');
	assert.equal(await choices.count(), 4);
	const labels = (await choices.allTextContents()).map(text => text.replace(/^\s*\d\s*/, "").trim().toLowerCase());
	assert.equal(new Set(labels).size, 4);
	assert.equal(labels.filter(text => text === word.vietnamese).length, 1);
	await choices.filter({ hasText: new RegExp(`${word.vietnamese}$`) }).click();
	await page.getByRole("button", { name: t.common.check, exact: true }).click();
}

async function run() {
	const browser = await chromium.launch({ channel: "chrome", headless: true });
	try {
		for (const width of [1440, 390]) {
			for (const due of [0, 1, 2, 3, 5]) {
				const f = await fixture(browser, width, { due });
				try {
					if (!due) await f.page.getByRole("heading", { name: t.common.emptyTitle }).waitFor();
					else {
						for (const word of f.words.slice(0, due)) await answer(f.page, word);
						await f.page.getByRole("heading", { name: t.quiz.completionTitle, exact: true }).waitFor();
					}
					assert.deepEqual(f.saves.map(save => save.id), f.words.slice(0, due).map(word => word._id), "Only due targets are reviewed; distractors cannot earn XP or change SRS");
					assert.ok(f.saves.every(save => save.input.mode === "quiz" && !save.input.practice));
					assert.deepEqual(f.errors, []);
					console.log(`PASS ${width}px: ${due} due / 16 saved, unique choices and target-only saves`);
				} finally { await f.context.close(); }
			}
			for (const options of [{ total: 3 }, { duplicate: true }]) {
				const f = await fixture(browser, width, options);
				try {
					await f.page.getByRole("heading", { name: t.quiz.notEnoughTitle }).waitFor();
					await f.page.getByRole("button", { name: t.quiz.flashcardAction }).click();
					await f.page.waitForURL(url => url.pathname.endsWith("/review/flashcard") && url.searchParams.get("reviewMode") === "due");
					assert.deepEqual(f.saves, []);
					assert.deepEqual(f.errors, []);
					console.log(`PASS ${width}px: insufficient distinct choices offers due-only Flashcards`);
				} finally { await f.context.close(); }
			}
			const f = await fixture(browser, width);
			try {
				await f.page.goto(`${baseURL}/en/wordlist`);
				await f.page.getByRole("button", { name: notebook.practice, exact: true }).click();
				await f.page.locator('#wordlist-practice-menu a[data-mode="quiz"]').click();
				await f.page.waitForURL(url => url.pathname.endsWith("/wordlist/review/quiz") && url.searchParams.get("reviewMode") === "due");
				await answer(f.page, f.words[0]);
				await f.page.getByRole("heading", { name: t.quiz.completionTitle, exact: true }).waitFor();
				assert.deepEqual(f.saves.map(save => save.id), [f.words[0]._id]);
				assert.deepEqual(f.errors, []);
				console.log(`PASS ${width}px: Wordlist → Practice → Quiz with warm vocabulary cache and one due word`);
			} finally { await f.context.close(); }
		}
		for (const failure of [undefined, "choices", "load", "save"]) {
			const f = await fixture(browser, 1440, { topic: failure !== "load", failure });
			try {
				if (failure === "choices" || failure === "load") {
					await f.page.getByText(failure === "choices" ? t.quiz.choiceLoadError : t.common.loadError, { exact: true }).waitFor();
					assert.equal(await f.page.getByRole("heading", { name: t.quiz.notEnoughTitle }).count(), 0);
				} else {
					await answer(f.page, f.words[0]);
					if (failure === "save") {
						await f.page.getByText(t.common.saveFailed.replace("{count}", "1"), { exact: true }).waitFor();
						assert.equal(await f.page.getByText(/progress saved/i).count(), 0);
					} else await f.page.getByRole("heading", { name: t.quiz.completionTitle, exact: true }).waitFor();
					assert.ok(f.saves.length >= 1 && f.saves.every(save => save.id === f.words[0]._id));
					assert.ok(f.requests.includes(`?topic=${topicId}`) && f.requests.includes(""));
				}
				assert.deepEqual(f.errors, []);
				console.log(`PASS topic fallback / ${failure || "success"}: due filter, separate errors and save protection`);
			} finally { await f.context.close(); }
		}
	} finally { await browser.close(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
