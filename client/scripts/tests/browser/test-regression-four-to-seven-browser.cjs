// Next dev + Playwright required. All account, dictionary and progress APIs are mocked.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const baseURL = process.env.STUDYJONY_TEST_URL || "http://localhost:3000";
const pixel = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=", "base64");
const fixtures = [
	["coffee-shop", "ordering-a-coffee", "dialogues"],
	["ten-minutes-a-day", "the-old-book", "stories"],
].map(([course, dialogue, type]) => ({ course, dialogue, data: require(`../../../app/[locale]/(main)/dialogue/_data/${type}/${course}/${dialogue}.json`) }));
function deferred() { let resolve; const promise = new Promise(done => resolve = done); return { promise, resolve }; }
const frame = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

async function setup(browser, width, locale, theme) {
	const page = await browser.newPage({ viewport: { width, height: 740 }, hasTouch: width < 768, colorScheme: theme });
	page.setDefaultTimeout(15000);
	const errors = [];
	let user = { _id: "A", name: "Account A", email: "a@example.com", theme };
	let handler;
	page.on("pageerror", error => errors.push(error.message));
	page.on("console", message => {
		if (message.type() !== "error") return;
		if (message.text().startsWith("Failed to load resource") && message.location().url.includes("/api/v1/")) return;
		errors.push(message.text());
	});
	await page.addInitScript(theme => localStorage.setItem("studyjony-theme", theme), theme);
	await page.route("https://va.vercel-scripts.com/**", route => route.fulfill({ contentType: "application/javascript", body: "" }));
	await page.route("https://accounts.google.com/**", route => route.fulfill({ contentType: "application/javascript", body: "window.google={accounts:{oauth2:{initCodeClient:()=>({requestCode(){}})}}};" }));
	await page.route("**/test-*.png", route => route.fulfill({ contentType: "image/png", body: pixel }));
	await page.route("**/data/english_words.json", route => route.fulfill({ json: ["apple", "book", "banana"] }));
	await page.route("**/api/v1/**", async route => {
		const path = new URL(route.request().url()).pathname;
		if (handler && await handler(route, path)) return;
		if (path.endsWith("/users/me")) return route.fulfill({ json: { data: { user } } });
		if (path.endsWith("/auth/logout")) { user = null; return route.fulfill({ json: { status: "success" } }); }
		if (path.endsWith("/auth/login")) { user = { _id: "B", name: "Account B", email: "b@example.com", theme }; return route.fulfill({ json: { status: "success", data: { user } } }); }
		return route.fulfill({ json: { data: { progress: [], activities: [], vocabularies: [] } } });
	});
	const messages = require(`../../../messages/${locale}.json`);
	const prefix = locale === "en" ? "/en" : "";
	async function goto(route) {
		await page.goto(baseURL + prefix + route, { timeout: 60000, waitUntil: "domcontentloaded" });
		await page.locator("header.sticky button.group").waitFor();
		await page.waitForFunction(theme => document.documentElement.dataset.theme === theme, theme);
	}
	async function finish() {
		assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "No horizontal overflow");
		assert.deepEqual(errors, [], "No hydration/runtime errors");
		await page.close();
	}
	return { page, messages, prefix, goto, finish, handle: value => handler = value };
}

