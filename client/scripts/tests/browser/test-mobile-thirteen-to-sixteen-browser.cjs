// Run with Playwright available and Next dev running on localhost:3000.
// API and Google requests are mocked; no accounts or live progress are changed.
// Optional: STUDYJONY_FINAL_BASELINE=temp JSON path, STUDYJONY_CAPTURE_BASELINE=1
// captures player/empty-card tablet/desktop geometry before their CSS edits.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const baseURL = process.env.STUDYJONY_TEST_URL || "http://localhost:3000";
const en = require("../../../messages/en.json"), vi = require("../../../messages/vi.json");
const baseline = {};

async function setup(browser, width, locale, theme, authenticated = false) {
	const page = await browser.newPage({ viewport: { width, height: 740 }, isMobile: width < 640,
		hasTouch: width < 768, colorScheme: theme });
	const errors = [], submissions = [];
	let authReply = { status: "fail", message: "Email hoặc mật khẩu không chính xác!" };
	page.on("pageerror", error => errors.push(error.message));
	page.on("console", message => {
		// Expected mocked 400/401 auth responses are not browser runtime failures.
		if (message.text().startsWith("Failed to load resource") && message.location().url.includes("/api/v1/")) return;
		if (message.type() === "error") errors.push({ message: message.text(), url: message.location().url });
	});
	await page.addInitScript(theme => {
		localStorage.setItem("studyjony-theme", theme);
		window.google = { accounts: { oauth2: { initCodeClient: () => ({ requestCode() {} }) } } };
	}, theme);
	await page.route("https://accounts.google.com/**", route => route.abort());
	await page.route("https://va.vercel-scripts.com/**", route => route.fulfill({ contentType: "application/javascript", body: "" }));
	await page.route("**/api/v1/**", async route => {
		const url = new URL(route.request().url());
		if (/\/auth\/(login|signup)$/.test(url.pathname)) {
			submissions.push(route.request().postDataJSON());
			await new Promise(resolve => setTimeout(resolve, 400));
			return route.fulfill({ status: authReply.status === "success" ? 200 : 400, json: authReply });
		}
		if (url.pathname === "/api/v1/auth/google/state") return route.fulfill({ status: 400, json: { message: "Test server error" } });
		if (url.pathname === "/api/v1/users/me") return route.fulfill({ status: authenticated ? 200 : 401,
			json: { data: { user: authenticated ? { _id: "learner", name: "Learner", theme } : null } } });
		if (url.pathname === "/api/v1/vocab") return route.fulfill({ json: { data: { vocabularies: [] } } });
		return route.fulfill({ json: { data: {} } });
	});
	const prefix = locale === "en" ? "/en" : "";
	async function ready() {
		await page.waitForFunction(theme => document.documentElement.dataset.theme === theme, theme);
		await page.evaluate(() => document.fonts.ready);
	}
	async function noOverflow() {
		assert.equal(await page.evaluate(() => innerWidth), width);
		assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "No horizontal overflow");
	}
	async function finish() { await noOverflow(); assert.deepEqual(errors, []); await page.close(); }
	return { page, prefix, ready, finish, noOverflow, submissions, setReply: reply => { authReply = reply; } };
}

async function geometry(locators) {
	const result = {};
	for (const [key, locator] of Object.entries(locators)) result[key] = await locator.evaluate(element => {
		const rect = element.getBoundingClientRect(), css = getComputedStyle(element);
		return { x: rect.x, y: rect.y, width: rect.width, height: rect.height,
			fontSize: css.fontSize, padding: css.padding, borderRadius: css.borderRadius };
	});
	return result;
}

function compareBaseline(key, value, capture) {
	if (capture) baseline[key] = value;
	else if (process.env.STUDYJONY_FINAL_BASELINE) assert.deepEqual(value, baseline[key], "Tablet/desktop geometry stays unchanged");
}

