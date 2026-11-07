const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const baseURL = process.env.STUDYJONY_TEST_URL || "http://localhost:3000";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname));

const lessonId = "asking-for-directions";
const firstDialogueId = "finding-the-bus-stop";
const nextDialogueId = "going-to-the-supermarket";
const finalDialogueId = "finding-a-cafe";
const courseDialogues = {
	[firstDialogueId]: require("../../../app/[locale]/(main)/dialogue/_data/dialogues/asking-for-directions/finding-the-bus-stop.json"),
	[finalDialogueId]: require("../../../app/[locale]/(main)/dialogue/_data/dialogues/asking-for-directions/finding-a-cafe.json"),
};
const userId = "aaaaaaaaaaaaaaaaaaaaaaaa";

async function fixture(browser, { locale, width, signedIn, dialogueId = firstDialogueId }) {
	const context = await browser.newContext({
		viewport: { width, height: 844 },
		isMobile: width < 600,
		hasTouch: width < 600,
	});
	const page = await context.newPage();
	const prefix = locale === "en" ? "/en" : "";
	const messages = require(`../../../messages/${locale}.json`).DialogueFeature;
	const taskIds = courseDialogues[dialogueId].tasks.map(task => String(task.id));
	let vocabularySaves = 0;
	let apiWrites = 0;
	await context.addCookies([{ name: "sj_guest_language", value: locale, url: baseURL }]);
	await context.route("**/*", route => new URL(route.request().url()).origin === new URL(baseURL).origin
		? route.continue()
		: route.fulfill({ contentType: "application/javascript", body: "" }));
	await context.route("**/api/v1/**", async route => {
		const request = route.request();
		const path = new URL(request.url()).pathname;
		const json = data => route.fulfill({ json: { status: "success", data } });
		if (request.method() === "POST") {
			apiWrites += 1;
			if (path === "/api/v1/vocab") {
				vocabularySaves += 1;
				const body = request.postDataJSON();
				return json({ newVocab: { _id: `saved-${vocabularySaves}`, english: body.english } });
			}
			return route.fulfill({ status: 401, json: { status: "fail" } });
		}
		if (path.endsWith("/users/me")) return signedIn
			? json({ user: { _id: userId, name: "Next dialogue tester", language: locale } })
			: route.fulfill({ status: 401, json: { status: "fail" } });
		if (path === `/api/v1/dialogue-progress/${lessonId}`) {
			return json({ progress: signedIn ? [{
				lessonId,
				dialogueId,
				completedTaskIds: taskIds,
			}] : [] });
		}
		if (path === "/api/v1/vocab") return json({ vocabularies: [] });
		return json({ progress: [], vocabularies: [], words: [], topics: [], activities: [] });
	});
	return {
		context,
		page,
		prefix,
		messages,
		get vocabularySaves() { return vocabularySaves; },
		get apiWrites() { return apiWrites; },
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

async function verifyNextDialogue(browser, locale, width, signedIn) {
	const f = await fixture(browser, { locale, width, signedIn });
	const taskCount = courseDialogues[firstDialogueId].tasks.length;
	try {
		await f.openCompletion();
		if (signedIn) {
			const savedMessage = f.messages.dialogueCompletionSaved
				.replace("{completed}", String(taskCount))
				.replace("{total}", String(taskCount));
			await f.page.getByText(savedMessage, { exact: true }).waitFor();
		} else {
			await f.page.getByText(f.messages.dialogueCompletionGuest, { exact: true }).waitFor();
			assert.equal(f.apiWrites, 0, "Guests do not save progress or vocabulary");
		}

		const expectedLabel = f.messages.nextDialogue.replace("{title}", locale === "en" ? "Going to the supermarket" : "Đi đến siêu thị");
		const nextLink = f.page.getByRole("link", { name: expectedLabel, exact: true });
		await nextLink.waitFor({ state: "visible" });
		assert.equal(await nextLink.getAttribute("href"), `${f.prefix}/dialogue/${lessonId}/${nextDialogueId}`);

		if (signedIn) {
			const wordButtons = f.page.locator("button[aria-pressed=true]");
			const selectedCount = await wordButtons.count();
			for (let index = selectedCount - 1; index >= 1; index--) await wordButtons.nth(index).click();
			const saveLabel = f.messages.saveWords.replace("{count}", "1");
			await f.page.getByRole("button", { name: saveLabel, exact: true }).click();
			await f.page.getByText(f.messages.savedWords.replace("{count}", "1"), { exact: true }).waitFor();
			assert.equal(f.vocabularySaves, 1, "Vocabulary save still completes before the next action is used");
			await f.page.getByRole("link", { name: expectedLabel, exact: true }).click();
		} else {
			assert.ok(await f.page.getByRole("button", { name: f.messages.continueWithoutSaving, exact: true }).isVisible());
			assert.ok(await f.page.getByRole("button", { name: f.messages.skip, exact: true }).isVisible());
			await nextLink.click();
		}

		await f.page.waitForURL(url => url.pathname === `${f.prefix}/dialogue/${lessonId}/${nextDialogueId}`);
		assert.equal(f.apiWrites, signedIn ? 1 : 0, "Only the signed-in vocabulary save writes data");
		if (!signedIn) {
			await f.openCompletion();
			await f.page.getByRole("button", { name: f.messages.continueWithoutSaving, exact: true }).click();
			await f.page.waitForURL(url => url.pathname === `${f.prefix}/dialogue/${lessonId}`);
			assert.equal(f.apiWrites, 0, "Continue without saving keeps its existing course destination");
		}
		console.log(`PASS ${locale} ${width}px ${signedIn ? "signed-in" : "guest"} next dialogue navigation`);
	} finally {
		await f.close();
	}
}

async function verifyFinalDialogueFallback(browser, locale, signedIn) {
	const f = await fixture(browser, { locale, width: 390, signedIn, dialogueId: finalDialogueId });
	try {
		await f.openCompletion();
		await f.page.getByText(f.messages.dialogueCompletionTitle, { exact: true }).waitFor();
		assert.equal(await f.page.getByRole("link", { name: /^(Next:|Tiếp theo:)/ }).count(), 0, "The final dialogue has no next-dialogue link");
		await f.page.getByRole("button", { name: f.messages.skip, exact: true }).click();
		await f.page.waitForURL(url => url.pathname === `${f.prefix}/dialogue/${lessonId}`);
		console.log(`PASS ${locale} ${signedIn ? "signed-in" : "guest"} final dialogue returns to course`);
	} finally {
		await f.close();
	}
}

(async () => {
	const browser = await chromium.launch({ channel: "chrome", headless: true });
	try {
		for (const locale of ["vi", "en"]) {
			for (const width of [390, 1280]) {
				await verifyNextDialogue(browser, locale, width, false);
				await verifyNextDialogue(browser, locale, width, true);
			}
			await verifyFinalDialogueFallback(browser, locale, false);
			await verifyFinalDialogueFallback(browser, locale, true);
		}
	} finally {
		await browser.close();
	}
})().catch(error => {
	console.error(error);
	process.exitCode = 1;
});
