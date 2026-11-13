const { chromium } = require("playwright");
const AxeBuilder = require("@axe-core/playwright").default;
const assert = require("node:assert/strict");

const baseURL = process.env.STUDYJONY_TEST_URL || "http://localhost:3000";

async function createPage(browser, { locale, theme = "dark", authenticated = false, width = 390, height = 844 }) {
	const context = await browser.newContext({ viewport: { width, height }, hasTouch: true, isMobile: width < 640, colorScheme: theme });
	const page = await context.newPage();
	await page.addInitScript(theme => localStorage.setItem("studyjony-theme", theme), theme);
	await page.route("**/api/v1/**", route => {
		const path = new URL(route.request().url()).pathname;
		if (path === "/api/v1/users/me") {
			return route.fulfill({
				status: authenticated ? 200 : 401,
				json: { data: { user: authenticated ? { _id: "drawer-learner", name: "Drawer Learner", email: "drawer@example.com", theme, language: locale } : null } },
			});
		}
		return route.fulfill({ json: { data: {} } });
	});
	const prefix = locale === "en" ? "/en" : "";
	await page.goto(`${baseURL}${prefix}/`, { waitUntil: "domcontentloaded" });
	await page.waitForFunction(theme => document.documentElement.dataset.theme === theme, theme);
	return page;
}

async function checkGuestDrawer(browser, locale) {
	const messages = require(`../../../messages/${locale}.json`);
	const page = await createPage(browser, { locale, theme: "dark" });
	const trigger = page.getByRole("button", { name: messages.Navigation.openMenu, exact: true });
	assert.equal(await page.locator('nav[aria-label] a[href$="/profile"]').count(), 0, "No fixed mobile bottom navigation remains");
	assert.equal(await page.getByRole("navigation", { name: messages.Navigation.desktopLabel, exact: true }).count(), 0, "Desktop links are hidden at phone width");
	await trigger.focus();
	await page.keyboard.press("Enter");
	const drawer = page.getByRole("dialog", { name: messages.Navigation.menuTitle, exact: true });
	await drawer.waitFor();
	assert.equal(await trigger.getAttribute("aria-expanded"), "true");
	assert.equal(await trigger.getAttribute("aria-controls"), "mobile-navigation-drawer");
	const closeButton = drawer.getByRole("button", { name: messages.Navigation.closeMenu, exact: true });
	assert.equal(await closeButton.evaluate(element => element === document.activeElement), true, "Focus moves into the drawer");
	const navigation = drawer.getByRole("navigation", { name: messages.Navigation.mobileLabel, exact: true });
	const labels = ["home", "dialogue", "stories", "vocabulary", "rank"].map(key => messages.Navigation[key]);
	assert.deepEqual(await navigation.getByRole("link").allTextContents(), labels);
	assert.deepEqual(await navigation.getByRole("link").evaluateAll(links => links.map(link => {
		const url = new URL(link.href);
		return `${url.pathname.replace(/^\/en(?=\/|$)/, "") || "/"}${url.search}`;
	})), ["/", "/dialogue", "/dialogue?category=story", "/wordlist", "/rank"]);
	assert.equal(await drawer.getByRole("link", { name: messages.Header.signIn, exact: true }).count(), 1, "Guests retain sign-in access");
	assert.equal(await page.locator('nav[aria-label] a[href$="/profile"]').count(), 0);

	const audit = await new AxeBuilder({ page }).include("#mobile-navigation-drawer").withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
	assert.deepEqual(audit.violations.map(violation => violation.id), [], "Drawer passes the targeted WCAG axe scan");

	const brand = drawer.getByRole("link", { name: /English-Jony logo StudyJony/ });
	await drawer.getByRole("link").last().focus();
	await page.keyboard.press("Tab");
	assert.equal(await brand.evaluate(element => element === document.activeElement), true, "Tab wraps to the logo link");
	await page.keyboard.press("Shift+Tab");
	assert.equal(await drawer.getByRole("link").last().evaluate(element => element === document.activeElement), true, "Shift+Tab wraps from the logo to the final drawer link");
	await page.keyboard.press("Escape");
	await drawer.waitFor({ state: "detached" });
	assert.equal(await trigger.evaluate(element => element === document.activeElement), true, "Escape restores trigger focus");

	await trigger.click();
	await page.mouse.click(380, 400);
	await drawer.waitFor({ state: "detached" });
	assert.equal(await trigger.evaluate(element => element === document.activeElement), true, "Backdrop close restores trigger focus");

	await trigger.click();
	await drawer.getByRole("link", { name: messages.Navigation.stories, exact: true }).click();
	await page.waitForURL(/\/dialogue\?category=story$/);
	const storyCategory = page.getByRole("navigation", { name: messages.DialogueLanding.categoryNavLabel, exact: true })
		.getByRole("button", { name: new RegExp(messages.DialogueLanding.categories.story) })
	;
	await storyCategory.waitFor();
	assert.equal(await storyCategory.getAttribute("aria-pressed"), "true", "Stories opens the catalogue with its Story filter selected");
	assert.equal(await page.getByRole("dialog").count(), 0, "Navigation closes the drawer");
	assert.equal(await page.locator('nav[aria-label] a[href$="/profile"]').count(), 0);
	await trigger.click();
	await page.getByRole("dialog").getByRole("link", { name: messages.Header.signIn, exact: true }).click();
	await page.waitForURL(/\/login$/);
	assert.equal(await page.getByRole("dialog").count(), 0, "Guest sign-in navigation closes the drawer");
	await page.close();
}

