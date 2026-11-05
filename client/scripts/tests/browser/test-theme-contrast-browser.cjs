// Run with the Next app available at STUDYJONY_TEST_URL (default: localhost:3000).
// API requests are intercepted; this test does not change live data.
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const AxeBuilder = require("@axe-core/playwright").default;

const baseURL = process.env.STUDYJONY_TEST_URL || "http://localhost:3000";
const themes = ["light", "dark"];
const pages = [
	{ name: "Homepage", path: "/en" },
	{ name: "Dialogue overview", path: "/en/dialogue" },
	{
		name: "Story overview",
		path: "/en/dialogue",
		async prepare(page) {
			const storyCategory = page.getByRole("button", { name: /Story of Life/ });
			await storyCategory.click();
			assert.equal(await storyCategory.getAttribute("aria-pressed"), "true");
		},
	},
	{ name: "Wordlist overview", path: "/en/wordlist" },
	{ name: "Login", path: "/en/login" },
	{ name: "Sign up", path: "/en/signup" },
];

function checkSummary(checks = []) {
	return checks.map(({ id, message, data = {} }) => ({
		id,
		message,
		foreground: data.fgColor,
		background: data.bgColor,
		contrastRatio: data.contrastRatio,
		expectedContrastRatio: data.expectedContrastRatio,
	}));
}

function nodeSummary(node) {
	return {
		target: node.target,
		html: node.html,
		failureSummary: node.failureSummary,
		checks: [...checkSummary(node.any), ...checkSummary(node.all), ...checkSummary(node.none)],
	};
}

