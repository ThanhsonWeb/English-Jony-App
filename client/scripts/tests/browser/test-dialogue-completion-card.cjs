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
const screenshotDirectory = path.join(os.tmpdir(), "studyjony-useful-words-selection");
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

async function assertAccessibleSelection(page) {
	const result = await new AxeBuilder({ page })
		.include('[data-testid="dialogue-vocabulary-selection"]')
		.withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
		.analyze();
	assert.deepEqual(result.violations.map(item => `${item.id}: ${item.help}`), [], "Vocabulary selection passes axe WCAG 2.1 AA checks");
}

async function assertFeedbackDoesNotCoverCompletionActions(f, width) {
	const feedbackButton = f.page.getByRole("button", { name: f.feedbackMessages.button, exact: true });
	await feedbackButton.scrollIntoViewIfNeeded();
	const feedbackBox = await feedbackButton.boundingBox();
	assert.ok(feedbackBox, "Feedback button is reachable after scrolling");
	assert.ok(feedbackBox.width >= 44 && feedbackBox.height >= 44, "Feedback touch target is at least 44 by 44 pixels");
	const position = await feedbackButton.evaluate(element => getComputedStyle(element).position);
	assert.equal(position, width < 768 ? "relative" : "fixed", "Feedback uses in-flow mobile placement and preserves desktop fixed placement");
	const completionControls = f.page.locator("main [data-testid='dialogue-selection-actions'] button, [data-testid='dialogue-completion-card'] a, [data-testid='dialogue-completion-card'] button");
	for (const controlBox of await completionControls.evaluateAll(elements => elements.map(element => {
		const { x, y, width: boxWidth, height: boxHeight } = element.getBoundingClientRect();
		return { x, y, width: boxWidth, height: boxHeight, label: element.textContent.trim() };
	}))) {
		const overlaps = feedbackBox.x < controlBox.x + controlBox.width
			&& feedbackBox.x + feedbackBox.width > controlBox.x
			&& feedbackBox.y < controlBox.y + controlBox.height
			&& feedbackBox.y + feedbackBox.height > controlBox.y;
		assert.equal(overlaps, false, `Feedback button does not overlap controls (${controlBox.label})`);
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
		const selection = f.page.getByTestId("dialogue-vocabulary-selection");
		await selection.waitFor({ state: "visible" });
		assert.equal(await f.page.getByTestId("dialogue-completion-card").count(), 0, "The post-save celebration remains separate from vocabulary selection");
		assert.equal(await f.page.getByText(f.messages.dialogueCompletionTitle, { exact: true }).count(), 0, "Vocabulary selection does not repeat the completion title");
		assert.equal(await f.page.getByText(f.messages.dialogueCompletionSaved.replace("{completed}", String(taskIds.length)).replace("{total}", String(taskIds.length)), { exact: true }).count(), 0, "Vocabulary selection does not repeat the saved-progress completion copy");
		assert.equal(await f.page.getByText(f.messages.dialogueCompletionGuest, { exact: true }).count(), 0, "Vocabulary selection does not repeat the guest completion copy");
		if (!signedIn) assert.ok(await f.page.getByText(f.messages.signInToSaveWords, { exact: false }).isVisible(), "Guest sign-in guidance remains available");
		assert.equal(await f.page.locator("html").getAttribute("data-theme"), theme);
		const illustration = f.page.getByTestId("useful-words-illustration");
		const image = illustration.locator("img");
		await image.waitFor({ state: "visible" });
		await f.page.waitForFunction(element => element.complete && element.naturalWidth > 0, await image.elementHandle());
		assert.match(await image.getAttribute("src"), /dialogue-completion-boy-cat\.png/, "The specified boy-and-cat asset is used");
		assert.equal(await image.getAttribute("alt"), "", "The decorative illustration is not announced redundantly");
		const headingBox = await f.page.getByTestId("useful-words-heading").boundingBox();
		const headingFontSize = Number.parseFloat(await f.page.getByTestId("useful-words-heading").evaluate(element => getComputedStyle(element).fontSize));
		const illustrationBox = await illustration.boundingBox();
		const wordList = f.page.getByTestId("dialogue-word-list");
		const wordListBox = await wordList.boundingBox();
		assert.ok(headingBox && illustrationBox && wordListBox);
		assert.ok(headingFontSize <= (width >= 1024 ? 30 : 24), "Useful Words heading remains compact at this viewport");
		if (width >= 768) {
			assert.ok(illustrationBox.x > headingBox.x, "Desktop places the illustration to the right of the Useful Words heading");
			assert.ok(illustrationBox.width <= 320 && illustrationBox.height <= 160, "Desktop illustration and upper section stay compact beside the heading");
		}
		else assert.ok(illustrationBox.y + illustrationBox.height <= wordListBox.y, "Mobile keeps the illustration above the vocabulary board");
		const listDimensions = await wordList.evaluate(element => ({
			height: element.getBoundingClientRect().height,
			clientHeight: element.clientHeight,
			scrollHeight: element.scrollHeight,
			overflowY: getComputedStyle(element).overflowY,
		}));
		assert.ok(["auto", "scroll"].includes(listDimensions.overflowY), "Vocabulary board scrolls internally");
		assert.ok(listDimensions.scrollHeight > listDimensions.clientHeight, "Long vocabulary lists overflow the fixed-height board");
		const initialListHeight = listDimensions.height;
		await wordList.evaluate(element => { element.scrollTop = element.scrollHeight; });
		assert.ok(await wordList.evaluate(element => element.scrollTop > 0), "Learners can scroll through the vocabulary inside the board");
		assert.equal(await wordList.evaluate(element => element.getBoundingClientRect().height), initialListHeight, "Internal scrolling does not increase the page height");
		await wordList.evaluate(element => { element.scrollTop = 0; });
		const firstWord = selection.locator("button[aria-pressed]").first();
		const selectedCount = await selection.locator('button[aria-pressed="true"]').count();
		assert.ok(selectedCount > 0, "Vocabulary items remain selectable");
		const selectedCountStatus = f.page.getByTestId("dialogue-selected-word-count");
		assert.equal((await selectedCountStatus.innerText()).trim(), f.messages.selectedWordCount.replace("{count}", String(selectedCount)));
		await firstWord.focus();
		await f.page.keyboard.press("Space");
		assert.equal(await firstWord.getAttribute("aria-pressed"), "false", "Keyboard activation deselects a selected word");
		assert.equal((await selectedCountStatus.innerText()).trim(), f.messages.selectedWordCount.replace("{count}", String(selectedCount - 1)), "Selected-word count updates immediately");
		if (signedIn) {
			const reducedCount = f.messages.saveWords.replace("{count}", String(selectedCount - 1));
			await f.page.getByRole("button", { name: reducedCount, exact: true }).waitFor();
		}
		await f.page.keyboard.press("Space");
		assert.equal(await firstWord.getAttribute("aria-pressed"), "true", "A word can be selected again");
		assert.equal(await f.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "Selection screen fits the viewport");
		const actionBar = f.page.getByTestId("dialogue-selection-actions");
		const actionBarPosition = await actionBar.evaluate(element => getComputedStyle(element).position);
		assert.equal(actionBarPosition, "static", "Selection actions stay after the list instead of covering vocabulary rows");
		const primaryAction = f.page.getByRole("button", { name: signedIn
			? f.messages.saveWords.replace("{count}", String(selectedCount))
			: f.messages.continueWithoutSaving, exact: true });
		const skipAction = f.page.getByRole("button", { name: f.messages.skip, exact: true });
		const primaryBox = await primaryAction.boundingBox();
		const skipBox = await skipAction.boundingBox();
		assert.ok(primaryBox && skipBox);
		if (width >= 1024) {
			const nextAction = actionBar.locator("a").first();
			const nextBox = await actionBar.locator("a").count() ? await nextAction.boundingBox() : null;
			const primaryCenter = primaryBox.y + primaryBox.height / 2;
			assert.ok(Math.abs(primaryCenter - (skipBox.y + skipBox.height / 2)) <= 4, "Desktop Save, Skip, and Next actions share one row");
			if (nextBox) {
				assert.ok(Math.abs(primaryCenter - (nextBox.y + nextBox.height / 2)) <= 4, "Desktop Next Dialogue is aligned with the primary action");
				assert.ok(nextBox.x - (skipBox.x + skipBox.width) >= 16, "Desktop Skip and Next actions have a visible gap");
			}
			assert.ok(skipBox.x - (primaryBox.x + primaryBox.width) >= 32, "Desktop primary action has a wide gap before Skip and Next");
		} else {
			assert.ok(primaryBox.y + primaryBox.height <= skipBox.y, "Mobile secondary actions remain below the primary action");
		}
		if (width >= 768) {
			const actionBarBox = await actionBar.boundingBox();
			const viewportHeight = await f.page.evaluate(() => innerHeight);
			assert.ok(actionBarBox.y + actionBarBox.height <= viewportHeight, `Desktop actions fit within the ${viewportHeight}px viewport`);
		}
		if (width < 768) {
			await actionBar.scrollIntoViewIfNeeded();
			await f.page.getByRole("button", { name: signedIn
				? f.messages.saveWords.replace("{count}", String(selectedCount))
				: f.messages.continueWithoutSaving, exact: true }).waitFor({ state: "visible" });
			await f.page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
			const boardBox = await f.page.getByTestId("dialogue-word-list").boundingBox();
			const actionBarBox = await actionBar.boundingBox();
			assert.ok(boardBox.y + boardBox.height <= actionBarBox.y, "Mobile actions follow the internally scrolling word board without covering it");
			assert.ok(actionBarBox.y >= 0 && actionBarBox.y + actionBarBox.height <= 844, "Mobile actions remain within the viewport when brought into view");
			if (await f.page.getByRole("link", { name: /^(Next:|Tiếp theo:)/ }).count()) {
				assert.ok(await f.page.getByRole("link", { name: /^(Next:|Tiếp theo:)/ }).isVisible(), "Next Dialogue remains visible beside Skip after scrolling");
			}
			if (locale === "vi" && width === 390 && theme === "light" && !signedIn) {
				await actionBar.screenshot({ path: path.join(screenshotDirectory, "vi-390-light-guest-actions.png"), animations: "disabled" });
			}
		}
		await assertFeedbackDoesNotCoverCompletionActions(f, width);
		assert.equal(f.writes, 0, "Viewing selection does not write learning progress");
		await assertAccessibleSelection(f.page);
		if ((locale === "vi" && width === 390 && theme === "light" && !signedIn)
			|| (locale === "vi" && width === 1280 && theme === "light" && !signedIn)
			|| (locale === "en" && width === 1280 && theme === "dark" && signedIn)) {
			await f.page.evaluate(() => window.scrollTo(0, 0));
			await f.page.screenshot({ path: path.join(screenshotDirectory, `${locale}-${width}-${theme}-${signedIn ? "signed-in" : "guest"}-selection.png`), fullPage: width >= 768, animations: "disabled" });
		}
		console.log(`PASS ${locale} ${width}px ${theme} ${signedIn ? "signed-in" : "guest"} illustration, internal word list, live count, and accessibility`);
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
		await f.page.evaluate(() => window.scrollTo(0, 0));
		await f.page.screenshot({ path: path.join(screenshotDirectory, "en-390-light-post-save-celebration.png"), fullPage: false, animations: "disabled" });
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
