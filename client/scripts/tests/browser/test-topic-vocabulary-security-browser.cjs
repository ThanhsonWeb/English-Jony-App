// Local Next + disposable MongoDB/Express; real vocabulary/topic APIs, mocked dictionary lookup.
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const express = require("../../../../server/node_modules/express");
const cookieParser = require("../../../../server/node_modules/cookie-parser");
const jwt = require("../../../../server/node_modules/jsonwebtoken");
const mongoose = require("../../../../server/node_modules/mongoose");
const { MongoMemoryServer } = require("../../../../server/node_modules/mongodb-memory-server");
const User = require("../../../../server/models/userModel");
const Vocab = require("../../../../server/models/vocabModel");
const Topic = require("../../../../server/models/topicModel");
const baseURL = process.env.STUDYJONY_TEST_URL || "http://localhost:3017";
const base = new URL(baseURL);
assert.ok(["localhost", "127.0.0.1"].includes(base.hostname), "Local Next only");
let db, server, browser, sequence = 0;

async function setup(width, locale, theme) {
	await Promise.all([Vocab.deleteMany({}), Topic.deleteMany({}), User.deleteMany({})]);
	const user = await User.create({ name: "Local learner", email: `local-${++sequence}@example.test`, googleId: `local-${sequence}`, theme });
	const context = await browser.newContext({ viewport: { width, height: 800 }, hasTouch: width < 768, colorScheme: theme });
	const page = await context.newPage(), errors = [], posts = [];
	page.setDefaultTimeout(20000);
	await context.addCookies([{ name: "jwt", value: jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: "1h" }), url: baseURL, httpOnly: true, sameSite: "Lax" }]);
	await context.addInitScript(theme => localStorage.setItem("studyjony-theme", theme), theme);
	page.on("pageerror", error => errors.push(error.message));
	page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
	await context.route("**/*", route => new URL(route.request().url()).origin === base.origin ? route.continue()
		: route.fulfill({ contentType: "application/javascript", body: "" }));
	await context.route("**/_vercel/insights/**", route => route.fulfill({ contentType: "application/javascript", body: "" }));
	await context.route("**/data/english_words.json", route => route.fulfill({ json: ["apple", "book", "water"] }));
	await context.route("**/api/v1/**", async route => {
		const request = route.request(), parsed = new URL(request.url());
		if (parsed.pathname.startsWith("/api/v1/dictionary/")) {
			const english = decodeURIComponent(parsed.pathname.split("/").at(-1));
			return route.fulfill({ json: { data: { english, vietnamese: `${english} meaning`, pronunciation: "/test/", example: `${english} example` } } });
		}
		if (!["/api/v1/users/me", "/api/v1/vocab", "/api/v1/topics"].some(path => parsed.pathname === path || parsed.pathname.startsWith(path + "/"))) {
			return route.fulfill({ json: { status: "success", data: { progress: [], activities: [], counts: {} } } });
		}
		if (parsed.pathname === "/api/v1/vocab" && request.method() === "POST") posts.push(request.postDataJSON());
		const headers = await request.allHeaders();
		delete headers.host; delete headers["content-length"];
		const response = await fetch(`http://127.0.0.1:${server.address().port}${parsed.pathname}${parsed.search}`, {
			method: request.method(), headers, ...(request.postData() ? { body: request.postData() } : {}),
		});
		const responseHeaders = Object.fromEntries(response.headers);
		delete responseHeaders["content-length"]; delete responseHeaders["content-encoding"];
		const cookies = response.headers.getSetCookie();
		if (cookies.length) responseHeaders["set-cookie"] = cookies.join("\n");
		await route.fulfill({ status: response.status, headers: responseHeaders, body: Buffer.from(await response.arrayBuffer()) });
	});
	const prefix = locale === "en" ? "/en" : "", messages = require(`../../../messages/${locale}.json`);
	async function goto(path) {
		await page.goto(baseURL + prefix + path, { waitUntil: "domcontentloaded", timeout: 60000 });
		await page.waitForFunction(theme => document.documentElement.dataset.theme === theme, theme);
		await page.locator("header.sticky button.group").waitFor();
	}
	async function finish() {
		assert.deepEqual(errors, [], "No hydration/runtime/console errors");
		assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "No horizontal overflow");
		await context.close();
	}
	return { page, user, messages, goto, finish, posts };
}

async function wordlistCase(width, locale, theme) {
	const c = await setup(width, locale, theme), p = c.page, t = c.messages.Notebook;
	await c.goto("/wordlist");
	await p.getByRole("button", { name: width < 768 && locale === "en" ? "Add your first word" : t.addWord, exact: true }).first().click();
	const dialog = p.getByRole("dialog");
	await dialog.locator('[name="english"]').fill("water");
	await dialog.locator('[name="vietnamese"]').fill("nước");
	await dialog.locator('[name="example"]').fill("Drink water.");
	await dialog.getByRole("button", { name: t.save, exact: true }).click();
	await dialog.waitFor({ state: "hidden" });
	await p.getByText("water", { exact: true }).first().waitFor();
	const [saved] = await Vocab.find({ user: c.user.id }).lean();
	assert.equal(saved.topic, undefined); assert.equal(saved.reviewCount, 0); assert.equal(saved.lastReviewedAt, null);
	assert.equal(await Topic.countDocuments({ user: c.user.id }), 0);
	await p.reload(); await p.getByText("water", { exact: true }).first().waitFor();
	assert.equal(c.posts.length, 1);
	await c.finish();
}

