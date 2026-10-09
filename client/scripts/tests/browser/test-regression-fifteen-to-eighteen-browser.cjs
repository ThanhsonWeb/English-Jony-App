// Requires Next dev and Playwright. APIs are mocked; no live account data is changed.
// Topic is currently unrouted, so a temporary fixture mounts the real component.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const baseURL = process.env.STUDYJONY_TEST_URL || "http://localhost:3000";
const topicId = "000000000000000000000099";
const fixtureDir = path.resolve(__dirname, "../../../app/[locale]/(main)/regression-topic-fixture");
const fixtureFile = path.join(fixtureDir, "page.jsx");
const fixture = `"use client";
import { useState } from "react";
import Topic from "@/app/_components/Topic";
export default function Fixture() {
 const [topic, setTopic] = useState({ _id: "${topicId}", name: "Original topic", description: "Original notes" });
 async function save(id, name, description) {
  const response = await fetch("/api/v1/topics/" + id, { method: "PATCH", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, description }) });
  const data = await response.json();
  if (!response.ok || data.status !== "success" || !data.data?.updatedTopic) throw new Error("Save failed");
  setTopic(data.data.updatedTopic);
  return data.data.updatedTopic;
 }
 return <main className="p-4"><Topic topic={topic} words={[]} onDelete={() => {}} onFix={save} /></main>;
}`;
const frame = p => p.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
function deferred() { let resolve; const promise = new Promise(done => resolve = done); return { promise, resolve }; }
function words(count, topic = topicId) {
	return Array.from({ length: count }, (_, index) => ({ _id: String(index + 1).padStart(24, "0"), english: `matchword${index + 1}`, vietnamese: `meaning ${index + 1}`, topic, reviewCount: 0, lastReviewedAt: null, learningLevel: 0, nextReview: "2099-01-01", example: "" }));
}
async function setup(browser, width, locale, theme, initial = [], google = false) {
	const p = await browser.newPage({ viewport: { width, height: 740 }, hasTouch: width < 768, colorScheme: theme });
	p.setDefaultTimeout(15000);
	const messages = require(`../../../messages/${locale}.json`), prefix = locale === "en" ? "/en" : "";
	let account = { _id: "000000000000000000000100", name: "Original learner", email: "learner@example.com", theme, ...(google ? { googleId: "test-provider-id" } : {}) };
	const data = { words: initial, topics: [], posts: 0, deletes: 0, reads: 0 };
	let handler;
	const errors = [];
	p.on("pageerror", error => { errors.push(error.message); console.error("Runtime error:", error.message); });
	p.on("console", message => {
		if (message.type() !== "error") return;
		if (message.text().startsWith("Failed to load resource") && message.location().url.includes("/api/v1/")) return;
		errors.push(message.text());
	});
	await p.addInitScript(theme => localStorage.setItem("studyjony-theme", theme), theme);
	await p.route("https://va.vercel-scripts.com/**", route => route.fulfill({ contentType: "application/javascript", body: "" }));
	await p.route("https://accounts.google.com/**", route => route.fulfill({ contentType: "application/javascript", body: "window.google={accounts:{oauth2:{initCodeClient:()=>({requestCode(){}})}}};" }));
	await p.route("**/data/english_words.json", route => route.fulfill({ json: ["apple", "book"] }));
	await p.route("**/api/v1/**", async route => {
		const request = route.request(), url = new URL(request.url()), method = request.method();
		if (handler && await handler(route, url.pathname)) return;
		if (url.pathname.endsWith("/users/me")) return route.fulfill({ json: { status: "success", data: { user: account } } });
		if (url.pathname.includes("/dictionary/")) return route.fulfill({ json: { data: { english: "apple", vietnamese: "apple meaning", pronunciation: "/apple/", example: "An apple." } } });
		if (url.pathname.endsWith("/topics")) return route.fulfill({ json: { data: { topics: data.topics } } });
		if (url.pathname.endsWith("/vocab") && method === "GET") {
			data.reads++;
			const topic = url.searchParams.get("topic");
			return route.fulfill({ json: { data: { vocabularies: data.words.filter(word => !topic || word.topic === topic) } } });
		}
		if (url.pathname.includes("/vocab/") && method === "DELETE") {
			data.deletes++; data.words = data.words.filter(word => word._id !== url.pathname.split("/").at(-1));
			return route.fulfill({ status: 204 });
		}
		return route.fulfill({ json: { data: { activities: [], progress: [] } } });
	});
	async function goto(url) {
		await p.goto(baseURL + prefix + url, { timeout: 60000, waitUntil: "domcontentloaded" });
		await p.locator("header.sticky button.group").waitFor();
		await p.waitForFunction(theme => document.documentElement.dataset.theme === theme, theme);
	}
	async function check() {
		assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, "No horizontal overflow");
		assert.deepEqual(errors, [], "No unexpected runtime/hydration errors");
	}
	async function finish() { await check(); await p.close(); }
	return { p, messages, data, prefix, goto, check, finish, handle: value => handler = value, account: () => account, setAccount: value => account = value };
}
async function profileCase(browser, width, locale, theme, google) {
	const c = await setup(browser, width, locale, theme, [], google), { p } = c, t = c.messages.Profile;
	let posts = 0, gate;
	c.handle(async (route, url) => {
		if (!url.endsWith("/users/updateMe")) return false;
		const index = posts++, payload = route.request().postDataJSON();
		if (gate) { gate.started.resolve(); await gate.release.promise; }
		if (index === 0) await route.fulfill({ status: 400, json: { status: "fail", code: "nameTooLong", message: "PRIVATE_SERVER_DETAIL" } });
		else if (index === 1) await route.abort("failed");
		else if (index === 2) await route.fulfill({ status: 500, json: { status: "error", message: "PRIVATE_SERVER_DETAIL" } });
		else {
			c.setAccount({ ...c.account(), name: payload.name });
			await route.fulfill({ json: { status: "success", data: { user: c.account() } } });
		}
		return true;
	});
	await c.goto("/profile");
	await p.getByRole("button", { name: t.updateName, exact: true }).click();
	const dialog = p.getByRole("dialog"), input = dialog.getByRole("textbox", { name: t.editName, exact: true });
	for (const [name, message] of [["", t.nameRequired], ["  ", t.nameRequired], ["ab", t.nameTooShort], ["a".repeat(21), t.nameTooLong]]) {
		await input.fill(name); await dialog.getByRole("button", { name: t.save, exact: true }).click();
		await dialog.getByRole("alert").filter({ hasText: message }).waitFor();
		assert.equal(await input.inputValue(), name); assert.equal(posts, 0); await c.check();
	}
	await input.fill("  Nguyễn Ánh  ");
	for (const [index, message] of [t.nameTooLong, t.nameSaveError, t.nameSaveError, null].entries()) {
		gate = { started: deferred(), release: deferred() };
		await dialog.getByRole("button", { name: t.save, exact: true }).evaluate(button => { button.click(); button.click(); button.click(); });
		await gate.started.promise;
		assert.equal(posts, index + 1);
		await dialog.getByRole("button", { name: t.savingName, exact: true }).waitFor();
		assert.equal(await input.isDisabled(), true); await c.check();
		gate.release.resolve();
		if (message) {
			await dialog.getByRole("button", { name: t.save, exact: true }).waitFor();
			await dialog.getByRole("alert").filter({ hasText: message }).waitFor();
			assert.equal(await input.inputValue(), "  Nguyễn Ánh  ");
			assert.equal(await p.getByRole("heading", { name: "Original learner", exact: true }).count(), 1);
			assert.equal(await p.getByText("PRIVATE_SERVER_DETAIL", { exact: false }).count(), 0);
		} else await dialog.waitFor({ state: "hidden" });
	}
	await p.getByRole("heading", { name: "Nguyễn Ánh", exact: true }).waitFor();
	for (const name of ["abc", "a".repeat(20)]) {
		gate = null; await p.getByRole("button", { name: t.updateName, exact: true }).click();
		await input.fill(name); await dialog.getByRole("button", { name: t.save, exact: true }).click();
		await dialog.waitFor({ state: "hidden" }); await p.getByRole("heading", { name, exact: true }).waitFor();
	}
	assert.equal(posts, 6); await c.finish();
}
async function topicEditCase(browser, width, locale, theme) {
	const c = await setup(browser, width, locale, theme), { p } = c, t = c.messages.Wordlist;
	let posts = 0, gate;
	c.handle(async (route, url) => {
		if (!url.endsWith(`/topics/${topicId}`)) return false;
		const index = posts++, payload = route.request().postDataJSON();
		gate.started.resolve(); await gate.release.promise;
		if (index === 0) await route.fulfill({ status: 400, json: { status: "fail", message: "PRIVATE_SERVER_DETAIL" } });
		else if (index === 1) await route.abort("failed");
		else if (index === 2) await route.fulfill({ status: 500, json: { status: "error", message: "PRIVATE_SERVER_DETAIL" } });
		else await route.fulfill({ json: { status: "success", data: { updatedTopic: { _id: topicId, ...payload } } } });
		return true;
	});
	await c.goto("/regression-topic-fixture");
	await p.locator("main button").first().click();
	await p.getByRole("button", { name: t.edit, exact: true }).click();
	const form = p.locator("main form");
	await form.locator("input").fill("Edited topic"); await form.locator("textarea").fill("Edited notes");
	for (let index = 0; index < 4; index++) {
		gate = { started: deferred(), release: deferred() };
		await form.evaluate(form => { form.requestSubmit(); form.requestSubmit(); form.requestSubmit(); });
		await gate.started.promise; assert.equal(posts, index + 1);
		assert.equal(await form.getByRole("button", { name: t.form.saving, exact: true }).isDisabled(), true);
		assert.equal(await form.locator("input").isDisabled(), true); await c.check();
		gate.release.resolve();
		if (index < 3) {
			await form.getByRole("button", { name: t.form.save, exact: true }).waitFor();
			await form.getByRole("alert").filter({ hasText: t.form.saveError }).waitFor();
			assert.equal(await form.locator("input").inputValue(), "Edited topic");
			assert.equal(await form.locator("textarea").inputValue(), "Edited notes");
			assert.equal(await p.getByRole("heading", { name: "Original topic", exact: true }).count(), 1);
			assert.equal(await p.getByText("PRIVATE_SERVER_DETAIL", { exact: false }).count(), 0);
		} else await form.waitFor({ state: "hidden" });
	}
	await p.getByRole("heading", { name: "Edited topic", exact: true }).waitFor(); await c.finish();
}
async function paginationCase(browser, width, locale, theme, global) {
	const c = await setup(browser, width, locale, theme), { p } = c, t = c.messages.Notebook, size = global ? 20 : 5;
	async function load(count, filter = false) {
		c.data.words = words(count);
		// Extra words excluded by both search and status filters.
		if (filter) c.data.words.push({ ...words(1)[0], _id: "000000000000000000000098", english: "excluded", reviewCount: 2, lastReviewedAt: "2026-01-01", status: true });
		await c.goto(global ? "/wordlist" : `/wordlist/${topicId}${filter ? "?search=match&status=new" : ""}`);
		await p.getByText("matchword1", { exact: true }).first().waitFor();
		if (global && filter) await p.getByRole("textbox", { name: t.search, exact: true }).fill("match");
	}
	const next = () => p.getByRole("button", { name: global ? t.next : c.messages.WordlistDetail.next, exact: true });
	const previous = () => p.getByRole("button", { name: global ? t.previous : c.messages.WordlistDetail.previous, exact: true });
	async function remove(english) {
		const label = global ? `${t.remove} ${english}` : c.messages.WordlistDetail.deleteLabel.replace("{word}", english);
		await p.getByRole("button", { name: label, exact: true }).click();
		if (global) {
			await p.getByRole("dialog").getByRole("button", { name: t.remove, exact: true }).click();
			await p.getByRole("dialog").waitFor({ state: "hidden" });
		} else await p.getByRole("button", { name: label, exact: true }).waitFor({ state: "hidden" });
	}
	for (const filter of [false, true]) {
		await load(size * 2 + 1, filter); await next().click(); await next().click();
		await p.getByText(`matchword${size * 2 + 1}`, { exact: true }).first().waitFor();
		await remove(`matchword${size * 2 + 1}`);
		await p.getByText(`matchword${size + 1}`, { exact: true }).first().waitFor();
		assert.equal(await next().isDisabled(), true); assert.equal(await previous().isEnabled(), true);
		c.data.words.push({ ...words(1)[0], _id: "000000000000000000000091", english: "matchadded" });
		const refreshed = p.waitForResponse(response => response.url().includes("/api/v1/vocab") && response.request().method() === "GET");
		await p.evaluate(({ userId, topic }) => window.dispatchEvent(new CustomEvent("vocabulary-saved", { detail: { userId, word: { _id: "000000000000000000000091", topic } } })), { userId: c.account()._id, topic: topicId });
		await (await refreshed).finished(); await frame(p);
		await p.getByText(`matchword${size + 1}`, { exact: true }).first().waitFor();
		assert.equal(await p.getByText("matchadded", { exact: true }).count(), 0, "Growing the list after deletion does not restore the invalid old page");
		await c.check();
		await load(size + 2, filter); await next().click(); await remove(`matchword${size + 1}`);
		await p.getByText(`matchword${size + 2}`, { exact: true }).first().waitFor();
		assert.equal(await previous().isEnabled(), true, "Page remains when another word is still present");
		await remove(`matchword${size + 2}`); await p.getByText("matchword1", { exact: true }).first().waitFor();
		if (global) { assert.equal(await previous().count(), 0); assert.equal(await next().count(), 0); }
		else { assert.equal(await previous().isDisabled(), true); assert.equal(await next().isDisabled(), true); }
	}
	await load(1); await remove("matchword1");
	assert.equal(c.data.words.length, 0); assert.equal(await p.getByText("matchword1", { exact: true }).count(), 0);
	if (global) await p.getByRole("heading", { name: t.emptyTitle, exact: false }).waitFor();
	else { assert.equal(await previous().isDisabled(), true); assert.equal(await next().isDisabled(), true); }
	await c.finish();
}
async function dictionaryCase(browser, width, locale, theme, scope) {
	const c = await setup(browser, width, locale, theme), { p } = c, t = c.messages.MiniDictionary;
	if (scope !== "global") c.data.topics = [{ _id: topicId, name: "My words" }];
	let posts = 0, gate;
	c.handle(async (route, url) => {
		if (!url.endsWith("/vocab") || route.request().method() !== "POST") return false;
		const index = posts++, payload = route.request().postDataJSON();
		assert.equal(payload.topic, scope === "global" ? undefined : topicId);
		if (index === 0) await route.fulfill({ status: 500, json: { status: "error" } });
		else {
			gate.started.resolve(); await gate.release.promise;
			const newVocab = { ...words(1)[0], ...payload, _id: "000000000000000000000090" };
			c.data.words.push(newVocab); await route.fulfill({ json: { status: "success", data: { newVocab } } });
		}
		return true;
	});
	const target = scope === "topic" ? `/wordlist/${topicId}` : scope === "other-topic" ? "/wordlist/000000000000000000000098" : "/wordlist";
	await c.goto(target); const initialReads = c.data.reads;
	await p.getByRole("button", { name: t.toggle, exact: true }).click();
	const panel = p.getByRole("region", { name: t.title, exact: true });
	await panel.getByRole("combobox").fill("apple"); await panel.locator("form").evaluate(form => form.requestSubmit());
	await panel.getByText("apple meaning", { exact: true }).waitFor();
	const save = panel.getByRole("button", { name: t.save, exact: true });
	await p.waitForFunction(label => [...document.querySelectorAll("button")].some(button => button.textContent.trim() === label && !button.disabled), t.save);
	await save.click(); await panel.getByText(t.saveError, { exact: true }).waitFor();
	assert.equal(c.data.words.length, 0); const readsAfterFailure = c.data.reads;
	const entryLabel = scope === "topic" || scope === "other-topic" ? c.messages.WordlistDetail.deleteLabel.replace("{word}", "apple") : `${c.messages.Notebook.remove} apple`;
	const entry = p.getByRole("button", { name: entryLabel, exact: true });
	assert.equal(await entry.count(), 0, "A failed save never inserts a word into the mounted view");
	gate = { started: deferred(), release: deferred() };
	await save.evaluate(button => { button.click(); button.click(); button.click(); }); await gate.started.promise;
	assert.equal(posts, 2); gate.release.resolve();
	await panel.getByRole("button", { name: t.saved, exact: true }).waitFor();
	await panel.getByRole("button", { name: t.saved, exact: true }).evaluate(button => { button.click(); button.click(); });
	await panel.getByRole("button", { name: t.close, exact: true }).click();
	await panel.waitFor({ state: "hidden" });
	if (scope === "other-topic") {
		await frame(p); assert.equal(await entry.count(), 0);
		assert.equal(c.data.reads, readsAfterFailure, "Unrelated topic does not reload");
	} else {
		await entry.waitFor();
		assert.equal(await entry.count(), 1, "Mounted view updates without navigation and without duplicate entries");
		assert.ok(c.data.reads > readsAfterFailure); assert.ok(c.data.reads > initialReads);
	}
	assert.equal(c.data.words.length, 1); assert.equal(posts, 2);
	assert.equal(new URL(p.url()).pathname, c.prefix + target);
	await c.finish();
}
(async () => {
	assert.equal(fs.existsSync(fixtureDir), false, "Never overwrite an existing app route");
	fs.mkdirSync(fixtureDir); fs.writeFileSync(fixtureFile, fixture);
	let browser, cases = 0;
	try {
		browser = await chromium.launch({ channel: "chrome", headless: true });
		for (const width of process.env.STUDYJONY_TEST_WIDTHS?.split(",").map(Number) || [320, 375, 430, 768, 1280]) for (const locale of ["vi", "en"]) for (const theme of ["light", "dark"]) {
			for (const google of [false, true]) { await profileCase(browser, width, locale, theme, google); cases++; }
			await topicEditCase(browser, width, locale, theme); cases++;
			for (const global of [false, true]) { await paginationCase(browser, width, locale, theme, global); cases++; }
			if (width >= 768) for (const scope of ["global", "global-topic", "topic", "other-topic"]) { await dictionaryCase(browser, width, locale, theme, scope); cases++; }
			console.log(`PASS ${width}px ${locale} ${theme}: profile/password+Google, topic save lifecycle, filtered/global pagination${width >= 768 ? ", mounted dictionary synchronization" : ""}`);
		}
		console.log(`PASS ${cases} browser cases`);
	} finally {
		await browser?.close(); fs.unlinkSync(fixtureFile); fs.rmdirSync(fixtureDir);
	}
})().catch(error => { console.error(error); process.exitCode = 1; });