function hexToRgb(color) {
	const value = color.replace(/^#/, "");
	const normalized = value.length === 3
		? value.split("").map((part) => part + part).join("")
		: value;
	assert.match(normalized, /^[\da-f]{6}$/i, `Expected a solid hex theme token, got ${color}`);
	const channels = normalized.match(/[\da-f]{2}/gi).map((channel) => parseInt(channel, 16));
	return `rgb(${channels.join(", ")})`;
}

async function assertThemeApplied(page, theme) {
	const computedTheme = await page.evaluate(() => {
		const root = document.documentElement;
		return {
			attribute: root.dataset.theme,
			colorScheme: getComputedStyle(root).colorScheme,
			pageToken: getComputedStyle(root).getPropertyValue("--sj-page").trim(),
			bodyBackground: getComputedStyle(document.body).backgroundColor,
		};
	});
	assert.equal(computedTheme.attribute, theme, `Root data-theme should be ${theme}`);
	assert.equal(computedTheme.colorScheme, theme, `Computed color-scheme should be ${theme}`);
	assert.equal(computedTheme.bodyBackground, hexToRgb(computedTheme.pageToken));
	return computedTheme;
}

async function scanContrast(page, label, failures, include) {
	const axe = new AxeBuilder({ page });
	if (include) axe.include(include);
	const results = await axe.withRules(["color-contrast"]).analyze();
	console.log(`\n${label}: ${results.violations.length} violation(s)`);
	for (const violation of results.violations) {
		console.log(`${violation.impact || "unknown impact"}: ${violation.help}`);
		console.log(JSON.stringify(violation.nodes.map(nodeSummary), null, 2));
	}

	const incompleteNodes = results.incomplete.reduce((count, result) => count + result.nodes.length, 0);
	console.log(`${label}: ${incompleteNodes} incomplete element check(s)`);
	for (const result of results.incomplete) {
		const reasons = [...new Set(result.nodes.flatMap((node) =>
			[...node.any, ...node.all, ...node.none].map((check) => check.message),
		))];
		console.log(`  ${result.id}: ${result.nodes.length} elements; ${reasons.join("; ")}`);
	}
	if (results.violations.length > 0) failures.push(`${label}: ${results.violations.length} color-contrast violation(s)`);
	return results;
}

async function checkSubtitleWordStates(browser, theme, failures) {
	const label = `Dialogue Player word states | ${theme}`;
	const context = await browser.newContext({ colorScheme: theme });
	const page = await context.newPage();
	try {
		await page.addInitScript((preference) => {
			localStorage.setItem("studyjony-theme", preference);
			const NativeImage = window.Image;
			window.Image = class extends NativeImage {
				decode() { return Promise.resolve(); }
			};
			HTMLMediaElement.prototype.play = function () {
				this.dispatchEvent(new Event("play"));
				return Promise.resolve();
			};
		}, theme);
		await page.route("**/api/v1/**", (route) =>
			route.fulfill({ status: 401, json: { status: "error" } }),
		);
		await page.goto(`${baseURL.replace(/\/$/, "")}/en/dialogue/naruto-season-1/the-lonely-boy`, { waitUntil: "domcontentloaded" });
		await page.getByRole("heading", { level: 1 }).waitFor();
		await assertThemeApplied(page, theme);
		await page.getByRole("button", { name: "Transcript" }).click();
		await page.getByRole("button").filter({ has: page.locator("p.mt-1") }).first().click();

		const word = page.locator('.dialogue-subtitle-text [data-dictionary-token="true"]').filter({ hasText: /^are$/i });
		await word.waitFor();
		const expectedColors = await page.evaluate(() => {
			const rootStyle = getComputedStyle(document.documentElement);
			return {
				background: rootStyle.getPropertyValue("--sj-player-selected").trim(),
				foreground: rootStyle.getPropertyValue("--sj-player-selected-text").trim(),
			};
		});
		const assertWordColors = async (state) => {
			const expected = {
				text: "are",
				background: hexToRgb(expectedColors.background),
				foreground: hexToRgb(expectedColors.foreground),
			};
			await page.waitForFunction(({ text, background, foreground }) => {
				const element = [...document.querySelectorAll('.dialogue-subtitle-text [data-dictionary-token="true"]')]
					.find((candidate) => candidate.textContent.trim().toLowerCase() === text);
				if (!element) return false;
				const style = getComputedStyle(element);
				return style.backgroundColor === background && style.color === foreground;
			}, expected);
			const colors = await word.evaluate((element) => ({
				background: getComputedStyle(element).backgroundColor,
				foreground: getComputedStyle(element).color,
			}));
			assert.equal(colors.background, expected.background, `${state} background should use the active player token`);
			assert.equal(colors.foreground, expected.foreground, `${state} text should use the active player token`);
			const stateSelector = {
				hover: '.dialogue-subtitle-text [data-dictionary-token="true"]:hover',
				focus: '.dialogue-subtitle-text [data-dictionary-token="true"]:focus-visible',
				selected: '.dialogue-subtitle-text [data-dictionary-token="true"].bg-player-selected',
			}[state];
			await scanContrast(page, `${label} | ${state}`, failures, stateSelector);
		};

		await word.hover();
		await assertWordColors("hover");

		await page.keyboard.press("Tab");
		await word.focus();
		assert.equal(await word.evaluate((element) => element.matches(":focus-visible")), true, "Word should show its keyboard focus state");
		await assertWordColors("focus");

		await word.click();
		await page.locator(".dialogue-word-popup").waitFor();
		assert.equal((await page.locator(".dialogue-word-popup strong").textContent()).toLowerCase(), "are");
		await assertWordColors("selected");
	} finally {
		await context.close();
	}
}

async function run() {
	const browser = await chromium.launch({ channel: "chrome", headless: true });
	const failures = [];

	try {
		for (const pageCase of pages) {
			for (const theme of themes) {
				const label = `${pageCase.name} | ${theme}`;
				const context = await browser.newContext({ colorScheme: theme });
				const page = await context.newPage();
				try {
					await page.addInitScript((preference) => {
						window.localStorage.setItem("studyjony-theme", preference);
					}, theme);
					await page.route("**/api/v1/**", (route) =>
						route.fulfill({ status: 401, json: { status: "error" } }),
					);
					await page.goto(`${baseURL.replace(/\/$/, "")}${pageCase.path}`, { waitUntil: "domcontentloaded" });
					await page.getByRole("heading", { level: 1 }).waitFor();
					if (pageCase.prepare) await pageCase.prepare(page);

					const computedTheme = await assertThemeApplied(page, theme);
					console.log(`${label}: theme applied (${computedTheme.pageToken})`);
					await scanContrast(page, label, failures);
				} catch (error) {
					failures.push(`${label}: ${error.message}`);
					console.error(`\n${label}: test error\n${error.stack || error.message}`);
				} finally {
					await context.close();
				}
			}
		}
		for (const theme of themes) await checkSubtitleWordStates(browser, theme, failures);
	} finally {
		await browser.close();
	}

	if (failures.length > 0) {
		throw new Error(failures.join("\n"));
	}
	console.log("\nPASS Public-page color-contrast scans in Light and Dark Mode.");
}

run().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
