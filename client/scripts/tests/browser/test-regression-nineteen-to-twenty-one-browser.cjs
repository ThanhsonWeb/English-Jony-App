// Requires Next dev and Playwright; APIs are mocked and no live data is changed.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const baseURL = process.env.STUDYJONY_TEST_URL || "http://localhost:3000";
const topicId = "000000000000000000000099";
const fixtureDir = path.resolve(__dirname, "../../../app/[locale]/(main)/regression-boundary-fixture");
const fixtureFile = path.join(fixtureDir, "page.jsx");
const fixture = `"use client";
import { useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import RootError from "@/app/error";
import LocaleError from "@/app/[locale]/error";
import RootNotFound from "@/app/not-found";
import LocaleNotFound from "@/app/[locale]/not-found";
export default function Fixture() {
 const mode = useSearchParams().get("mode");
 const { locale } = useParams();
 const [retried, setRetried] = useState(false);
 if (mode === "oauth") return <Link href={(locale === "en" ? "/en" : "") + "/oauth/google/callback"}>Start callback</Link>;
 if (retried) return <p role="status">Retry requested</p>;
 const reset = () => setRetried(true);
 if (mode === "root-error") return <RootError reset={reset} />;
 if (mode === "locale-error") return <LocaleError reset={reset} />;
 if (mode === "root-not-found") return <RootNotFound />;
 return <LocaleNotFound />;
}`;
function word(index, status = "new") {
	return { _id: String(index).padStart(24, "0"), topic: topicId, english: `word${index}`, vietnamese: "nghĩa tiếng Việt", example: "Vietnamese meanings are learning content.", pronunciation: "/test/", reviewCount: status === "new" ? 0 : 1, lastReviewedAt: status === "new" ? null : "2020-01-01", nextReview: status === "review" ? "2020-01-02" : "2099-01-01", status: status === "mastered" };
}
async function setup(browser, width, locale, theme) {
	const p = await browser.newPage({ viewport: { width, height: 740 }, hasTouch: width < 768, colorScheme: theme });
	p.setDefaultTimeout(15000);
	const messages = require(`../../../messages/${locale}.json`), prefix = locale === "en" ? "/en" : "";
	const data = { words: [word(1), word(2, "learning")], account: { _id: "000000000000000000000100", name: "Learner", email: "learner@example.com", theme } };
	const errors = [];
	p.on("pageerror", error => errors.push(error.message));
	p.on("console", message => {
		if (message.type() !== "error" || message.text().startsWith("Failed to load resource")) return;
		errors.push(message.text());
	});
	await p.addInitScript(theme => localStorage.setItem("studyjony-theme", theme), theme);
	await p.route("https://va.vercel-scripts.com/**", route => route.fulfill({ contentType: "application/javascript", body: "" }));
	await p.route("https://accounts.google.com/**", route => route.fulfill({ contentType: "application/javascript", body: "window.google={accounts:{oauth2:{initCodeClient:()=>({requestCode(){}})}}};" }));
	await p.route("**/api/v1/**", route => {
		const url = new URL(route.request().url());
		if (url.pathname.endsWith("/users/me")) return route.fulfill({ json: { status: "success", data: { user: data.account } } });
		if (url.pathname.endsWith("/vocab")) return route.fulfill({ json: { data: { vocabularies: data.words } } });
		return route.fulfill({ json: { data: { activities: [], progress: [], topics: [] } } });
	});
	async function goto(url) {
		await p.goto(baseURL + prefix + url, { waitUntil: "domcontentloaded", timeout: 60000 });
		await p.waitForFunction(theme => document.documentElement.dataset.theme === theme, theme);
	}
	async function check() {
		assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "No horizontal overflow");
		assert.deepEqual(errors, [], "No runtime/hydration errors");
	}
	return { p, data, messages, prefix, goto, check, finish: async () => { await check(); await p.close(); } };
}
async function dueCase(browser, width, locale, theme) {
	const c = await setup(browser, width, locale, theme), { p } = c, t = c.messages.Notebook;
	async function select(status) {
		const mobile = p.locator("main button[aria-pressed]").filter({ has: p.getByText(t[status], { exact: true }) });
		if (await mobile.isVisible()) await mobile.click();
		else { await p.locator('main button[aria-haspopup="listbox"]').click(); await p.getByRole("option", { name: t[status], exact: true }).click(); }
		await p.waitForURL(url => url.searchParams.get("status") === status);
	}
	async function expectDue(count) {
		await p.locator(`main button[aria-label="${t.status}: ${t.review}"]`).waitFor({ state: "attached" });
		if (!count) await p.getByText(t.noDueWords, { exact: true }).waitFor();
		else await p.getByText("word1", { exact: true }).waitFor();
		assert.equal(await p.locator("main tbody tr").count(), count);
		await c.check();
	}
	await c.goto("/wordlist?unrelated=keep");
	await p.getByText("word1", { exact: true }).waitFor();
	await select("review"); await expectDue(0);
	assert.equal(new URL(p.url()).searchParams.get("unrelated"), "keep");
	await p.reload({ waitUntil: "domcontentloaded" }); await expectDue(0);
	await select("all"); await p.getByText("word2", { exact: true }).waitFor(); assert.equal(await p.locator("main tbody tr").count(), 2);
	await select("learning"); await p.getByText("word2", { exact: true }).waitFor(); assert.equal(await p.locator("main tbody tr").count(), 1);
	await select("mastered"); await p.getByText(t.noResults, { exact: true }).waitFor();
	await select("new"); await p.getByText("word1", { exact: true }).waitFor();
	for (const count of [1, 4, 12]) {
		c.data.words = Array.from({ length: count }, (_, i) => word(i + 1, "review"));
		if (count !== 12) c.data.words.push(word(90), word(91, "learning"));
		await c.goto("/wordlist?status=review"); await expectDue(count);
		await p.reload({ waitUntil: "domcontentloaded" }); await expectDue(count);
	}
	c.data.words = []; await c.goto("/wordlist?status=review"); await expectDue(0);
	await select("all"); await p.getByRole("heading", { name: t.emptyTitle, exact: false }).waitFor();
	await c.finish();
}
async function topicCase(browser, width, locale, theme) {
	const c = await setup(browser, width, locale, theme), { p } = c, t = c.messages.WordlistDetail;
	await c.goto(`/wordlist/${topicId}?status=review`);
	await p.getByRole("heading", { name: t.noResultsTitle, exact: true }).waitFor();
	await p.reload({ waitUntil: "domcontentloaded" }); await p.getByText(t.noResultsBody, { exact: true }).waitFor();
	assert.equal(new URL(p.url()).searchParams.get("status"), "review");
	const filter = p.locator("select");
	await filter.selectOption("all");
	await p.getByRole("button", { name: t.audioLabel.replace("{word}", "word1"), exact: true }).waitFor();
	await p.getByText("nghĩa tiếng Việt", { exact: true }).first().waitFor();
	assert.equal(await p.getByRole("button", { name: t.deleteLabel.replace("{word}", "word1"), exact: true }).count(), 1);
	assert.equal(await p.getByRole("button", { name: t.editLabel.replace("{word}", "word1"), exact: true }).count(), 1);
	await c.check();
	for (const count of [1, 4, 12]) {
		c.data.words = Array.from({ length: count }, (_, i) => word(i + 1, "review"));
		await c.goto(`/wordlist/${topicId}?status=review`);
		await p.getByRole("button", { name: t.deleteLabel.replace("{word}", "word1"), exact: true }).waitFor();
		await p.getByText(t.pagination.replace("{count}", count).replace("{current}", 1).replace("{total}", Math.ceil(count / 5)), { exact: true }).waitFor();
		await c.check();
		if (count === 12) { await p.getByRole("button", { name: t.next, exact: true }).click(); await p.getByRole("button", { name: t.previous, exact: true }).click(); }
	}
	c.data.words = []; await c.goto(`/wordlist/${topicId}`);
	await p.getByRole("heading", { name: t.emptyTitle, exact: true }).waitFor();
	await p.getByText(t.emptyBody, { exact: true }).waitFor();
	await c.finish();
}
async function boundaryCase(browser, width, locale, theme) {
	const c = await setup(browser, width, locale, theme), { p } = c, t = c.messages.ErrorPages;
	for (const [mode, title, body, action] of [
		["root-error", t.rootErrorTitle, t.rootErrorBody, t.rootRetry], ["locale-error", t.errorTitle, t.errorBody, t.retry],
		["root-not-found", t.rootNotFoundTitle, t.rootNotFoundBody, t.rootHome], ["locale-not-found", t.notFoundTitle, t.notFoundBody, t.home],
	]) {
		await c.goto(`/regression-boundary-fixture?mode=${mode}`);
		await p.getByRole("heading", { name: title, exact: true }).waitFor();
		await p.getByText(body, { exact: true }).waitFor(); await c.check();
		if (mode.endsWith("error")) { await p.getByRole("button", { name: action, exact: true }).click(); await p.getByRole("status").filter({ hasText: "Retry requested" }).waitFor(); }
		else assert.equal(await p.getByRole("link", { name: action, exact: true }).getAttribute("href"), c.prefix || "/");
	}
	await c.goto("/missing-regression-route");
	await p.getByRole("heading", { name: t.notFoundTitle, exact: false }).waitFor();
	const home = p.getByRole("link", { name: /home|trang chủ/ });
	assert.equal(await home.getAttribute("href"), c.prefix || "/");
	await c.finish();
}
async function oauthCase(browser, width, locale, theme) {
	const c = await setup(browser, width, locale, theme), { p } = c;
	let release;
	const gate = new Promise(resolve => { release = resolve; });
	await p.route("**/api/v1/users/me", async route => { await gate; await route.fulfill({ json: { status: "success", data: { user: c.data.account } } }); });
	try {
		await p.goto(baseURL + c.prefix + "/oauth/google/callback", { waitUntil: "domcontentloaded", timeout: 60000 });
		// The existing ThemeProvider hides children while restoring the session.
		await p.getByText(c.messages.Auth.finishingGoogleLogin, { exact: true }).waitFor({ state: "attached" });
		await c.check(); release();
		await p.waitForURL(url => url.pathname === c.prefix + "/wordlist");
		await p.getByText("word1", { exact: true }).waitFor();
		await p.waitForFunction(theme => document.documentElement.dataset.theme === theme, theme);
		await c.goto("/regression-boundary-fixture?mode=oauth");
		await p.getByRole("link", { name: "Start callback", exact: true }).click();
		await p.waitForURL(url => url.pathname === c.prefix + "/wordlist");
		await p.getByText("word1", { exact: true }).waitFor();
	} finally { release(); await c.finish(); }
}
(async () => {
	assert.equal(fs.existsSync(fixtureDir), false, "Never overwrite an app route");
	fs.mkdirSync(fixtureDir); fs.writeFileSync(fixtureFile, fixture);
	let browser, cases = 0;
	try {
		browser = await chromium.launch({ channel: "chrome", headless: true });
		for (const width of process.env.STUDYJONY_TEST_WIDTHS?.split(",").map(Number) || [320, 375, 430, 768, 1280]) for (const locale of ["vi", "en"]) for (const theme of ["light", "dark"]) {
			for (const run of [dueCase, topicCase, boundaryCase, oauthCase]) { await run(browser, width, locale, theme); cases++; }
			console.log(`PASS ${width}px ${locale} ${theme}: explicit Due/refresh/switching, topic filters/localization, fallback screens, OAuth loading`);
		}
		console.log(`PASS ${cases} browser cases (inactive Sound removed; direct callback restoration succeeds)`);
	} finally { await browser?.close(); fs.unlinkSync(fixtureFile); fs.rmdirSync(fixtureDir); }
})().catch(error => { console.error(error); process.exitCode = 1; });