async function checkSignedInDrawer(browser, locale) {
	const messages = require(`../../../messages/${locale}.json`);
	const page = await createPage(browser, { locale, theme: "light", authenticated: true });
	const trigger = page.getByRole("button", { name: messages.Navigation.openMenu, exact: true });
	const account = page.getByRole("button", { name: messages.Header.accountMenu.replace("{name}", "Drawer Learner"), exact: true });
	assert.equal(await account.getAttribute("aria-expanded"), "false", "Signed-in account control exposes its collapsed state");
	await trigger.click();
	const drawer = page.getByRole("dialog", { name: messages.Navigation.menuTitle, exact: true });
	await drawer.waitFor();
	assert.equal(await drawer.getByRole("link", { name: messages.Header.signIn, exact: true }).count(), 0, "Signed-in users do not see guest sign-in");
	const brand = drawer.getByRole("link", { name: /English-Jony logo StudyJony/ });
	const lastLink = drawer.getByRole("navigation", { name: messages.Navigation.mobileLabel, exact: true }).getByRole("link").last();
	await lastLink.focus();
	await page.keyboard.press("Tab");
	assert.equal(await brand.evaluate(element => element === document.activeElement), true, "Signed-in Tab cycle includes the logo link");
	await page.keyboard.press("Shift+Tab");
	assert.equal(await lastLink.evaluate(element => element === document.activeElement), true, "Signed-in Shift+Tab wraps to the final navigation link");
	const lightBackground = await drawer.evaluate(element => getComputedStyle(element).backgroundColor);
	assert.ok(lightBackground && lightBackground !== "rgba(0, 0, 0, 0)", "Drawer uses an opaque themed surface");
	await page.getByRole("button", { name: messages.Navigation.closeMenu, exact: true }).click();
	assert.equal(await trigger.evaluate(element => element === document.activeElement), true);
	await page.close();
}

async function checkDrawerBrand(browser, locale, theme, width) {
	const messages = require(`../../../messages/${locale}.json`);
	const page = await createPage(browser, { locale, theme, width });
	const trigger = page.getByRole("button", { name: messages.Navigation.openMenu, exact: true });
	await trigger.click();
	const drawer = page.getByRole("dialog", { name: messages.Navigation.menuTitle, exact: true });
	const brand = drawer.getByRole("link", { name: /English-Jony logo StudyJony/ });
	await brand.waitFor();
	assert.equal(await brand.getAttribute("href"), locale === "en" ? "/en" : "/", "Brand link uses the active locale homepage");
	assert.equal(await brand.getByText("StudyJony", { exact: true }).isVisible(), true, "Wordmark remains visible on mobile");
	assert.equal(await brand.locator('img[alt="English-Jony logo"]').isVisible(), true, "Existing logo asset is visible");
	const close = drawer.getByRole("button", { name: messages.Navigation.closeMenu, exact: true });
	assert.equal(await close.isVisible(), true, "Close button remains visible beside the brand");
	assert.equal(await drawer.evaluate(element => element.scrollWidth <= element.clientWidth), true, "Drawer header fits without horizontal overflow");
	await page.close();
}

async function checkDesktop(browser) {
	const messages = require("../../../messages/en.json");
	const page = await createPage(browser, { locale: "en", width: 1280, height: 900 });
	const desktopNav = page.getByRole("navigation", { name: messages.Navigation.desktopLabel, exact: true });
	assert.deepEqual(await desktopNav.getByRole("link").allTextContents(), [messages.Navigation.dialogue, messages.Navigation.wordlist, messages.Navigation.rank]);
	assert.equal(await page.getByRole("button", { name: messages.Navigation.openMenu, exact: true }).count(), 0, "Mobile drawer trigger is hidden on desktop");
	assert.equal(await page.locator('nav a[href$="/profile"]').count(), 0);
	await page.close();
}

async function run() {
	const browser = await chromium.launch({ channel: "chrome", headless: true });
	try {
		for (const locale of ["en", "vi"]) {
			await checkGuestDrawer(browser, locale);
			await checkSignedInDrawer(browser, locale);
			for (const theme of ["dark", "light"]) {
				for (const width of [320, 390]) await checkDrawerBrand(browser, locale, theme, width);
			}
			console.log(`PASS ${locale}: guest/signed-in drawer, brand at 320/390px in light/dark, route links, focus, Escape/backdrop/route close, targeted axe scan`);
		}
		await checkDesktop(browser);
		console.log("PASS desktop: existing three-link navigation remains visible and unchanged");
	} finally {
		await browser.close();
	}
}

run().catch(error => {
	console.error(error);
	process.exitCode = 1;
});