async function progressCase(browser, width, locale, theme, fixture, type) {
	const c = await setup(browser, width, locale, theme), p = c.page, t = c.messages.DialogueFeature;
	const task = fixture.data.tasks.find(task => task.type === type);
	const started = deferred(), first = deferred(), retry = deferred(), retryStarted = deferred();
	let requests = 0;
	c.handle(async (route, path) => {
		if (path.endsWith("/attempt")) {
			await route.fulfill({ json: { data: { attemptId: "a".repeat(64), expiresAt: new Date(Date.now() + 600000).toISOString(), readyAfterMs: 0 } } });
			return true;
		}
		if (route.request().method() !== "PATCH" || !path.includes("/dialogue-progress/")) return false;
		const number = ++requests;
		if (number === 1) { started.resolve(); await first.promise; await route.fulfill({ status: 403, json: { message: "Test permanent save failure" } }); }
		else { retryStarted.resolve(); await retry.promise; await route.fulfill({ json: { data: { progress: { lessonId: fixture.course, dialogueId: fixture.dialogue, completedTaskIds: [String(task.id)] }, xp: { awarded: 10 } } } }); }
		return true;
	});
	await c.goto(`/dialogue/${fixture.course}/${fixture.dialogue}/${task.id}`);
	if (type === "fillBlank") {
		for (const [index, answer] of (task.answers || [task.answer]).entries()) await p.locator('input[placeholder="..."]').nth(index).fill(answer);
	} else if (type === "multipleChoice") {
		await p.locator("div.mt-6.overflow-hidden.rounded-xl > button").nth(task.options.indexOf(task.answer)).click();
	} else {
		await p.getByRole("button", { name: t.typeAnswer, exact: true }).click();
		const answers = task.lines.flatMap(line => line.parts.filter(part => typeof part === "object").map(part => part.blank));
		for (const [index, answer] of answers.entries()) await p.locator('section input').nth(index).fill(answer);
	}
	await p.getByRole("button", { name: t.check, exact: true }).click();
	await started.promise;
	assert.equal(await p.locator("div.mx-auto.mt-4.w-full.max-w-6xl").count(), 0, "Saving reserves no banner space");
	const continuation = fixture.data.tasks.at(-1).id === task.id ? t.completeDialogue : t.continueArrow;
	await p.getByRole("link", { name: continuation, exact: true }).waitFor();
	first.resolve();
	await p.getByRole("alert").filter({ hasText: t.progressSaveFailed }).waitFor();
	await p.getByRole("link", { name: continuation, exact: true }).waitFor();
	const retryButton = p.getByRole("alert").getByRole("button", { name: t.retryProgressSave, exact: true });
	await retryButton.evaluate(button => { button.click(); button.click(); button.click(); });
	await p.getByRole("alert").filter({ hasText: t.progressSaveFailed }).waitFor({ state: "hidden" });
	assert.equal(await p.getByText(t.progressSaving, { exact: true }).count(), 0);
	await retryStarted.promise;
	assert.equal(requests, 2);
	await p.getByRole("link", { name: continuation, exact: true }).waitFor();
	await p.getByRole("link", { name: continuation, exact: true }).click();
	const index = fixture.data.tasks.indexOf(task), next = fixture.data.tasks[index + 1];
	await p.waitForURL(url => url.pathname === `${c.prefix}/dialogue/${fixture.course}/${fixture.dialogue}/${next ? next.id : "useful-words"}`);
	retry.resolve();
	await p.waitForFunction(() => Object.keys(localStorage).filter(key => key.startsWith("studyjony-progress-v1:")).every(key => JSON.parse(localStorage.getItem(key)).status === "saved"));
	assert.equal(await p.locator("div.mx-auto.mt-4.w-full.max-w-6xl").count(), 0);
	assert.equal(requests, 2);
	await c.finish();
}

async function profileCase(browser, width, locale, theme, mutation, loginB) {
	const c = await setup(browser, width, locale, theme), p = c.page, t = c.messages.Profile;
	const started = deferred(), release = deferred();
	let mutationRequests = 0;
	c.handle(async (route, path) => {
		if (!path.endsWith(mutation === "name" ? "/users/updateMe" : "/users/avatar")) return false;
		if (++mutationRequests > 1) {
			await route.fulfill({ json: { status: "success", data: { user: { _id: "B", name: mutation === "name" ? "Updated B" : "Account B", email: "b@example.com", theme, ...(mutation === "avatar" ? { avatar: "https://avatar.test/test-b.png" } : {}) } } } });
			return true;
		}
		started.resolve(); await release.promise;
		await route.fulfill({ json: { status: "success", data: { user: { _id: "A", name: "Changed Account A", email: "a@example.com", theme, ...(mutation === "avatar" ? { avatar: "https://avatar.test/test-a.png" } : {}) } } } });
		return true;
	});
	await c.goto("/profile");
	if (mutation === "name") {
		await p.getByRole("button", { name: t.updateName, exact: true }).click();
		await p.getByRole("dialog").locator("input").fill("Changed Account A");
		await p.getByRole("dialog").getByRole("button", { name: t.save, exact: true }).click();
		await started.promise;
		await p.getByRole("dialog").getByRole("button", { name: t.close, exact: true }).click();
	} else {
		await p.locator('input[type="file"]').setInputFiles({ name: "test.png", mimeType: "image/png", buffer: pixel });
		await started.promise;
	}
	await p.locator("header.sticky button.group").click();
	await p.getByRole("button", { name: c.messages.Header.logout, exact: true }).click();
	await p.waitForURL(url => url.pathname === `${c.prefix || ""}/` || url.pathname === c.prefix);
	if (loginB) {
		await p.locator('header a[href$="/login"]').first().evaluate(link => link.click());
		await p.locator('#login-email').fill("b@example.com");
		await p.locator('#login-password').fill("password-123");
		await p.locator('form').getByRole("button", { name: c.messages.Auth.login, exact: true }).click();
		await p.waitForURL(/\/wordlist$/);
		await p.locator("header.sticky button.group").waitFor();
	}
	const late = p.waitForResponse(response => response.url().endsWith(mutation === "name" ? "/users/updateMe" : "/users/avatar"));
	release.resolve(); await late; await frame(p);
	assert.equal(await p.getByText("Changed Account A", { exact: true }).count(), 0);
	assert.equal(await p.locator('header img[src="https://avatar.test/test-a.png"]').count(), 0);
	if (loginB) {
		assert.ok(await p.locator("header").getByText("Account B", { exact: true }).count());
		await p.locator("header.sticky button.group").click();
		await p.getByRole("button", { name: c.messages.Header.profile, exact: true }).click();
		await p.getByRole("heading", { name: "Account B", exact: true }).waitFor();
		if (mutation === "name") {
			await p.getByRole("button", { name: t.updateName, exact: true }).click();
			await p.getByRole("dialog").locator("input").fill("Updated B");
			await p.getByRole("dialog").getByRole("button", { name: t.save, exact: true }).click();
			await p.getByRole("heading", { name: "Updated B", exact: true }).waitFor();
		} else {
			await p.locator('input[type="file"]').setInputFiles({ name: "test-b.png", mimeType: "image/png", buffer: pixel });
			await p.locator('main img[src="https://avatar.test/test-b.png"], div img[src="https://avatar.test/test-b.png"]').first().waitFor();
		}
	} else assert.equal(await p.locator("header.sticky button.group").count(), 0);
	await c.finish();
}