async function topicCase(width, locale, theme) {
	const c = await setup(width, locale, theme), p = c.page, t = c.messages.WordlistDetail;
	const topic = await Topic.create({ user: c.user.id, name: "Owned list" });
	await c.goto(`/wordlist/${topic.id}`);
	await p.getByRole("button", { name: t.addNew, exact: true }).click();
	const dialog = p.getByRole("dialog"), form = dialog.locator("form");
	await dialog.locator('[name="word"]').fill("book");
	await dialog.locator('[name="translation"]').fill("sách");
	await form.evaluate(form => {
		form.requestSubmit();
		form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
		form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
	});
	await dialog.waitFor({ state: "hidden" });
	await p.getByText("book", { exact: true }).first().waitFor();
	assert.equal(c.posts.length, 1);
	const [saved] = await Vocab.find({ user: c.user.id }).lean();
	assert.equal(saved.topic.toString(), topic.id); assert.equal(saved.reviewCount, 0);
	await c.goto("/wordlist"); await p.getByText("book", { exact: true }).first().waitFor();
	await c.finish();
}

async function dictionaryCase(width, locale, theme, withTopic) {
	const c = await setup(width, locale, theme), p = c.page, t = c.messages.MiniDictionary;
	const topic = withTopic ? await Topic.create({ user: c.user.id, name: "Dictionary list" }) : null;
	await c.goto("/wordlist");
	await p.getByRole("button", { name: t.toggle, exact: true }).click();
	const panel = p.getByRole("region", { name: t.title, exact: true });
	await panel.getByRole("combobox").fill("apple");
	await panel.locator("form").evaluate(form => form.requestSubmit());
	await panel.getByText("apple meaning", { exact: true }).waitFor();
	const save = panel.getByRole("button", { name: t.save, exact: true });
	await save.waitFor(); await p.waitForFunction(label => [...document.querySelectorAll('button')].some(button => button.textContent.trim() === label && !button.disabled), t.save);
	await save.evaluate(button => { button.click(); button.click(); button.click(); });
	await panel.getByRole("button", { name: t.saved, exact: true }).waitFor();
	assert.equal(c.posts.length, 1);
	await panel.getByRole("button", { name: t.saved, exact: true }).evaluate(button => button.click());
	await panel.getByRole("button", { name: t.close, exact: true }).click();
	await p.getByText("apple", { exact: true }).first().waitFor();
	const [saved] = await Vocab.find({ user: c.user.id }).lean();
	assert.equal(saved.topic?.toString() ?? null, topic?.id ?? null);
	assert.equal(await Vocab.countDocuments({ user: c.user.id }), 1);
	assert.equal(await Topic.countDocuments({ user: c.user.id }), withTopic ? 1 : 0);
	await c.finish();
}

async function dialogueCase(width, locale, theme) {
	const c = await setup(width, locale, theme), p = c.page, t = c.messages.DialogueFeature;
	await c.goto("/dialogue/asking-for-directions/finding-a-cafe/useful-words");
	const cards = p.locator("main button[aria-pressed]");
	await cards.first().waitFor();
	const count = await cards.count(); assert.ok(count > 0);
	const saveLabel = t.saveWords.replace("{count}", String(count));
	await p.getByRole("button", { name: saveLabel, exact: true }).click();
	await p.getByRole("heading", { name: t.savedWords.replace("{count}", String(count)), exact: true }).waitFor();
	assert.equal(c.posts.length, count);
	const saved = await Vocab.find({ user: c.user.id }).lean();
	assert.equal(saved.length, count);
	for (const word of saved) { assert.equal(word.source, undefined); assert.equal(word.lastReviewedAt, null); }
	assert.ok(c.posts.every(body => body.source?.type === "dialogue"), "Current client payload still works without trusting provenance");
	await p.reload(); await cards.first().waitFor();
	assert.equal(await cards.evaluateAll(cards => cards.every(card => card.disabled)), true, "Already-saved words remain disabled");
	assert.equal(c.posts.length, count);
	await c.finish();
}

(async () => {
	let cases = 0;
	try {
		process.env.JWT_SECRET = "isolated-topic-vocabulary-browser";
		process.env.FRONTEND_URL = baseURL;
		db = await MongoMemoryServer.create({ binary: { version: "7.0.14" } });
		await mongoose.connect(db.getUri(), { dbName: "topic_vocabulary_browser" });
		await Promise.all([User.init(), Topic.init(), Vocab.init()]);
		const app = express();
		app.use("/api/v1", require("../../../../server/middleware/csrfProtection"));
		app.use(express.json()); app.use(cookieParser());
		app.use("/api/v1/users", require("../../../../server/routes/userRoutes"));
		app.use("/api/v1/topics", require("../../../../server/routes/topicRoutes"));
		app.use("/api/v1/vocab", require("../../../../server/routes/vocabRoutes"));
		app.use((error, req, res, next) => res.status(error.statusCode || 500).json({ status: "fail", message: error.message }));
		server = await new Promise(resolve => { const listener = app.listen(0, "127.0.0.1", () => resolve(listener)); });
		browser = await chromium.launch({ channel: "chrome", headless: true });
		for (const width of [375, 1280]) for (const locale of ["vi", "en"]) for (const theme of ["light", "dark"]) {
			await wordlistCase(width, locale, theme); cases++;
			await topicCase(width, locale, theme); cases++;
			await dialogueCase(width, locale, theme); cases++;
			if (width >= 768) for (const withTopic of [false, true]) { await dictionaryCase(width, locale, theme, withTopic); cases++; }
			console.log(`PASS ${width}px ${locale} ${theme}: real API Wordlist/Topic Add Word/Dialogue saves${width >= 768 ? "/Dictionary global+topic" : ""}`);
		}
		console.log(`PASS ${cases} browser cases; disposable database; no production access`);
	} finally {
		await browser?.close();
		if (server) await new Promise(resolve => server.close(resolve));
		await mongoose.disconnect(); await db?.stop();
	}
})().catch(error => { console.error(error); process.exitCode = 1; });
