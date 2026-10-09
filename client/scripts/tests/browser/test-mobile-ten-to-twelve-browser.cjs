// Run with Playwright available and Next dev running on localhost:3000.
// API calls are mocked; no live account or word data is changed.
// Optionally set STUDYJONY_DIALOG_BASELINE to a temp JSON path and
// STUDYJONY_CAPTURE_BASELINE=1 before edits to capture tablet/desktop geometry.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const baseURL = process.env.STUDYJONY_TEST_URL || "http://localhost:3000";
const topicId = "000000000000000000000099";
const word = { _id: "000000000000000000000001", english: "coffee", vietnamese: "cà phê",
	example: "I like coffee.", nextReview: "2020-01-01", reviewCount: 0 };
const longName = "Nguyễn Thanh Sơn Very Long Learner Name ".repeat(4) + "LongUnbrokenName".repeat(8);
const longEmail = "verylongemailaddress".repeat(6) + "@studyjony-example.com";
const baseline = {};

async function setup(browser, width, height, locale, theme, longAccount = false) {
	const page = await browser.newPage({ viewport: { width, height }, isMobile: width < 768,
		hasTouch: width < 768, deviceScaleFactor: width < 768 ? 3 : 1, colorScheme: theme,
		...(width < 768 ? { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1" } : {}),
	});
	const errors = [], writes = [];
	let user = { _id: "learner", name: longAccount ? longName : "Learner",
		email: longAccount ? longEmail : "learner@example.com", theme };
	page.on("pageerror", error => errors.push(error.message));
	page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
	await page.addInitScript(theme => {
		localStorage.setItem("studyjony-theme", theme);
		const viewport = new EventTarget();
		let heightOverride, offsetTop = 0;
		Object.defineProperty(viewport, "height", { get: () => heightOverride ?? innerHeight });
		Object.defineProperty(viewport, "offsetTop", { get: () => offsetTop });
		Object.defineProperty(window, "visualViewport", { configurable: true, value: viewport });
		window.setTestVisualViewport = (height, top = 0) => {
			heightOverride = height; offsetTop = top;
			viewport.dispatchEvent(new Event("resize"));
			viewport.dispatchEvent(new Event("scroll"));
		};
	}, theme);
	await page.route("https://accounts.google.com/**", route => route.abort());
	await page.route("**/api/v1/**", route => {
		const url = new URL(route.request().url()), method = route.request().method();
		if (method !== "GET") writes.push({ path: url.pathname, method, body: route.request().postDataJSON() });
		if (url.pathname === "/api/v1/users/updateMe") {
			user = { ...user, ...route.request().postDataJSON() };
			return route.fulfill({ json: { data: { user } } });
		}
		if (url.pathname === "/api/v1/users/me") return route.fulfill({ json: { data: { user } } });
		if (url.pathname === "/api/v1/study-activities") return route.fulfill({ json: { data: { activities: [] } } });
		if (url.pathname.startsWith("/api/v1/dictionary/")) return route.fulfill({ json: { data: { vietnamese: "cà phê", example: "I like coffee." } } });
		if (url.pathname === "/api/v1/vocab") return route.fulfill({ json: { data: {
			vocabularies: [word], newVocab: { ...word, _id: "000000000000000000000002", ...(method === "POST" ? route.request().postDataJSON() : {}) },
		} } });
		return route.fulfill({ json: { data: {} } });
	});
	await page.route("**/data/english_words.json", route => route.fulfill({ json: ["coffee", "coffees"] }));
	const prefix = locale === "en" ? "/en" : "";
	async function ready() { await page.waitForFunction(theme => document.documentElement.dataset.theme === theme, theme); }
	async function noOverflow() {
		assert.equal(await page.evaluate(() => innerWidth), width, "Phone viewport must not expand");
		assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "No horizontal overflow");
	}
	async function finish() { await noOverflow(); assert.deepEqual(errors, []); await page.close(); }
	return { page, prefix, ready, finish, noOverflow, writes };
}

async function geometry(locators) {
	const result = {};
	for (const [name, locator] of Object.entries(locators)) result[name] = await locator.evaluate(element => {
		const rect = element.getBoundingClientRect(), style = getComputedStyle(element);
		return { x: rect.x, y: rect.y, width: rect.width, height: rect.height,
			fontSize: style.fontSize, padding: style.padding, borderRadius: style.borderRadius, overflowY: style.overflowY };
	});
	return result;
}

async function checkVisibleViewport(page, overlay, input, action, width) {
	for (const [height, top] of [[260, 0], [220, 54]]) {
		await input.focus();
		await page.evaluate(([height, top]) => window.setTestVisualViewport(height, top), [height, top]);
		await page.waitForFunction(({ height, top }) => [...document.querySelectorAll('div[role="dialog"]')].some(element => {
			const rect = element.getBoundingClientRect(); return Math.abs(rect.height - height) < 1 && Math.abs(rect.top - top) < 1;
		}), { height, top });
		for (const target of [input, action]) {
			await target.evaluate(element => element.scrollIntoView({ block: "nearest" }));
			await target.click({ trial: true });
			const bounds = await target.boundingBox();
			assert.ok(bounds.y >= top - 1 && bounds.y + bounds.height <= top + height + 1,
				`Input/action must fit visible viewport: ${JSON.stringify({ height, top, bounds, target: await target.getAttribute("name"), overlay: await overlay.boundingBox() })}`);
			assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width);
		}
		assert.ok(await overlay.evaluate(element => element.scrollHeight > element.clientHeight), "Keyboard overlay scrolls");
	}
	await page.evaluate(() => window.setTestVisualViewport(innerHeight, 0));
}

