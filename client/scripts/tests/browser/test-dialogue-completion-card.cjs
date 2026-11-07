const assert = require("node:assert/strict");
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs");
const { chromium } = require("playwright");
const AxeBuilder = require("@axe-core/playwright").default;

const baseURL = process.env.STUDYJONY_TEST_URL || "http://localhost:3000";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname));

const userId = "aaaaaaaaaaaaaaaaaaaaaaaa";
const lessonId = "restaurant";
const dialogueId = "getting-a-table";
const dialogueData = require("../../../app/[locale]/(main)/dialogue/_data/dialogues/restaurant/getting-a-table.json");
const taskIds = dialogueData.tasks.map(task => String(task.id));
const screenshotDirectory = path.join(os.tmpdir(), "studyjony-dialogue-completion-card");
fs.mkdirSync(screenshotDirectory, { recursive: true });

async function fixture(browser, { locale, width, theme, signedIn, progressComplete = true }) {
	const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: width < 600, hasTouch: width < 600 });
	const page = await context.newPage();
	const prefix = locale === "en" ? "/en" : "";
	const messages = require(`../../../messages/${locale}.json`).DialogueFeature;
	const feedbackMessages = require(`../../../messages/${locale}.json`).Feedback;
	let writes = 0;
	let vocabularySaves = 0;
	await context.addCookies([{ name: "sj_guest_language", value: locale, url: baseURL }]);
	await context.addInitScript(themeName => localStorage.setItem("studyjony-theme", themeName), theme);
	await context.route("**/*", route => new URL(route.request().url()).origin === new URL(baseURL).origin
		? route.continue()
		: route.fulfill({ contentType: "application/javascript", body: "" }));
	await context.route("**/api/v1/**", async route => {
		const request = route.request();
		const pathname = new URL(request.url()).pathname;
		const json = data => route.fulfill({ json: { status: "success", data } });
		if (request.method() === "POST") {
			writes += 1;
			if (pathname === "/api/v1/vocab") {
				vocabularySaves += 1;
				const word = request.postDataJSON().english;
				return json({ newVocab: { _id: `saved-${vocabularySaves}`, english: word } });
			}
			return route.fulfill({ status: 401, json: { status: "fail" } });
		}
		if (pathname.endsWith("/users/me")) return signedIn
			? json({ user: { _id: userId, name: "Completion card tester", language: locale, theme } })
			: route.fulfill({ status: 401, json: { status: "fail" } });
		if (pathname === `/api/v1/dialogue-progress/${lessonId}`) return json({ progress: signedIn && progressComplete ? [{
			lessonId,
			dialogueId,
			completedTaskIds: taskIds,
		}] : [] });
		if (pathname === "/api/v1/vocab") return json({ vocabularies: [] });
		return json({ progress: [], vocabularies: [], words: [], topics: [], activities: [] });
	});
	return {
		context,
		page,
		prefix,
		messages,
		feedbackMessages,
		get writes() { return writes; },
		get vocabularySaves() { return vocabularySaves; },
		async openCompletion() {
			await page.goto(`${baseURL}${prefix}/dialogue/${lessonId}/${dialogueId}/useful-words?completed=1`, {
				waitUntil: "domcontentloaded",
				timeout: 90000,
			});
			await page.getByRole("heading", { name: messages.usefulWordsTitle, exact: true }).waitFor();
		},
		async close() { await context.close(); },
	};
}

async function assertAccessibleCard(page) {
	const result = await new AxeBuilder({ page })
		.include('[data-testid="dialogue-completion-card"]')
		.withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
		.analyze();
	assert.deepEqual(result.violations.map(item => `${item.id}: ${item.help}`), [], "Completion card passes axe WCAG 2.1 AA checks");
}