async function checkAuth(browser, width, locale, theme, mode) {
	const { page, prefix, ready, finish, noOverflow, submissions, setReply } = await setup(browser, width, locale, theme);
	const t = (locale === "en" ? en : vi).Auth;
	await page.goto(`${baseURL}${prefix}/${mode}`); await ready();
	assert.equal(await page.locator("h1").innerText(), t[mode]);
	await page.getByRole("button", { name: t[mode === "login" ? "googleLogin" : "googleSignup"], exact: true }).waitFor();
	const other = mode === "login" ? "signup" : "login";
	assert.equal(await page.getByRole("link", { name: t[other], exact: true }).getAttribute("href"), `${prefix}/${other}`);
	assert.equal(await page.getByRole("link", { name: t.close, exact: true }).getAttribute("href"), prefix || "/");
	if (mode === "login") await page.getByText(`${t.loginSubtitle} 🚀`, { exact: true }).waitFor();
	else assert.equal(await page.locator('input[name="name"]').getAttribute("placeholder"), t.namePlaceholder);
	const fields = mode === "login" ? [["email", "email", "username"], ["password", "password", "current-password"]]
		: [["name", "name", "name"], ["email", "email", "email"], ["password", "password", "new-password"], ["passwordConfirm", "passwordConfirm", "new-password"]];
	const values = { name: "Learner", email: "learner@example.com", password: "Testpass123!", passwordConfirm: "Testpass123!" };
	for (const [key, label, autocomplete] of fields) {
		const input = page.getByLabel(t[label], { exact: true });
		assert.equal(await input.getAttribute("name"), key);
		assert.equal(await input.getAttribute("autocomplete"), autocomplete);
		assert.ok(await input.evaluate(element => element.labels.length === 1 && element.labels[0].htmlFor === element.id));
		await page.locator(`label[for="${await input.getAttribute("id")}"]`).click();
		assert.equal(await input.evaluate(element => element === document.activeElement), true, "Label focuses input");
		await input.fill(values[key]);
	}
	assert.deepEqual(await page.locator("form").evaluate(form => Object.fromEntries(new FormData(form))),
		Object.fromEntries(fields.map(([key]) => [key, values[key]])), "Named fields populate native form data");
	if (mode === "login") {
		await page.getByRole("button", { name: t.showPassword, exact: true }).click();
		assert.equal(await page.locator('input[name="password"]').getAttribute("type"), "text");
		await page.getByRole("button", { name: t.hidePassword, exact: true }).click();
		assert.equal(await page.locator('input[name="password"]').getAttribute("type"), "password");
	}
	const google = page.getByRole("button", { name: t[mode === "login" ? "googleLogin" : "googleSignup"], exact: true });
	if (await google.isDisabled()) assert.equal(await page.getByRole("alert").innerText(), t.googleUnavailable);
	else { await google.click(); await page.getByRole("alert").filter({ hasText: t.googleStartFailed }).waitFor(); }
	const submit = page.locator('button[type="submit"]');
	const failures = mode === "login" ? [[{ status: "fail", message: "Email hoặc mật khẩu không chính xác!" }, t.invalidCredentials]] : [
		[{ status: "fail", message: 'Email "learner@example.com" đã được sử dụng, vui lòng chọn email khác!' }, t.emailInUse],
		[{ status: "fail", message: "Dữ liệu không hợp lệ: name must have at least 3 characters. Password must be at least 8 characters. Passwords are not the same" }, `${t.nameLength} ${t.passwordLength} ${t.passwordMismatch}`],
		[{ status: "fail", message: "Unexpected server message" }, t.signupFailed],
	];
	for (const [reply, message] of failures) {
		setReply(reply); await submit.click();
		if (mode === "login") await page.getByRole("button", { name: t.loggingIn, exact: true }).waitFor();
		await page.waitForFunction(message => document.querySelector('[role="alert"]')?.textContent.trim() === message, message);
		assert.deepEqual(submissions.at(-1), Object.fromEntries(fields.map(([key]) => [key, values[key]])));
		await noOverflow();
	}
	if (locale === "en") assert.ok(!/Đăng|Mật khẩu|Tên người dùng|HOẶC|Dữ liệu/.test(await page.locator("body").innerText()), "English auth has no Vietnamese UI copy");
	setReply({ status: "success", data: { user: { _id: "learner", name: "Learner", theme } } });
	await submit.click(); await page.waitForURL(`${baseURL}${prefix}/wordlist`);
	if (mode === "login") for (const [code, key] of [["google_session_failed", "googleSessionFailed"], ["google_oauth_failed", "googleOAuthFailed"]]) {
		await page.goto(`${baseURL}${prefix}/login?error=${code}`);
		await page.getByRole("alert").filter({ hasText: t[key] }).waitFor();
		await noOverflow();
		await page.goto(`${baseURL}${prefix}/wordlist`);
	}
	await finish();
}

