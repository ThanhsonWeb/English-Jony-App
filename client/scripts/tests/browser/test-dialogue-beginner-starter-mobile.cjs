// First Dialogue keeps its original Listen action and ordered practice links.
const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const baseURL = process.env.STUDYJONY_TEST_URL || "http://localhost:3000";
const lessonId = "asking-for-directions";
const dialogue = require("../../../app/[locale]/(main)/dialogue/_data/dialogues/asking-for-directions/finding-the-bus-stop.json");
const userId = "aaaaaaaaaaaaaaaaaaaaaaaa";
const dialogueId = dialogue.metadata.dialogueId;
const taskIds = dialogue.tasks.map(task => String(task.id));
const prefixFor = locale => locale === "en" ? "/en" : "";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname));

async function run(browser, locale, width, state) {
	const prefix = prefixFor(locale);
	const t = require(`../../../messages/${locale}.json`).DialogueFeature;
	const context = await browser.newContext({
		viewport: { width, height: 844 },
		isMobile: width < 768,
		hasTouch: width < 768,
	});
	await context.addCookies([{ name: "sj_guest_language", value: locale, url: baseURL }]);
	const requests = [];
	const pageErrors = [];
	await context.route("**/*", route => new URL(route.request().url()).origin === new URL(baseURL).origin
		? route.continue() : route.fulfill({ body: "" }));
	await context.route("**/api/v1/**", route => {
		const request = route.request();
		const path = new URL(request.url()).pathname;
		requests.push({ method: request.method(), path });
		if (path.endsWith("/users/me")) {
			return state === "guest"
				? route.fulfill({ status: 401, json: { status: "fail" } })
				: route.fulfill({ json: { status: "success", data: { user: {
					_id: userId, name: "First dialogue tester", language: locale, theme: "light",
				} } } });
		}
		if (request.method() === "GET" && path === `/api/v1/dialogue-progress/${lessonId}`) {
			const completedTaskIds = state === "completed" ? taskIds : state === "inProgress" ? taskIds.slice(0, 1) : [];
			return route.fulfill({ json: { status: "success", data: { progress: state === "guest" ? [] : [{
				dialogueId,
				completedTaskIds,
				updatedAt: "2026-01-01T00:00:00.000Z",
			}] } } });
		}
		return route.fulfill({ json: { status: "success", data: { progress: [], vocabularies: [], topics: [], activities: [] } } });
	});

	const page = await context.newPage();
	page.setDefaultTimeout(20000);
	page.on("pageerror", error => pageErrors.push(error.message));
	try {
		const session = page.waitForResponse(response => new URL(response.url()).pathname.endsWith("/users/me"));
		await page.goto(`${baseURL}${prefix}/dialogue/${lessonId}`, { waitUntil: "domcontentloaded", timeout: 90000 });
		await session;
		const section = page.locator("section").filter({ has: page.getByRole("heading", { name: t.dialoguesHeading, exact: true }) });
		const rows = section.locator("button[aria-expanded]");
		const row = rows.first();
		await row.waitFor({ state: "visible" });
		assert.equal(await page.getByTestId("beginner-starter-overview").count(), 0, "The Beginner Starter Panel is removed");
		assert.equal(await page.getByTestId("beginner-starter-link").count(), 0, "The starter CTA is removed");
		if (state === "guest") {
			await page.getByText(t.guestProgressNotSaved, { exact: true }).waitFor();
			assert.equal(await row.getByTestId("dialogue-progress-status").count(), 0, "Guests see no saved progress status");
			assert.equal(requests.some(request => request.path.startsWith("/api/v1/dialogue-progress/")), false, "Guests do not request account progress");
		} else {
			const expectedStatus = state === "completed" ? t.completed : state === "inProgress" ? t.continue : t.notStarted;
			await page.waitForFunction(({ status }) => [...document.querySelectorAll('[data-testid="dialogue-progress-status"]')]
				.some(element => element.textContent.trim() === status), { status: expectedStatus });
			const badges = await row.getByTestId("dialogue-progress-status").all();
			let visibleStatus = null;
			for (const badge of badges) if (await badge.isVisible()) visibleStatus = await badge.innerText();
			assert.equal(visibleStatus, expectedStatus, `${state} progress status is retained`);
		}

		await row.click();
		const card = row.locator("xpath=..");
		const listen = card.getByRole("link", { name: t.listenDialogue, exact: true });
		await listen.waitFor({ state: "visible" });
		assert.equal(new URL(await listen.getAttribute("href"), baseURL).pathname, `${prefix}/dialogue/${lessonId}/${dialogueId}`);
		const taskPrefix = `${prefix}/dialogue/${lessonId}/${dialogueId}/`;
		const actualTaskRoutes = await card.locator("a[href]").evaluateAll((links, routePrefix) => links
			.map(link => new URL(link.href).pathname)
			.filter(path => path.startsWith(routePrefix) && /^\d+$/.test(path.slice(routePrefix.length))), taskPrefix);
		assert.deepEqual(actualTaskRoutes, taskIds.map(taskId => `${taskPrefix}${taskId}`), "All 25 practice tasks remain in their original order");
		assert.deepEqual(pageErrors, []);
		console.log(`PASS ${locale} ${width}px ${state}: Listen action, ordered tasks, and progress state`);
	} finally {
		await context.close();
	}
}

(async () => {
	const browser = await chromium.launch({ channel: "chrome", headless: true });
	try {
		for (const locale of ["vi", "en"]) {
			for (const width of [390, 1280]) {
				for (const state of ["guest", "zero", "inProgress", "completed"]) await run(browser, locale, width, state);
			}
		}
	} finally {
		await browser.close();
	}
})().catch(error => { console.error(error); process.exitCode = 1; });