async function assertFeedbackDoesNotCoverCompletionActions(f, width) {
	const feedbackButton = f.page.getByRole("button", { name: f.feedbackMessages.button, exact: true });
	await feedbackButton.scrollIntoViewIfNeeded();
	const feedbackBox = await feedbackButton.boundingBox();
	assert.ok(feedbackBox, "Feedback button is reachable after scrolling");
	assert.ok(feedbackBox.width >= 44 && feedbackBox.height >= 44, "Feedback touch target is at least 44 by 44 pixels");
	const position = await feedbackButton.evaluate(element => getComputedStyle(element).position);
	assert.equal(position, width < 768 ? "relative" : "fixed", "Feedback uses in-flow mobile placement and preserves desktop fixed placement");
	const completionControls = f.page.locator("main .sticky button, [data-testid='dialogue-completion-card'] a, [data-testid='dialogue-completion-card'] button");
	for (const controlBox of await completionControls.evaluateAll(elements => elements.map(element => {
		const { x, y, width: boxWidth, height: boxHeight } = element.getBoundingClientRect();
		return { x, y, width: boxWidth, height: boxHeight };
	}))) {
		const overlaps = feedbackBox.x < controlBox.x + controlBox.width
			&& feedbackBox.x + feedbackBox.width > controlBox.x
			&& feedbackBox.y < controlBox.y + controlBox.height
			&& feedbackBox.y + feedbackBox.height > controlBox.y;
		assert.equal(overlaps, false, "Feedback button does not overlap completion or vocabulary actions, including Next Dialogue");
	}
	if (width < 768) {
		const viewport = await f.page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
		assert.ok(feedbackBox.x >= 0 && feedbackBox.x + feedbackBox.width <= viewport.width, "Feedback button stays within the mobile viewport");
		assert.ok(feedbackBox.y >= 0 && feedbackBox.y + feedbackBox.height <= viewport.height, "Feedback button is visible after scrolling");
		await f.page.touchscreen.tap(feedbackBox.x + feedbackBox.width / 2, feedbackBox.y + feedbackBox.height / 2);
	} else {
		await feedbackButton.focus();
		await f.page.keyboard.press("Enter");
	}
	assert.equal(await feedbackButton.getAttribute("aria-expanded"), "true", "Feedback opens with touch or keyboard input");
	assert.ok(await f.page.getByRole("dialog", { name: f.feedbackMessages.title, exact: true }).isVisible(), "Feedback form is accessible by its localized dialog title");
	await f.page.keyboard.press("Escape");
	assert.equal(await feedbackButton.getAttribute("aria-expanded"), "false", "Escape closes Feedback and returns to the completion screen");
}

async function verifyCompletionCard(browser, locale, width, theme, signedIn) {
	const f = await fixture(browser, { locale, width, theme, signedIn });
	try {
		await f.openCompletion();
		const card = f.page.getByTestId("dialogue-completion-card");
		await card.waitFor({ state: "visible" });
		const title = f.page.getByRole("heading", { name: f.messages.dialogueCompletionTitle, exact: true });
		await title.waitFor();
		const copy = signedIn
			? f.messages.dialogueCompletionSaved.replace("{completed}", String(taskIds.length)).replace("{total}", String(taskIds.length))
			: f.messages.dialogueCompletionGuest;
		await f.page.getByText(copy, { exact: true }).waitFor();
		assert.equal(await f.page.locator("html").getAttribute("data-theme"), theme);
		const imageSource = await card.locator("img").getAttribute("src");
		assert.equal(new URL(imageSource, baseURL).searchParams.get("url") || imageSource, "/dialogue-completion-boy-cat.png");
		assert.equal(await card.locator("img").getAttribute("alt"), "");
		await f.page.waitForFunction(() => {
			const image = document.querySelector('[data-testid="dialogue-completion-card"] img');
			return image?.complete && image.naturalWidth > 0;
		}, null, { timeout: 15000 });
		const placement = await card.evaluate(element => {
			const illustration = element.querySelector("img").parentElement.getBoundingClientRect();
			const information = element.querySelector("[role=status]").getBoundingClientRect();
			return { illustration, information };
		});
		assert.equal(await f.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "Card fits the viewport");
		if (width < 768) {
			assert.ok(placement.illustration.top < placement.information.top, "Mobile stacks artwork before completion text");
			const statusBox = await card.locator("[role=status]").boundingBox();
			const actionBox = await f.page.locator("main .sticky").boundingBox();
			assert.ok(statusBox.y + statusBox.height <= actionBox.y, `Mobile sticky vocabulary actions do not cover completion text (status bottom ${statusBox.y + statusBox.height}, actions top ${actionBox.y})`);
		} else assert.ok(placement.illustration.left < placement.information.left, "Desktop places artwork to the left of completion text");
		await assertFeedbackDoesNotCoverCompletionActions(f, width);
		assert.equal(f.writes, 0, "Viewing completion does not write learning progress");
		if (!signedIn) assert.doesNotMatch(copy, /restore|recover|where you left off/i, "Guest copy does not promise recovery");
		await assertAccessibleCard(f.page);
		if ((locale === "vi" && width === 390 && theme === "light" && !signedIn)
			|| (locale === "en" && width === 1280 && theme === "dark" && signedIn)) {
			await f.page.screenshot({ path: path.join(screenshotDirectory, `${locale}-${width}-${theme}-${signedIn ? "signed-in" : "guest"}.png`), fullPage: true, animations: "disabled" });
		}
		console.log(`PASS ${locale} ${width}px ${theme} ${signedIn ? "signed-in" : "guest"} completion card and accessibility`);
	} finally {
		await f.close();
	}
}

