// Feedback launcher placement during Dialogue practice at mobile and desktop sizes.
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const AxeBuilder = require("@axe-core/playwright").default;

const baseURL = process.env.STUDYJONY_TEST_URL || "http://localhost:3000";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname));
const exercisePath = "/dialogue/ten-minutes-a-day/the-old-book/1";

async function run(browser, locale, width, theme) {
	const context = await browser.newContext({
		viewport: { width, height: 844 },
		isMobile: width < 768,
		hasTouch: width < 768,
	});
	await context.addCookies([{ name: "sj_guest_language", value: locale, url: baseURL }]);
	await context.addInitScript((selectedTheme) => {
		localStorage.setItem("studyjony-theme", selectedTheme);
		HTMLMediaElement.prototype.play = function() { return Promise.resolve(); };
		HTMLMediaElement.prototype.pause = function() {};
	}, theme);
	await context.route("**/*", route => new URL(route.request().url()).origin === new URL(baseURL).origin
		? route.continue() : route.fulfill({ body: "" }));
	await context.route("**/api/v1/**", route => {
		const path = new URL(route.request().url()).pathname;
		if (path.endsWith("/users/me")) return route.fulfill({ status: 401, json: { status: "fail" } });
		return route.fulfill({ json: { status: "success", data: { progress: [], vocabularies: [], topics: [], activities: [] } } });
	});
	const page = await context.newPage();
	page.setDefaultTimeout(20000);
	const prefix = locale === "en" ? "/en" : "";
	const t = require(`../../../messages/${locale}.json`).Feedback;
	const errors = [];
	page.on("pageerror", error => errors.push(error.message));
	try {
		const session = page.waitForResponse(response => new URL(response.url()).pathname.endsWith("/users/me"));
		await page.goto(`${baseURL}${prefix}${exercisePath}`, { waitUntil: "domcontentloaded" });
		await session;
		const input = page.locator('input[placeholder="..."]').first();
		await input.waitFor({ state: "visible" });
		const launcher = page.getByRole("button", { name: t.button, exact: true });
		await launcher.waitFor({ state: "visible" });
		await page.waitForFunction(expected => document.documentElement.dataset.theme === expected, theme);

		const launcherStyle = await launcher.evaluate(element => ({
			position: getComputedStyle(element).position,
			minHeight: getComputedStyle(element).minHeight,
			name: element.getAttribute("aria-haspopup"),
		}));
		assert.equal(launcherStyle.position, width < 768 ? "relative" : "fixed", "mobile is in flow; desktop remains floating");
		assert.equal(launcherStyle.name, "dialog");
		assert.ok(parseFloat(launcherStyle.minHeight) >= 44, "feedback target remains touch sized");
		assert.equal(await launcher.getAttribute("aria-expanded"), "false");
		assert.equal(await page.locator("html").getAttribute("data-theme"), theme);

		await input.scrollIntoViewIfNeeded();
		const geometry = await page.evaluate(() => {
			const inputElement = document.querySelector('input[placeholder="..."]');
			const feedbackElement = [...document.querySelectorAll("button")].find(button => button.getAttribute("aria-haspopup") === "dialog");
			const rect = element => {
				const box = element.getBoundingClientRect();
				return { top: box.top + window.scrollY, bottom: box.bottom + window.scrollY, left: box.left, right: box.right };
			};
			return {
				input: rect(inputElement),
				feedback: rect(feedbackElement),
				afterPracticeContent: Boolean(inputElement.compareDocumentPosition(feedbackElement) & Node.DOCUMENT_POSITION_FOLLOWING),
			};
		});
		const overlaps = geometry.input.left < geometry.feedback.right && geometry.input.right > geometry.feedback.left &&
			geometry.input.top < geometry.feedback.bottom && geometry.input.bottom > geometry.feedback.top;
		assert.equal(overlaps, false, `${locale} ${width}px ${theme}: feedback must not overlap the answer input`);
		if (width < 768) assert.equal(geometry.afterPracticeContent, true, "mobile launcher follows practice content in document order");

		await input.click();
		await input.fill("need");
		assert.equal(await input.inputValue(), "need", "answer field remains tappable and editable");

		if (width < 768) {
			await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
			await page.waitForFunction(() => {
				const button = [...document.querySelectorAll("button")].find(item => item.getAttribute("aria-haspopup") === "dialog");
				const rect = button?.getBoundingClientRect();
				return rect && rect.top >= 0 && rect.bottom <= window.innerHeight;
			});
		} else {
			await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
			assert.equal(await launcher.evaluate(element => getComputedStyle(element).position), "fixed", "desktop launcher stays fixed while scrolling");
		}

		await launcher.focus();
		await page.keyboard.press("Enter");
		const dialog = page.getByRole("dialog", { name: t.title });
		await dialog.waitFor();
		assert.equal(await launcher.getAttribute("aria-expanded"), "true");
		const axe = await new AxeBuilder({ page }).include('[role="dialog"]').withRules(["aria-dialog-name", "aria-allowed-attr", "button-name", "label"])
			.analyze();
		assert.deepEqual(axe.violations, [], `${locale} ${width}px ${theme}: feedback dialog accessibility rules`);
		await page.keyboard.press("Escape");
		await dialog.waitFor({ state: "detached" });
		assert.equal(await launcher.getAttribute("aria-expanded"), "false");
		assert.equal(await launcher.evaluate(element => document.activeElement === element), true, "focus returns to feedback button");
		assert.deepEqual(errors, []);
		console.log(`PASS ${locale} ${width}px ${theme}: no answer overlap, scroll/tap, keyboard access, dialog accessibility`);
	} finally {
		await context.close();
	}
}

(async () => {
	const browser = await chromium.launch({ channel: "chrome", headless: true });
	try {
		for (const locale of ["vi", "en"]) for (const width of [390, 1280]) for (const theme of ["light", "dark"]) {
			await run(browser, locale, width, theme);
		}
	} finally {
		await browser.close();
	}
})().catch(error => { console.error(error); process.exitCode = 1; });
