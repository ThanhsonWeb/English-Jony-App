// The first A1 dialogue has a clear, data-backed start point on mobile.
const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const baseURL = process.env.STUDYJONY_TEST_URL || "http://localhost:3000";
const lessonId = "asking-for-directions";
const dialogue = require("../../../app/[locale]/(main)/dialogue/_data/dialogues/asking-for-directions/finding-the-bus-stop.json");
const userId = "aaaaaaaaaaaaaaaaaaaaaaaa";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname));

const activityKeys = {
	fillBlank: "fillBlankTitle",
	multipleChoice: "starterQuiz",
	dialogueCloze: "dialogueClozeTitle",
};

async function run(browser, locale, signedIn) {
	const prefix = locale === "en" ? "/en" : "";
	const t = require(`../../../messages/${locale}.json`).DialogueFeature;
	const context = await browser.newContext({
		viewport: { width: 390, height: 844 },
		isMobile: true,
		hasTouch: true,
	});
	await context.addCookies([{ name: "sj_guest_language", value: locale, url: baseURL }]);
	const requests = [];
	const pageErrors = [];
	await context.route("**/*", route => new URL(route.request().url()).origin === new URL(baseURL).origin
		? route.continue()
		: route.fulfill({ body: "" }));
	await context.route("**/api/v1/**", route => {
		const request = route.request();
		const path = new URL(request.url()).pathname;
		requests.push({ method: request.method(), path });
		if (path.endsWith("/users/me")) {
			return signedIn
				? route.fulfill({ json: { status: "success", data: { user: {
					_id: userId, name: "Beginner starter tester", language: locale, theme: "light",
				} } } })
				: route.fulfill({ status: 401, json: { status: "fail" } });
		}
		if (request.method() === "GET" && path === `/api/v1/dialogue-progress/${lessonId}`) {
			return route.fulfill({ json: { status: "success", data: { progress: [] } } });
		}
		return route.fulfill({ json: { status: "success", data: { progress: [], vocabularies: [], topics: [], activities: [] } } });
	});

	const page = await context.newPage();
	page.setDefaultTimeout(20000);
	page.on("pageerror", error => pageErrors.push(error.message));
	try {
		const sessionResponse = page.waitForResponse(response => new URL(response.url()).pathname.endsWith("/users/me"));
		await page.goto(`${baseURL}${prefix}/dialogue/${lessonId}`, { waitUntil: "domcontentloaded", timeout: 90000 });
		await sessionResponse;

		const starter = page.getByTestId("beginner-starter-overview");
		await starter.waitFor();
		assert.equal(await page.getByTestId("beginner-starter-overview").count(), 1, "Only the first dialogue gets the starter panel");
		assert.equal(
			await starter.getByTestId("beginner-starter-task-count").innerText(),
			t.starterTaskCount.replace("{count}", String(dialogue.tasks.length)),
			"The displayed practice count comes from the dialogue's task data",
		);

		const activityText = await starter.getByTestId("beginner-starter-activities").innerText();
		const expectedActivityKeys = [
			"starterListen",
			...[...new Set(dialogue.tasks.map(task => activityKeys[task.type]).filter(Boolean))],
		];
		for (const key of expectedActivityKeys) assert.ok(activityText.includes(t[key]), `Starter summary includes ${key}`);

		const startLink = starter.getByRole("link", { name: t.starterStartHere, exact: true });
		assert.ok(await startLink.isVisible());
		const startBox = await startLink.boundingBox();
		assert.ok(startBox && startBox.height >= 44, "Start here has a mobile-sized touch target");
		const expectedPlayerPath = `${prefix}/dialogue/${lessonId}/${dialogue.metadata.dialogueId}`;
		assert.equal(new URL(await startLink.getAttribute("href"), baseURL).pathname, expectedPlayerPath);

		const dialogueSection = page.locator("section").filter({
			has: page.getByRole("heading", { name: t.dialoguesHeading, exact: true }),
		});
		await dialogueSection.locator('button[aria-expanded]').first().click();
		const taskPrefix = `${prefix}/dialogue/${lessonId}/${dialogue.metadata.dialogueId}/`;
		const taskPaths = await page.locator("a[href]").evaluateAll((links, prefixValue) => links
			.map(link => new URL(link.href).pathname)
			.filter(path => path.startsWith(prefixValue) && /^\d+$/.test(path.slice(prefixValue.length))), taskPrefix);
		assert.deepEqual(
			taskPaths,
			dialogue.tasks.map(task => `${taskPrefix}${task.id}`),
			"All practice tasks remain available in their original order",
		);

		if (signedIn) {
			assert.equal(await page.getByText(t.guestProgressNotSaved, { exact: true }).count(), 0);
			assert.ok(requests.some(request => request.method === "GET" && request.path === `/api/v1/dialogue-progress/${lessonId}`));
		} else {
			await page.getByRole("note").filter({ hasText: t.guestProgressNotSaved }).waitFor();
			assert.equal(requests.filter(request => request.path.startsWith("/api/v1/dialogue-progress/")).length, 0, "Guests do not request saved account progress");
		}

		assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "The starter panel fits the mobile viewport");
		await startLink.click();
		await page.waitForURL(url => url.pathname === expectedPlayerPath);
		assert.equal(requests.some(request => request.method === "PATCH" || request.method === "POST"), false, "Starting the dialogue does not save progress");
		assert.deepEqual(pageErrors, []);
		console.log(`PASS ${locale} 390px ${signedIn ? "signed-in" : "guest"}: activity summary, data-backed count, start route, and ordered tasks`);
	} finally {
		await context.close();
	}
}

async function otherCoursesUnchanged(browser) {
	const locale = "en";
	const t = require("../../../messages/en.json").DialogueFeature;
	const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
	await context.addCookies([{ name: "sj_guest_language", value: locale, url: baseURL }]);
	await context.route("**/api/v1/**", route => route.fulfill({ status: 401, json: { status: "fail" } }));
	const page = await context.newPage();
	try {
		await page.goto(`${baseURL}/en/dialogue/coffee-shop`, { waitUntil: "domcontentloaded", timeout: 90000 });
		const section = page.locator("section").filter({
			has: page.getByRole("heading", { name: t.dialoguesHeading, exact: true }),
		});
		await section.waitFor();
		assert.equal(await page.getByTestId("beginner-starter-overview").count(), 0, "Other courses keep their existing layout");
		await section.locator('button[aria-expanded]').first().click();
		assert.equal(await page.getByRole("link", { name: t.listenDialogue, exact: true }).count(), 1, "Other courses retain their existing listen action");
		console.log("PASS 390px: non-target courses remain unchanged");
	} finally {
		await context.close();
	}
}

(async () => {
	const browser = await chromium.launch({ channel: "chrome", headless: true });
	try {
		for (const locale of ["vi", "en"]) {
			for (const signedIn of [false, true]) await run(browser, locale, signedIn);
		}
		await otherCoursesUnchanged(browser);
	} finally {
		await browser.close();
	}
})().catch(error => { console.error(error); process.exitCode = 1; });
