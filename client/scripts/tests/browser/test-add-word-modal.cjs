// Local-only browser checks; all API writes are mocked.
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const base = process.env.STUDYJONY_TEST_URL || "http://localhost:3000";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname));

(async () => {
	const browser = await chromium.launch({ channel: "chrome", headless: true });
	try {
		for (const locale of ["vi", "en"]) for (const width of [1440, 390]) for (const type of ["word", "phrase"]) {
			const t = require(`../../../messages/${locale}.json`).Notebook;
			const page = await browser.newPage({ viewport: { width, height: width < 768 ? 667 : 900 } });
			const writes = [];
			await page.addInitScript(() => localStorage.setItem("studyjony-theme", "dark"));
			await page.route("**/*", route => {
				const url = new URL(route.request().url());
				if (url.origin !== new URL(base).origin) return route.abort();
				if (!url.pathname.startsWith("/api/")) return route.continue();
				if (url.pathname.endsWith("/users/me")) return route.fulfill({ json: { data: { user: { _id: "learner", name: "Test", role: "user", language: locale, theme: "dark" } } } });
				if (url.pathname.startsWith("/api/v1/dictionary/")) return route.fulfill({ json: { data: { pronunciation: "/test/" } } });
				if (url.pathname === "/api/v1/vocab" && route.request().method() === "POST") {
					const body = route.request().postDataJSON(); writes.push(body);
					if (writes.length > 1) return route.fulfill({ status: 409, json: { code: "duplicateVocabulary" } });
					return route.fulfill({ status: 201, json: { data: { newVocab: { ...body, _id: "added" } } } });
				}
				return route.fulfill({ json: { data: { vocabularies: [], topics: [] } } });
			});
			try {
				await page.goto(`${base}/${locale}/wordlist`, { waitUntil: "domcontentloaded" });
				await page.getByRole("button", { name: locale === "en" && width < 768 ? "Add your first word" : t.addWord, exact: true }).first().click();
				const dialog = page.getByRole("dialog", { name: t.addWord });
				await dialog.waitFor();
				assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
				assert.equal(await dialog.getByText(t.addWordSubtitle).count(), 1);
				const wordTab = dialog.getByRole("button", { name: t.entryTypeWord, exact: true });
				const phraseTab = dialog.getByRole("button", { name: t.entryTypePhrase, exact: true });
				assert.equal(await wordTab.getAttribute("aria-pressed"), "true");
				if (type === "phrase") await phraseTab.click();
				assert.equal(await (type === "phrase" ? phraseTab : wordTab).getAttribute("aria-pressed"), "true");
				assert.equal(await (type === "phrase" ? phraseTab : wordTab).evaluate(node => getComputedStyle(node).color), "rgb(255, 255, 255)");
				assert.equal(await dialog.getByRole("button", { name: t.save, exact: true }).evaluate(node => getComputedStyle(node).color), "rgb(255, 255, 255)");
				const english = type === "phrase" ? "make a fire" : "listen";
				const meaning = type === "phrase" ? "nhóm lửa" : "lắng nghe";
				assert.equal(await dialog.locator('input[name="english"]').getAttribute("placeholder"), t[type === "phrase" ? "phraseInputPlaceholder" : "wordInputPlaceholder"]);
				await dialog.locator('input[name="english"]').fill(english);
				await dialog.locator('input[name="vietnamese"]').fill(meaning);
				await dialog.locator('textarea[name="example"]').fill("Example sentence.");
				await page.waitForResponse(response => response.url().includes(`/api/v1/dictionary/${encodeURIComponent(english)}`));
				await (type === "phrase" ? wordTab : phraseTab).click();
				await (type === "phrase" ? phraseTab : wordTab).click();
				assert.equal(await dialog.locator('input[name="english"]').inputValue(), english);
				assert.equal(await dialog.locator('input[name="vietnamese"]').inputValue(), meaning);
				const bounds = await dialog.boundingBox();
				assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width);
				await dialog.getByRole("button", { name: t.save, exact: true }).click();
				await dialog.waitFor({ state: "hidden" });
				assert.equal(writes.length, 1);
				assert.deepEqual(Object.fromEntries(["english", "vietnamese", "pronunciation", "example"].map(key => [key, writes[0][key]])), { english, vietnamese: meaning, pronunciation: "/test/", example: "Example sentence." });
				assert.equal(writes[0].topic, undefined);
				assert.equal(writes[0].reviewCount, undefined);
				assert.equal(writes[0].nextReview, undefined);
				await page.getByRole("button", { name: t.addWord, exact: true }).first().click();
				if (type === "phrase") await phraseTab.click();
				await dialog.locator('input[name="english"]').fill(english);
				await dialog.locator('input[name="vietnamese"]').fill(meaning);
				await dialog.getByRole("button", { name: t.save, exact: true }).click();
				await dialog.getByRole("alert").getByText(t.duplicateWord, { exact: true }).waitFor();
				assert.equal(await dialog.locator('input[name="english"]').inputValue(), english);
				console.log(`PASS ${locale} ${width}px ${type}: modal and save payload`);
			} finally { await page.close(); }
		}
	} finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
