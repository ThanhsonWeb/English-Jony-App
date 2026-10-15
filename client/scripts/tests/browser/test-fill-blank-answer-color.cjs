const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const baseURL = process.env.STUDYJONY_TEST_URL || "http://127.0.0.1:3100";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname));
const checkLabel = require("../../../messages/en.json").DialogueFeature.check;

(async () => {
	const browser = await chromium.launch({ channel: "chrome", headless: true });
	try {
		for (const width of [375, 1280]) {
			const context = await browser.newContext({ viewport: { width, height: 900 } });
			await context.addInitScript(() => {
				localStorage.setItem("studyjony-theme", "dark");
				HTMLMediaElement.prototype.play = function () { this.dispatchEvent(new Event("play")); return Promise.resolve(); };
			});
			await context.route("**/api/v1/**", route => {
				const path = new URL(route.request().url()).pathname;
				let data = { progress: [], vocabularies: [], topics: [], activities: [] };
				if (path.endsWith("/users/me")) data = { user: { _id: "aaaaaaaaaaaaaaaaaaaaaaaa", name: "Tester", theme: "dark" } };
				else if (path.endsWith("/attempt")) data = { attemptId: "a".repeat(64), expiresAt: new Date(Date.now() + 600000).toISOString(), readyAfterMs: 0 };
				else if (route.request().method() === "PATCH") data = { progress: { completedTaskIds: [path.split("/").at(-1)] } };
				return route.fulfill({ json: { status: "success", data } });
			});
			const page = await context.newPage();
			try {
				for (const fixture of [
					{ path: "naruto-season-1/the-lonely-boy/1", answers: ["alone"] },
					{ path: "asking-for-directions/finding-the-train-station/1", answers: ["going", "today"] },
				]) {
					await page.goto(`${baseURL}/en/dialogue/${fixture.path}`);
					const inputs = page.locator('input[placeholder="..."]');
					await inputs.first().waitFor();
					assert.equal(await inputs.count(), fixture.answers.length);
					const sentenceColor = await inputs.first().evaluate(input => getComputedStyle(input.parentElement).color);
					const originalAnswerColor = await inputs.first().evaluate(input => getComputedStyle(input).color);
					for (let index = 0; index < fixture.answers.length; index++) await inputs.nth(index).fill("wrong");
					await page.getByRole("button", { name: checkLabel, exact: true }).click();
					assert.equal(await inputs.evaluateAll(elements => elements.every(input => !input.classList.contains("text-green-400"))), true, "Wrong answers stay unchanged");
					assert.equal(await inputs.first().evaluate(input => getComputedStyle(input).color), originalAnswerColor);
					for (const [index, answer] of fixture.answers.entries()) await inputs.nth(index).fill(answer);
					const submittedAt = Date.now();
					await page.getByRole("button", { name: checkLabel, exact: true }).click();
					await page.waitForFunction(count => {
						const inputs = [...document.querySelectorAll('input[placeholder="..."]')];
						return inputs.length === count && inputs.every(input => input.classList.contains("text-green-400"));
					}, fixture.answers.length);
					assert.equal(await inputs.evaluateAll(elements => elements.every(input => getComputedStyle(input).color !== getComputedStyle(input.parentElement).color)), true, "Only filled words turn green");
					assert.equal(await inputs.first().evaluate(input => getComputedStyle(input.parentElement).color), sentenceColor, "Sentence color stays white");
					assert.ok(page.url().endsWith(fixture.path), "Correct color appears before navigation");
					await page.waitForURL(url => !url.pathname.endsWith(fixture.path));
					assert.ok(Date.now() - submittedAt >= 350, "Auto-advance still waits about 400ms");
				}
				console.log(`PASS ${width}px: one and two blanks, wrong answer unchanged, immediate green answers, white sentence, auto-advance`);
			} finally { await context.close(); }
		}
	} finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