async function tapExtendedArea(page, button) {
	await button.scrollIntoViewIfNeeded();
	const bounds = await button.boundingBox();
	await page.touchscreen.tap(bounds.x - 3, bounds.y - 3);
}

async function checkPlayer(browser, width, locale, theme, capture = false) {
	const { page, prefix, ready, finish } = await setup(browser, width, locale, theme);
	const t = (locale === "en" ? en : vi).DialogueFeature;
	await page.goto(`${baseURL}${prefix}/dialogue/coffee-shop/ordering-a-coffee`); await ready();
	const translation = page.getByRole("button", { name: t.translateSentence, exact: true });
	await translation.waitFor();
	const play = page.getByRole("button", { name: t.play, exact: true });
	const subtitles = page.getByRole("button", { name: t.hideSubtitles, exact: true });
	const toolbar = translation.locator("../..");
	assert.equal((await translation.boundingBox()).width, 36, "Translation visual size stays unchanged");
	assert.equal((await translation.locator("svg").boundingBox()).width, 16);
	if (width < 640) {
		const speed = page.getByRole("button", { name: t.choosePlaybackSpeed.replace("{rate}", "1"), exact: true });
		for (const button of [translation, speed]) {
			const hitSize = await button.evaluate(element => {
				const css = getComputedStyle(element, "::after"), rect = element.getBoundingClientRect();
				return { width: rect.width - parseFloat(css.left) - parseFloat(css.right), height: rect.height - parseFloat(css.top) - parseFloat(css.bottom) };
			});
			assert.ok(hitSize.width >= 44 && hitSize.height >= 44, "Extended touch area is at least 44px");
		}
		const selected = await translation.evaluate(element => element.classList.contains("bg-violet-500/15"));
		await tapExtendedArea(page, translation);
		assert.equal(await translation.evaluate(element => element.classList.contains("bg-violet-500/15")), !selected);
		await tapExtendedArea(page, speed);
		assert.equal(await speed.getAttribute("aria-expanded"), "true");
		const options = speed.locator("..").locator('div button');
		assert.equal(await options.count(), 5);
		for (const option of await options.all()) assert.ok((await option.boundingBox()).height >= 44);
		await options.filter({ hasText: /^0\.75x$/ }).click({ position: { x: 3, y: 3 } });
		await page.getByRole("button", { name: t.choosePlaybackSpeed.replace("{rate}", "0.75"), exact: true }).waitFor();
		await page.reload(); await ready();
		await page.getByRole("button", { name: t.choosePlaybackSpeed.replace("{rate}", "0.75"), exact: true }).waitFor();
		assert.ok(await toolbar.evaluate(element => {
			const rect = element.getBoundingClientRect();
			return [...element.querySelectorAll("button")].filter(button => button.getBoundingClientRect().width > 0)
				.every(button => { const b = button.getBoundingClientRect(); return b.left >= rect.left && b.right <= rect.right; });
		}), "Toolbar buttons fit at phone width");
	} else {
		const rates = page.locator('div[aria-label]').filter({ has: page.locator('button[aria-pressed]') }).filter({ hasText: "0.5x" });
		compareBaseline(`player-${width}-${locale}-${theme}`, await geometry({ toolbar, translation, play, subtitles, rates }), capture);
	}
	await finish();
}

