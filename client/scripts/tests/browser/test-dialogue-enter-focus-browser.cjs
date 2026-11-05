// Keyboard focus checks for the Dialogue exercise Enter shortcut.
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const rules = require("../../../../server/data/dialogueTaskRules.json");
const t = require("../../../messages/en.json").DialogueFeature;

const baseURL = process.env.STUDYJONY_TEST_URL || "http://localhost:3000";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname));
const multipleChoicePath = "/en/dialogue/a-little-lie/a-little-lie/11";

async function createPage(browser) {
	const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
	await context.addCookies([{ name: "sj_guest_language", value: "en", url: baseURL }]);
	await context.addInitScript(() => {
		localStorage.setItem("studyjony-theme", "dark");
		HTMLMediaElement.prototype.play = () => Promise.resolve();
		HTMLMediaElement.prototype.pause = () => {};
	});
	await context.route("**/*", (route) => new URL(route.request().url()).origin === new URL(baseURL).origin
		? route.continue()
		: route.fulfill({ body: "" }));
	await context.route("**/api/v1/**", (route) => {
		const path = new URL(route.request().url()).pathname;
		if (path.endsWith("/users/me")) return route.fulfill({ status: 401, json: { status: "fail" } });
		return route.fulfill({ json: { status: "success", data: { progress: [], vocabularies: [], topics: [], activities: [] } } });
	});
	const page = await context.newPage();
	const errors = [];
	page.on("pageerror", (error) => errors.push(error.message));
	return { context, page, errors };
}

async function answerOptionFocus(browser) {
	const fixture = await createPage(browser);
	try {
		await fixture.page.goto(`${baseURL}${multipleChoicePath}`);
		const options = fixture.page.locator("button:has(kbd)");
		assert.equal(await options.count(), 4, "Expected four keyboard-selectable answers");
		await fixture.page.keyboard.press("1");
		await fixture.page.waitForFunction(() => [...document.querySelectorAll("button:has(kbd)")]
			.some((button) => button.className.includes("bg-violet-500/10")));
		await options.nth(1).focus();
		await fixture.page.keyboard.press("Enter");
		await fixture.page.waitForFunction(() => {
			const options = [...document.querySelectorAll("button")].filter((button) => button.querySelector("kbd"));
			return options[1]?.className.includes("bg-violet-500/10");
		});
		assert.equal(new URL(fixture.page.url()).pathname, multipleChoicePath, "Enter selects the focused option without submitting");
		assert.equal(await fixture.page.getByText(t.wrong, { exact: true }).count(), 0, "Focused answer is not checked by the global shortcut");

		await fixture.page.getByRole("button", { name: t.check, exact: true }).focus();
		await fixture.page.keyboard.press("Enter");
		await fixture.page.getByText(t.wrong, { exact: true }).waitFor();
		assert.equal(new URL(fixture.page.url()).pathname, multipleChoicePath, "Enter on the Check button activates its native action");
		assert.deepEqual(fixture.errors, []);
		console.log("PASS focused answer Enter selects; Check button Enter submits");
	} finally {
		await fixture.context.close();
	}
}

async function navigationLinkFocus(browser) {
	const fixture = await createPage(browser);
	try {
		await fixture.page.goto(`${baseURL}${multipleChoicePath}`);
		await fixture.page.getByRole("link", { name: t.nextExercise }).focus();
		await fixture.page.keyboard.press("Enter");
		await fixture.page.waitForURL((url) => url.pathname === multipleChoicePath.replace(/\/11$/, "/12"));
		assert.deepEqual(fixture.errors, []);
		console.log("PASS Enter on a focused next-exercise link navigates normally");
	} finally {
		await fixture.context.close();
	}
}

async function fillBlankEnter(browser) {
	const fixture = await createPage(browser);
	try {
		const ids = ["ten-minutes-a-day", "the-old-book", "1"];
		const rule = rules.find((item) => item.ids.join("/") === ids.join("/"));
		assert.equal(rule.type, "fillBlank");
		await fixture.page.goto(`${baseURL}/en/dialogue/${ids.join("/")}`);
		const inputs = fixture.page.locator('input[placeholder="..."]');
		for (const [index, answer] of rule.answers.entries()) await inputs.nth(index).fill(answer);
		await inputs.last().press("Enter");
		await fixture.page.locator("#guest-progress-title").waitFor();
		await fixture.page.getByRole("button", { name: t.guestLater, exact: true }).click();
		await fixture.page.waitForURL((url) => url.pathname === `/en/dialogue/${ids[0]}/${ids[1]}/2`);
		assert.deepEqual(fixture.errors, []);
		console.log("PASS Enter in the Fill in the Blank input still submits and advances");
	} finally {
		await fixture.context.close();
	}
}

(async () => {
	const browser = await chromium.launch({ channel: "chrome", headless: true });
	try {
		await answerOptionFocus(browser);
		await navigationLinkFocus(browser);
		await fillBlankEnter(browser);
	} finally {
		await browser.close();
	}
})().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
