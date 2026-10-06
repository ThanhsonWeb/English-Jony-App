// Next dev + Playwright required. API and Google SDK responses are mocked.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const baseURL = process.env.STUDYJONY_TEST_URL || "http://localhost:3000";
const frame = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
function deferred() { let resolve; const promise = new Promise(done => resolve = done); return { resolve, promise }; }
async function setup(browser, width, locale, theme, guest = false) {
	const page = await browser.newPage({ viewport: { width, height: 740 }, hasTouch: width < 768, colorScheme: theme });
	page.setDefaultTimeout(15000);
	const messages = require(`../messages/${locale}.json`), prefix = locale === "en" ? "/en" : "";
	const account = { _id: "000000000000000000000001", name: "Normal learner", email: "normal@example.com", theme };
	let restoreMode = guest ? "missing" : "valid", handler;
	const errors = [];
	page.on("pageerror", error => errors.push(error.message));
	page.on("console", message => {
		if (message.type() !== "error") return;
		if (message.text().startsWith("Failed to load resource") && message.location().url.includes("/api/v1/")) return;
		errors.push(message.text());
	});
	await page.addInitScript(theme => localStorage.setItem("studyjony-theme", theme), theme);
	await page.route("https://va.vercel-scripts.com/**", route => route.fulfill({ contentType: "application/javascript", body: "" }));
	await page.route("https://accounts.google.com/**", route => route.fulfill({ contentType: "application/javascript", body: "window.google={accounts:{oauth2:{initCodeClient:()=>({requestCode(){}})}}};" }));
	await page.route("**/api/v1/**", async route => {
		const path = new URL(route.request().url()).pathname;
		if (handler && await handler(route, path)) return;
		if (path.endsWith("/users/me")) return restoreMode === "valid"
			? route.fulfill({ json: { status: "success", data: { user: account } } })
			: route.fulfill({ status: 401, json: { status: "fail", message: restoreMode === "missing" ? "please login to access" : "Invalid or expired session. Please log in again." } });
		if (path.endsWith("/auth/logout")) { restoreMode = "missing"; return route.fulfill({ json: { status: "success" } }); }
		return route.fulfill({ json: { data: { progress: [], activities: [], vocabularies: [], topics: [] } } });
	});
	async function goto(path) {
		const me = page.waitForResponse(response => response.url().endsWith("/api/v1/users/me"));
		await page.goto(baseURL + prefix + path, { timeout: 60000 });
		await (await me).finished(); await frame(page);
		await page.waitForFunction(theme => document.documentElement.dataset.theme === theme, theme);
	}
	async function finish() {
		assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "No horizontal overflow");
		assert.deepEqual(errors, [], "No unexpected hydration/runtime errors");
		await page.close();
	}
	return { page, messages, prefix, account, goto, finish, handle: value => handler = value, restore: value => restoreMode = value };
}
async function catalogueCase(browser, width, locale, theme) {
	const c = await setup(browser, width, locale, theme), p = c.page, t = c.messages.DialogueLanding;
	await c.goto("/dialogue");
	const cards = p.locator("main h3");
	assert.equal(await cards.count(), 6);
	const category = key => p.locator("main nav button[aria-pressed]").filter({ has: p.getByText(t.categories[key], { exact: true }) });
	async function select(key, count) { await category(key).click(); await p.waitForFunction(count => document.querySelectorAll("main h3").length === count, count); }
	await select("story", 1);
	const title = locale === "vi" ? "Mười phút mỗi ngày" : "Ten Minutes a Day";
	await p.getByRole("heading", { name: title, exact: true }).waitFor();
	assert.equal((await category("story").locator("span").last().textContent()).trim(), "1", "Category count uses the same metadata matcher");
	const search = p.getByRole("searchbox", { name: t.searchLabel, exact: true });
	await search.fill(title.toLocaleUpperCase(locale)); assert.equal(await cards.count(), 1);
	await search.fill("not-an-active-course"); await p.getByText(t.noResults, { exact: true }).waitFor(); assert.equal(await cards.count(), 0);
	await search.fill(""); await p.locator("main select").selectOption("intermediate"); assert.equal(await cards.count(), 0);
	await p.locator("main select").selectOption("beginner"); await p.getByRole("heading", { name: title, exact: true }).waitFor();
	await p.locator("main select").selectOption("all");
	await select("food", 3);
	for (const id of ["coffee-shop", "grocery-store", "restaurant"]) assert.equal(await p.locator(`main a[href="${c.prefix}/dialogue/${id}"]`).count(), 1);
	const foodTitle = await cards.first().textContent(); await search.fill(foodTitle); assert.equal(await cards.count(), 1); await search.fill("");
	await select("travel", 1); assert.equal(await p.locator(`main a[href="${c.prefix}/dialogue/asking-for-directions"]`).count(), 1);
	await select("office", 0);
	await select("all", 6);
	for (const id of ["weekend-camping", "office-introduction", "at-a-hotel", "the-lost-wallet"]) assert.equal(await p.locator(`main a[href="${c.prefix}/dialogue/${id}"]`).count(), 0);
	await select("story", 1);
	await p.locator(`main a[href="${c.prefix}/dialogue/ten-minutes-a-day"]`).click();
	await p.waitForURL(url => url.pathname === `${c.prefix}/dialogue/ten-minutes-a-day`);
	await p.getByRole("button", { name: locale === "vi" ? /Cuốn sách cũ/i : /The old book/i }).click();
	await p.locator(`a[href="${c.prefix}/dialogue/ten-minutes-a-day/the-old-book"]`).first().waitFor();
	await c.finish();
}
async function loginCase(browser, width, locale, theme) {
	const c = await setup(browser, width, locale, theme, true), p = c.page, t = c.messages.Auth;
	const privateDetails = "PRIVATE_SERVER_DETAILS_AND_STACK";
	const replies = [
		[{ status: 401, json: { status: "fail", message: "Email hoặc mật khẩu không chính xác!" } }, t.invalidCredentials],
		[{ status: 400, json: { status: "fail", message: "Vui lòng nhập đầy đủ email và mật khẩu!" } }, t.credentialsRequired],
		[{ status: 403, json: { status: "fail", message: privateDetails } }, t.loginFailed],
		[{ status: 500, json: { status: "error", message: privateDetails, stack: privateDetails } }, t.loginFailed],
		[{ status: 500, json: { status: "success", data: { user: c.account } } }, t.loginFailed],
		[{ status: 200, json: { status: "error", message: privateDetails } }, t.loginFailed],
		[{ status: 200, json: { status: "success", data: { user: {} } } }, t.loginFailed],
		[{ status: 200, json: { status: "unexpected" } }, t.loginFailed],
		[{ status: 200, contentType: "text/html", body: `<html>${privateDetails}</html>` }, t.loginFailed],
		[null, t.loginFailed],
	];
	const started = deferred(), release = deferred(); let posts = 0;
	c.handle(async (route, path) => {
		if (!path.endsWith("/auth/login")) return false;
		const index = posts++;
		if (index === 0) { started.resolve(); await release.promise; }
		if (index === replies.length) {
			c.restore("valid"); await route.fulfill({ json: { status: "success", data: { user: c.account } } });
		} else if (replies[index][0]) await route.fulfill(replies[index][0]);
		else await route.abort("failed");
		return true;
	});
	await c.goto("/login");
	await p.locator("#login-email").fill(c.account.email); await p.locator("#login-password").fill("password-123");
	const form = p.locator("form");
	for (const [index, [, expected]] of replies.entries()) {
		await form.getByRole("button", { name: t.login, exact: true }).click();
		if (index === 0) {
			await started.promise;
			await form.getByRole("button", { name: t.loggingIn, exact: true }).waitFor();
			assert.equal(await form.getByRole("button", { name: t.loggingIn, exact: true }).isDisabled(), true);
			release.resolve();
		}
		await form.getByRole("button", { name: t.login, exact: true }).waitFor();
		assert.equal(await form.getByRole("button", { name: t.login, exact: true }).isEnabled(), true);
		await form.getByRole("alert").filter({ hasText: expected }).waitFor();
		assert.equal(await p.locator("#login-email").inputValue(), c.account.email);
		assert.equal(await p.getByText(privateDetails, { exact: false }).count(), 0);
		assert.equal(new URL(p.url()).pathname, `${c.prefix}/login`);
		assert.equal(posts, index + 1);
		assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
	}
	await form.getByRole("button", { name: t.login, exact: true }).click();
	await p.waitForURL(url => url.pathname === `${c.prefix}/wordlist`);
	await p.locator("header.sticky button.group").waitFor(); assert.equal(posts, replies.length + 1);
	await c.goto("/wordlist"); await p.locator("header.sticky button.group").waitFor();
	await p.locator("header.sticky button.group").click();
	await p.getByRole("button", { name: c.messages.Header.logout, exact: true }).click();
	await p.waitForURL(url => url.pathname === `${c.prefix}/` || url.pathname === c.prefix);
	await c.goto("/wordlist");
	assert.equal(await p.locator("header.sticky button.group").count(), 0);
	await p.locator('header a[href$="/login"]').first().waitFor({ state: "attached" });
	await c.finish();
}
async function restorationCase(browser, width, locale, theme) {
	const c = await setup(browser, width, locale, theme), p = c.page;
	await c.goto("/wordlist"); await p.locator("header.sticky button.group").waitFor();
	for (const mode of ["expired", "malformed", "missing"]) {
		c.restore(mode); await c.goto("/wordlist");
		assert.equal(await p.locator("header.sticky button.group").count(), 0);
		await p.locator('header a[href$="/login"]').first().waitFor({ state: "attached" });
		assert.equal(await p.getByText(c.account.name, { exact: true }).count(), 0);
	}
	await c.finish();
}
(async () => {
	const browser = await chromium.launch({ channel: "chrome", headless: true });
	let cases = 0;
	try {
		for (const width of [320, 375, 430, 768, 1280]) for (const locale of ["vi", "en"]) for (const theme of ["light", "dark"]) {
			await catalogueCase(browser, width, locale, theme); cases += 1;
			await loginCase(browser, width, locale, theme); cases += 1;
			await restorationCase(browser, width, locale, theme); cases += 1;
			console.log(`PASS ${width}px ${locale} ${theme}: active catalogue filters/routes, login errors/retry, restore/logout`);
		}
		console.log(`PASS ${cases} browser cases`);
	} finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