async function checkProfile(browser, width, height, locale, theme, capture = false) {
	const { page, prefix, ready, finish, writes } = await setup(browser, width, height, locale, theme, width < 768);
	const t = require(`../../../messages/${locale}.json`).Profile;
	await page.goto(`${baseURL}${prefix}/profile`);
	const heading = page.locator("h1"), edit = heading.locator("..").getByRole("button");
	await heading.getByText(width < 768 ? longName : "Learner", { exact: true }).waitFor();
	await ready();
	if (width < 768) {
		assert.ok(await heading.evaluate(element => element.scrollWidth <= element.clientWidth), "Full long name wraps");
		const email = page.getByText(longEmail, { exact: true });
		assert.ok(await email.evaluate(element => element.getBoundingClientRect().right <= innerWidth));
		assert.ok(await edit.evaluate(element => {
			const rect = element.getBoundingClientRect(), name = element.previousElementSibling.getBoundingClientRect();
			return rect.left >= name.right && rect.right <= innerWidth && rect.width >= 18;
		}), "Edit action stays beside name and inside viewport");
	}
	const account = await geometry({ name: heading, edit });
	await edit.click();
	const input = page.locator('input[type="text"]');
	const overlay = page.locator("div.fixed").filter({ has: input }).last();
	const card = input.locator("..");
	const save = card.getByRole("button", { name: t.save, exact: true });
	if (width < 768) {
		assert.ok(await input.evaluate(element => parseFloat(getComputedStyle(element).fontSize) >= 16));
		await checkVisibleViewport(page, overlay, input, save, width);
		await input.fill("Updated Learner");
		await page.evaluate(() => window.setTestVisualViewport(220, 54));
		await save.evaluate(element => element.scrollIntoView({ block: "nearest" }));
		await save.click();
		await heading.getByText("Updated Learner", { exact: true }).waitFor();
		assert.deepEqual(writes[0].body, { name: "Updated Learner" });
	} else {
		const key = `profile-${width}-${locale}-${theme}`;
		const snapshot = { account, dialog: await geometry({ card, input, save }) };
		if (capture) baseline[key] = snapshot;
		else if (process.env.STUDYJONY_DIALOG_BASELINE) assert.deepEqual(snapshot, baseline[key], "Profile tablet/desktop geometry unchanged");
		await page.evaluate(() => window.setTestVisualViewport(220, 54));
		assert.deepEqual(await geometry({ card, input, save }), snapshot.dialog, "Desktop ignores mobile viewport overrides");
		await card.getByRole("button", { name: t.close, exact: true }).click();
	}
	await finish();
}

async function checkWordlist(browser, width, height, locale, theme, capture = false) {
	const { page, prefix, ready, finish } = await setup(browser, width, height, locale, theme);
	const t = require(`../../../messages/${locale}.json`).Notebook;
	await page.goto(`${baseURL}${prefix}/wordlist`);
	const add = page.getByRole("button", { name: t.addWord, exact: true });
	await add.waitFor(); await ready();
	for (const mode of ["add", "edit"]) {
		if (mode === "add") await add.click();
		else await page.getByRole("button", { name: `${t.edit} coffee`, exact: true }).click();
		const dialog = page.getByRole("dialog");
		const fields = dialog.locator("input,textarea");
		for (const field of await fields.all()) {
			assert.equal(await field.evaluate(element => parseFloat(getComputedStyle(element).fontSize)), width < 768 ? 16 : 15);
			await field.focus();
		}
		if (width < 768) {
			assert.equal(await page.evaluate(() => window.visualViewport.height), height);
			await page.setViewportSize({ width, height: 260 });
			const save = dialog.getByRole("button", { name: t.save, exact: true });
			await save.scrollIntoViewIfNeeded(); await save.click({ trial: true });
			const bounds = await save.boundingBox();
			assert.ok(bounds.y >= 0 && bounds.y + bounds.height <= 260);
			await page.setViewportSize({ width, height });
		} else {
			const key = `wordlist-${mode}-${width}-${locale}-${theme}`;
			const snapshot = await geometry({ dialog, input: fields.first(), textarea: fields.last(), save: dialog.getByRole("button", { name: t.save, exact: true }) });
			if (capture) baseline[key] = snapshot;
			else if (process.env.STUDYJONY_DIALOG_BASELINE) assert.deepEqual(snapshot, baseline[key], "Native word dialog tablet/desktop geometry unchanged");
		}
		await dialog.getByRole("button", { name: t.close, exact: true }).click();
	}
	await finish();
}

