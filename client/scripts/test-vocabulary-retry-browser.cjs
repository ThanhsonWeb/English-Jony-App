// Run with Playwright available and Next dev running on localhost:3000.
// API requests are mocked; server scheduling/ownership are covered by MongoDB tests.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const baseURL = process.env.STUDYJONY_TEST_URL || "http://localhost:3000";
const topicId = "000000000000000000000010";
const now = Date.now();
const date = offset => new Date(now + offset).toISOString();
const words = [
	{ english: "hello", vietnamese: "xin chao", reviewCount: 0, learningLevel: 0, lastReviewedAt: date(-7200000), nextReview: date(-3600000), createdAt: date(-86400000) },
	{ english: "apple", vietnamese: "tao", reviewCount: 0, learningLevel: 0, nextReview: date(-3600000), createdAt: date(-86400000) },
	{ english: "book", vietnamese: "sach", reviewCount: 1, learningLevel: 2, nextReview: date(86400000), createdAt: date(-86400000) },
	{ english: "water", vietnamese: "nuoc", reviewCount: 0, learningLevel: 0, lastReviewedAt: null, nextReview: date(-86400000), createdAt: date(-86400000) },
].map((word, index) => ({ ...word, _id: String(index + 1).padStart(24, "0"), topic: topicId, status: false }));

async function setup(browser, width, locale, theme) {
	const page = await browser.newPage({ viewport: { width, height: width < 768 ? 740 : 900 }, hasTouch: width < 768, colorScheme: theme });
	page.setDefaultTimeout(10000);
	const errors = [], posts = [];
	page.on("pageerror", error => errors.push(error.message));
	page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
	await page.addInitScript(theme => localStorage.setItem("studyjony-theme", theme), theme);
	await page.route("https://va.vercel-scripts.com/**", route => route.fulfill({ body: "", contentType: "application/javascript" }));
	await page.route("**/api/v1/**", route => {
		const url = new URL(route.request().url());
		if (url.pathname.endsWith("/users/me")) return route.fulfill({ json: { data: { user: { _id: "learner", name: "Learner", theme } } } });
		if (url.pathname === "/api/v1/vocab") return route.fulfill({ json: { data: { vocabularies: words } } });
		if (url.pathname.endsWith("/review")) {
			posts.push({ wordId: url.pathname.split("/").at(-2), input: route.request().postDataJSON() });
			return route.fulfill({ json: { status: "success", data: { updatedVocab: words.find(word => word._id === posts.at(-1).wordId), correct: true, xp: { awarded: 0, total: 0 } } } });
		}
		return route.fulfill({ json: { data: {} } });
	});
	async function checks() {
		await page.waitForFunction(theme => document.documentElement.dataset.theme === theme, theme);
		assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "No horizontal overflow");
		assert.deepEqual(errors, [], "No hydration/runtime/console errors");
	}
	return { page, posts, checks, prefix: locale === "en" ? "/en" : "" };
}

async function checkSession(context, messages, mode, scope, dueOnly) {
	const { page, posts, prefix, checks } = context;
	const t = messages.WordlistReview;
	posts.length = 0;
	const route = scope === "global" ? `/wordlist/review/${mode}` : `/wordlist/${topicId}/learn/${mode}`;
	await page.goto(`${baseURL}${prefix}${route}${dueOnly ? "?reviewMode=due" : ""}`);
	const expected = dueOnly ? words.slice(0, 2) : scope === "global" ? words : [words[0], words[1], words[3]];
	for (const [index, word] of expected.entries()) {
		await page.getByText(`${index + 1} / ${expected.length}`, { exact: true }).waitFor();
		if (mode === "flashcard") {
			const card = page.getByRole("button", { name: t.flashcard.reveal, exact: true });
			await card.locator("[aria-hidden=false]").getByText(word.english, { exact: true }).waitFor();
			await card.click();
			await page.getByRole("button", { name: new RegExp(t.flashcard.remembered) }).click();
		} else {
			if (mode === "write") await page.locator("#write-answer").fill(word.english);
			else await page.getByRole("button", { name: new RegExp(word.vietnamese) }).click();
			await page.getByRole("button", { name: t.common.check, exact: true }).click();
		}
	}
	await page.getByRole("heading", { name: mode === "quiz" ? t.quiz.completionTitle : t.common.completionTitle, exact: true }).waitFor();
	assert.deepEqual(posts.map(post => post.wordId), expected.map(word => word._id));
	assert.ok(posts.every(post => post.input.mode === (mode === "write" ? "writing" : mode) && post.input.practice === false));
	await checks();
}

async function checkCounts(context, messages, width) {
	const { page, prefix, checks } = context;
	const t = messages.Notebook;
	await page.goto(`${baseURL}${prefix}/wordlist`);
	await page.getByRole("button", { name: t.addWord, exact: true }).waitFor();
	for (const [label, value] of [[t.total, "4"], [t.learning, "1"], [t.dueToday, "2"]]) {
		assert.equal(await page.getByRole("heading", { name: label, exact: true }).locator("..").locator("strong").innerText(), value);
	}
	assert.equal(await page.locator('main [data-status="review"]:visible').count(), 2);
	if (width < 640) await page.getByRole("button", { name: t.new, exact: true }).click();
	else {
		await page.getByRole("button", { name: `${t.status}: ${t.review}`, exact: true }).click();
		await page.getByRole("option", { name: t.new, exact: true }).click();
	}
	assert.equal(await page.locator('main [data-status="new"]:visible').count(), 1);
	await checks();
	await page.goto(`${baseURL}${prefix}/wordlist/${topicId}`);
	const detail = messages.WordlistDetail;
	for (const [label, value] of [[detail.total, "4"], [detail.new, "1"], [detail.learning, "1"], [detail.review, "2"]]) {
		const count = page.locator("p").filter({ hasText: new RegExp(`^${label}$`) }).first();
		await count.waitFor();
		assert.equal(await count.evaluate(element => element.parentElement.querySelector("p").textContent), value);
	}
	await page.getByRole("combobox").selectOption("review");
	await page.waitForURL(/status=review/);
	await page.getByText("water", { exact: true }).waitFor({ state: "hidden" });
	await page.getByText("hello", { exact: true }).first().waitFor();
	assert.equal(await page.getByText("water", { exact: true }).count(), 0);
	await checks();
}

(async () => {
	const browser = await chromium.launch({ channel: "chrome", headless: true });
	let sessions = 0, countChecks = 0;
	try {
		for (const width of [320, 375, 430, 768, 1280]) for (const locale of ["vi", "en"]) for (const theme of ["light", "dark"]) {
			const context = await setup(browser, width, locale, theme);
			try {
				const messages = require(`../messages/${locale}.json`);
				await checkCounts(context, messages, width);
				countChecks += 2;
				for (const scope of ["global", "topic"]) for (const mode of ["flashcard", "quiz", "write"]) for (const dueOnly of [true, false]) {
					await checkSession(context, messages, mode, scope, dueOnly);
					sessions += 1;
				}
				console.log(`PASS ${width}px ${locale} ${theme}: global/topic counts and all 3 Due/All review modes`);
			} finally { await context.page.close(); }
		}
		console.log(`PASS: ${sessions} completed sessions and ${countChecks} Wordlist count/filter checks`);
	} finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
