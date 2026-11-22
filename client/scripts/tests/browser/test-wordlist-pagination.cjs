// Local browser test with a mocked, read-only vocabulary fixture.
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const base = process.env.STUDYJONY_TEST_URL || "http://localhost:3000";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
const words = Array.from({ length: 126 }, (_, index) => ({
	_id: String(index + 1), english: `fixtureword${String(index + 1).padStart(3, "0")}`,
	vietnamese: `meaning ${index + 1}`, reviewCount: 0, learningLevel: 0, status: false,
}));

(async () => {
	const browser = await chromium.launch({ channel: "chrome", headless: true });
	try {
		for (const locale of ["vi", "en"]) for (const width of [320, 390, 1440]) {
			const t = require(`../../../messages/${locale}.json`).Notebook;
			const page = await browser.newPage({ viewport: { width, height: 800 } });
			await page.addInitScript(() => localStorage.setItem("studyjony-theme", "dark"));
			await page.route("**/*", route => {
				const url = new URL(route.request().url());
				if (url.origin !== new URL(base).origin) return route.abort();
				if (!url.pathname.startsWith("/api/")) return route.continue();
				if (route.request().method() !== "GET") return route.abort();
				if (url.pathname.endsWith("/users/me")) return route.fulfill({ json: { data: { user: { _id: "learner", name: "Test", role: "user", language: locale, theme: "dark" } } } });
				return route.fulfill({ json: { data: { vocabularies: words, topics: [] } } });
			});
			try {
				await page.goto(`${base}/${locale}/wordlist`, { waitUntil: "domcontentloaded" });
				const nav = page.getByRole("navigation", { name: t.paginationLabel });
				await nav.waitFor();
				assert.equal(await nav.evaluate(node => node.parentElement.contains(node.parentElement.querySelector("table"))), true, "Pagination shares the table frame");
				const number = n => nav.getByRole("button", { name: t.pageNumber.replace("{number}", n), exact: true });
				assert.equal(await number(1).getAttribute("aria-current"), "page");
				assert.equal(await number(1).evaluate(node => getComputedStyle(node).backgroundColor), "rgb(11, 118, 109)");
				assert.equal(await number(1).evaluate(node => getComputedStyle(node).color), "rgb(255, 255, 255)");
				assert.equal(await nav.getByRole("button", { name: t.firstPage }).isDisabled(), true);
				assert.equal(await nav.getByRole("button", { name: t.previous, exact: true }).isDisabled(), true);
				assert.match(await nav.innerText(), /126/);
				assert.equal(await page.locator("table tbody tr").count(), 15);
				await page.getByText("fixtureword015", { exact: true }).waitFor();
				assert.equal(await page.getByText("fixtureword016", { exact: true }).count(), 0);
				await number(2).click();
				assert.equal(await number(2).getAttribute("aria-current"), "page");
				await page.getByText("fixtureword016", { exact: true }).waitFor();
				assert.equal(await page.getByText("fixtureword001", { exact: true }).count(), 0);
				await nav.getByRole("button", { name: t.lastPage }).click();
				assert.equal(await number(9).getAttribute("aria-current"), "page");
				await page.getByText("fixtureword126", { exact: true }).waitFor();
				assert.equal(await page.locator("table tbody tr").count(), 6);
				assert.equal(await nav.getByRole("button", { name: t.next, exact: true }).isDisabled(), true);
				await nav.getByRole("button", { name: t.previous, exact: true }).click();
				assert.equal(await number(8).getAttribute("aria-current"), "page");
				await page.getByRole("textbox", { name: t.search }).fill("fixtureword001");
				await page.getByText("fixtureword001", { exact: true }).waitFor();
				assert.equal(await number(1).getAttribute("aria-current"), "page");
				assert.equal(await nav.getByRole("button", { name: t.lastPage }).isDisabled(), true);
				assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
				console.log(`PASS ${locale} ${width}px: navigation, bounds, search and count`);
			} finally { await page.close(); }
		}
	} finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