async function checkTopic(browser, width, height, locale, theme, capture = false) {
	const { page, prefix, ready, finish, writes } = await setup(browser, width, height, locale, theme);
	const t = require(`../../../messages/${locale}.json`).WordlistDetail;
	await page.goto(`${baseURL}${prefix}/wordlist/${topicId}`);
	const add = page.getByRole("button", { name: t.addNew, exact: true });
	await add.waitFor(); await ready(); await add.click();
	const form = page.locator("form");
	const overlay = form.locator("..");
	const input = form.locator('input[name="word"]');
	const submit = form.locator('button[type="submit"]');
	if (width < 768) {
		for (const field of await form.locator("input,textarea").all()) {
			assert.ok(await field.evaluate(element => parseFloat(getComputedStyle(element).fontSize) >= 16));
			await checkVisibleViewport(page, overlay, field, submit, width);
		}
		await input.fill("coffee");
		const suggestion = form.getByRole("button", { name: "coffee", exact: true });
		await suggestion.click();
		await form.locator('input[name="translation"]').fill("cà phê");
		await form.locator("textarea").fill("I like coffee.");
		await page.evaluate(() => window.setTestVisualViewport(220, 54));
		await submit.evaluate(element => element.scrollIntoView({ block: "nearest" }));
		if (process.env.STUDYJONY_SCREENSHOTS && width === 320 && height === 480 && locale === "en") {
			await page.screenshot({ path: path.join(process.env.STUDYJONY_SCREENSHOTS, `topic-keyboard-${theme}.png`) });
		}
		await submit.click();
		await form.waitFor({ state: "detached" });
		assert.ok(writes.some(write => write.body.english === "coffee" && write.body.topic === topicId), "Add submits expected word/topic");
	} else {
		const key = `topic-${width}-${locale}-${theme}`;
		const snapshot = await geometry({ form, input, textarea: form.locator("textarea"), submit });
		if (capture) baseline[key] = snapshot;
		else if (process.env.STUDYJONY_DIALOG_BASELINE) assert.deepEqual(snapshot, baseline[key], "Topic tablet/desktop geometry unchanged");
		await page.evaluate(() => window.setTestVisualViewport(220, 54));
		assert.deepEqual(await geometry({ form, input, textarea: form.locator("textarea"), submit }), snapshot);
		await form.getByRole("button", { name: t.form.close, exact: true }).click();
	}
	await finish();
}

async function run() {
	const capture = process.env.STUDYJONY_CAPTURE_BASELINE === "1";
	if (!capture && process.env.STUDYJONY_DIALOG_BASELINE) Object.assign(baseline, JSON.parse(fs.readFileSync(process.env.STUDYJONY_DIALOG_BASELINE, "utf8")));
	const browser = await chromium.launch({ channel: "chrome", headless: true });
	try {
		if (!capture) for (const width of [320, 375, 430]) for (const height of [480, 740])
			for (const locale of ["vi", "en"]) for (const theme of ["light", "dark"]) {
				await checkProfile(browser, width, height, locale, theme);
				await checkWordlist(browser, width, height, locale, theme);
				await checkTopic(browser, width, height, locale, theme);
				console.log(`PASS ${width}x${height} ${locale} ${theme}: long profile, 16px forms, keyboard actions`);
			}
		for (const width of [768, 1280]) for (const locale of ["vi", "en"]) for (const theme of ["light", "dark"]) {
			await checkProfile(browser, width, 800, locale, theme, capture);
			await checkWordlist(browser, width, 800, locale, theme, capture);
			await checkTopic(browser, width, 800, locale, theme, capture);
			console.log(`PASS ${width}px ${locale} ${theme}: tablet/desktop geometry`);
		}
		if (capture) fs.writeFileSync(process.env.STUDYJONY_DIALOG_BASELINE, JSON.stringify(baseline, null, 2));
	} finally { await browser.close(); }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