async function verifySavedWordCountAndActions(browser) {
	const locale = "en";
	const theme = "light";
	const f = await fixture(browser, { locale, width: 390, theme, signedIn: true });
	try {
		await f.openCompletion();
		const card = f.page.getByTestId("dialogue-completion-card");
		const selectedWords = f.page.locator("button[aria-pressed=true]");
		const available = await selectedWords.count();
		const savedCount = Math.min(3, available);
		assert.ok(savedCount > 0, "Fixture has words to save");
		for (let index = available - 1; index >= savedCount; index--) await selectedWords.nth(index).click();
		const saveLabel = f.messages.saveWords.replace("{count}", String(savedCount));
		await f.page.getByRole("button", { name: saveLabel, exact: true }).click();
		await f.page.getByText(f.messages.savedWords.replace("{count}", String(savedCount)), { exact: true }).waitFor();
		assert.equal(f.vocabularySaves, savedCount, "Only the selected words were saved");
		assert.ok(await card.getByRole("heading", { name: f.messages.dialogueCompletionTitle, exact: true }).isVisible());
		assert.ok(await f.page.getByRole("button", { name: f.messages.continue, exact: true }).isVisible(), "Existing Continue action remains available");
		assert.ok(await f.page.getByRole("link", { name: /^(Next:|Tiếp theo:)/ }).isVisible(), "Next Dialogue navigation remains available after saving words");
		await assertFeedbackDoesNotCoverCompletionActions(f, 390);
		await assertAccessibleCard(f.page);
		await f.page.screenshot({ path: path.join(screenshotDirectory, "en-390-light-saved-3-words.png"), fullPage: true, animations: "disabled" });
		await f.page.getByRole("button", { name: f.messages.continue, exact: true }).click();
		await f.page.waitForURL(url => url.pathname === `${f.prefix}/dialogue/restaurant`);
		console.log(`PASS actual saved count (${savedCount}), Continue, and Next Dialogue survive the redesigned screen`);
	} finally {
		await f.close();
	}
}

async function verifyUnconfirmedProgress(browser) {
	const f = await fixture(browser, { locale: "vi", width: 390, theme: "dark", signedIn: true, progressComplete: false });
	try {
		await f.openCompletion();
		assert.equal(await f.page.getByTestId("dialogue-completion-card").count(), 0, "Incomplete saved progress does not show a completion card");
		assert.equal(await f.page.getByText(f.messages.dialogueCompletionTitle, { exact: true }).count(), 0);
		console.log("PASS signed-in incomplete progress does not claim dialogue completion");
	} finally {
		await f.close();
	}
}

(async () => {
	const browser = await chromium.launch({ channel: "chrome", headless: true });
	try {
		for (const locale of ["vi", "en"]) {
			for (const width of [390, 1280]) {
				for (const theme of ["light", "dark"]) {
					await verifyCompletionCard(browser, locale, width, theme, false);
					await verifyCompletionCard(browser, locale, width, theme, true);
				}
			}
		}
		await verifySavedWordCountAndActions(browser);
		await verifyUnconfirmedProgress(browser);
	} finally {
		await browser.close();
	}
})().catch(error => {
	console.error(error);
	process.exitCode = 1;
});