async function dictionaryCase(browser, width, locale, theme) {
	const c = await setup(browser, width, locale, theme), p = c.page, t = c.messages.WordlistDetail;
	const requests = [];
	let onRequest;
	c.handle(async (route, path) => {
		if (!path.includes("/dictionary/")) return false;
		const reply = deferred(); requests.push({ word: path.split("/").at(-1), reply });
		onRequest?.(requests.at(-1));
		const response = await reply.promise; await route.fulfill(response); return true;
	});
	await c.goto("/wordlist/000000000000000000000099");
	await p.getByRole("button", { name: t.addNew, exact: true }).click();
	const dialog = p.getByRole("dialog"), input = dialog.locator('[name="word"]'), meaning = dialog.locator('[name="translation"]'), example = dialog.locator('[name="example"]');
	async function select(word) {
		const arrived = deferred(); onRequest = arrived.resolve;
		await input.fill(word.slice(0, 2));
		await dialog.getByRole("button", { name: word, exact: true }).click();
		// The loading state proves that the selection handler has run.
		await dialog.getByRole("status").waitFor();
		return arrived.promise;
	}
	const response = value => ({ json: { data: { vietnamese: value, example: `${value} example`, pronunciation: `${value} ipa` } } });
	const apple = await select("apple"), book = await select("book");
	apple.reply.resolve({ status: 500, json: { message: "stale failure" } }); await frame(p);
	assert.equal(await meaning.inputValue(), "");
	assert.equal(await dialog.getByRole("alert").count(), 0);
	assert.equal(await dialog.getByRole("button", { name: t.form.add, exact: true }).isDisabled(), true);
	book.reply.resolve(response("BOOK"));
	await p.waitForFunction(() => document.querySelector('[name="translation"]').value === "BOOK");
	const older = await select("apple"), latest = await select("apple");
	latest.reply.resolve(response("LATEST APPLE"));
	await p.waitForFunction(() => document.querySelector('[name="translation"]').value === "LATEST APPLE");
	older.reply.resolve(response("OLD APPLE")); await frame(p);
	assert.equal(await meaning.inputValue(), "LATEST APPLE");
	assert.equal(await example.inputValue(), "LATEST APPLE example");
	const edited = await select("book");
	await input.fill("banana");
	edited.reply.resolve(response("STALE BOOK")); await frame(p);
	assert.equal(await input.inputValue(), "banana"); assert.equal(await meaning.inputValue(), "");
	const failed = await select("book"); failed.reply.resolve({ status: 500, json: { message: "latest failure" } });
	await dialog.getByRole("alert").filter({ hasText: t.form.lookupError }).waitFor();
	const retried = await select("book"); retried.reply.resolve(response("RETRIED BOOK"));
	await p.waitForFunction(() => document.querySelector('[name="translation"]').value === "RETRIED BOOK");
	assert.equal(await dialog.getByRole("alert").count(), 0);
	const closing = await select("apple"); await dialog.getByRole("button", { name: t.form.cancel, exact: true }).click();
	closing.reply.resolve(response("CLOSED APPLE")); await frame(p);
	await p.getByRole("button", { name: t.addNew, exact: true }).click();
	assert.equal(await meaning.inputValue(), "");
	await dialog.getByRole("button", { name: t.form.cancel, exact: true }).click();
	await c.finish();
}

(async () => {
	const browser = await chromium.launch({ channel: "chrome", headless: true });
	let checks = 0;
	try {
		for (const width of process.env.STUDYJONY_TEST_WIDTHS?.split(",").map(Number) || [320, 375, 430, 768, 1280]) for (const locale of ["vi", "en"]) for (const theme of ["light", "dark"]) {
			for (const fixture of fixtures) for (const type of ["fillBlank", "multipleChoice", "dialogueCloze"]) { await progressCase(browser, width, locale, theme, fixture, type); checks += 1; }
			if (process.env.STUDYJONY_TEST_GROUP !== "progress") {
				for (const mutation of ["name", "avatar"]) for (const loginB of [false, true]) { await profileCase(browser, width, locale, theme, mutation, loginB); checks += 1; }
				await dictionaryCase(browser, width, locale, theme); checks += 1;
			}
			console.log(`PASS ${width}px ${locale} ${theme}: Dialogue/Story retry+navigation${process.env.STUDYJONY_TEST_GROUP === "progress" ? "" : ", profile logout/account switch, dictionary races"}`);
		}
		console.log(`PASS ${checks} browser cases`);
	} finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