async function checkEmpty(browser, width, locale, theme, authenticated, capture = false) {
	const { page, prefix, ready, finish } = await setup(browser, width, locale, theme, authenticated);
	const t = (locale === "en" ? en : vi).Notebook;
	await page.goto(`${baseURL}${prefix}/wordlist`); await ready();
	const heading = page.getByRole("heading", { level: 2 }).last();
	await heading.waitFor(); const card = heading.locator("..");
	const image = card.locator("img");
	await image.evaluate(element => element.complete ? null : new Promise(resolve => { element.onload = resolve; element.onerror = resolve; }));
	const text = card.locator("p"), actions = card.locator("button,a");
	assert.equal(await actions.count(), 2);
	if (width < 768) {
		assert.equal(await text.evaluate(element => getComputedStyle(element).fontSize), "14px");
		assert.ok(await text.evaluate(element => parseFloat(getComputedStyle(element).lineHeight) >= 20));
		for (const action of await actions.all()) {
			const bounds = await action.boundingBox(); assert.ok(bounds.width >= 44 && bounds.height >= 44);
			await action.click({ trial: true, position: { x: 3, y: 3 } });
		}
		if (authenticated) {
			await actions.first().click({ position: { x: 3, y: 3 } });
			await page.getByRole("dialog").getByRole("button", { name: t.close, exact: true }).click();
		} else {
			assert.equal(await actions.first().getAttribute("href"), `${prefix}/dialogue`);
			assert.equal(await actions.last().getAttribute("href"), `${prefix}/login`);
		}
		if (process.env.STUDYJONY_SCREENSHOTS && width === 320 && locale === "en") await page.screenshot({
			path: path.join(process.env.STUDYJONY_SCREENSHOTS, `empty-${authenticated ? "signed-in" : "guest"}-${theme}.png`), fullPage: true,
		});
	} else compareBaseline(`empty-${authenticated}-${width}-${locale}-${theme}`,
		await geometry({ card, heading, image, text, first: actions.first(), second: actions.last() }), capture);
	await finish();
}

async function run() {
	assert.deepEqual(Object.keys(en.Auth).sort(), Object.keys(vi.Auth).sort(), "Auth locales have complete matching keys");
	const capture = process.env.STUDYJONY_CAPTURE_BASELINE === "1";
	if (!capture && process.env.STUDYJONY_FINAL_BASELINE) Object.assign(baseline, JSON.parse(fs.readFileSync(process.env.STUDYJONY_FINAL_BASELINE, "utf8")));
	const browser = await chromium.launch({ channel: "chrome", headless: true });
	try {
		for (const width of capture ? [768, 1280] : [320, 375, 430, 768, 1280])
			for (const locale of ["vi", "en"]) for (const theme of ["light", "dark"]) {
				if (!capture) for (const mode of ["login", "signup"]) await checkAuth(browser, width, locale, theme, mode);
				await checkPlayer(browser, width, locale, theme, capture);
				for (const authenticated of [false, true]) await checkEmpty(browser, width, locale, theme, authenticated, capture);
				console.log(`PASS ${width}px ${locale} ${theme}: ${capture ? "baseline geometry" : "localized auth/autofill, player targets, empty cards"}`);
			}
		if (capture) fs.writeFileSync(process.env.STUDYJONY_FINAL_BASELINE, JSON.stringify(baseline, null, 2));
	} finally { await browser.close(); }
}

run().catch(error => { console.error(error); process.exitCode = 1; });
