// Local UI with instrumented media APIs and mocked API requests. No live services.
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const rules = require("../../../../server/data/dialogueTaskRules.json");
const baseURL = process.env.STUDYJONY_TEST_URL || "http://localhost:3000";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname));
const userId = "aaaaaaaaaaaaaaaaaaaaaaaa";
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

async function run(browser, width, locale, ids) {
	const context = await browser.newContext({ locale, viewport: { width, height: 900 }, hasTouch: width < 768 });
	await context.addInitScript(userId => {
		localStorage.setItem("studyjony-theme", "dark");
		localStorage.setItem(`studyjony-dialogue-playback-rate:${userId}`, "1.25");
		window.audioLog = [];
		const paused = new WeakMap();
		const mediaIds = new WeakMap();
		let serial = 0;
		const mediaId = audio => {
			if (!mediaIds.has(audio)) mediaIds.set(audio, ++serial);
			return mediaIds.get(audio);
		};
		Object.defineProperty(HTMLMediaElement.prototype, "paused", { get() { return paused.get(this) !== false; } });
		HTMLMediaElement.prototype.play = function() {
			window.audioLog.push({ type: "play", id: mediaId(this), src: this.getAttribute("src"), rate: this.playbackRate, connected: this.isConnected });
			if (window.blockNextPlay) {
				window.blockNextPlay = false;
				return Promise.reject(new DOMException("Autoplay blocked", "NotAllowedError"));
			}
			paused.set(this, false); this.dispatchEvent(new Event("play"));
			return Promise.resolve();
		};
		HTMLMediaElement.prototype.pause = function() {
			window.audioLog.push({ type: "pause", id: mediaId(this), src: this.getAttribute("src") });
			if (paused.get(this) === false) { paused.set(this, true); this.dispatchEvent(new Event("pause")); }
		};
	}, userId);
	await context.route("**/*", route => new URL(route.request().url()).origin === new URL(baseURL).origin
		? route.continue() : route.fulfill({ contentType: "application/javascript", body: "" }));
	await context.route("**/api/v1/**", route => {
		const path = new URL(route.request().url()).pathname;
		let data = { progress: [], vocabularies: [], topics: [], activities: [] };
		if (path.endsWith("/users/me")) data = { user: { _id: userId, name: "Audio tester", theme: "dark" } };
		else if (path.endsWith("/attempt")) data = { attemptId: "a".repeat(64), expiresAt: new Date(Date.now() + 600000).toISOString(), readyAfterMs: 0 };
		else if (route.request().method() === "PATCH") data = { progress: { user: userId, lessonId: ids[0], dialogueId: ids[1], completedTaskIds: [path.split("/").at(-1)] } };
		return route.fulfill({ json: { status: "success", data } });
	});
	const page = await context.newPage(), errors = [];
	page.on("pageerror", error => errors.push(error.message));
	const t = require(`../../../messages/${locale}.json`).DialogueFeature;
	const prefix = locale === "en" ? "/en" : "";
	const path = task => `${prefix}/dialogue/${ids[0]}/${ids[1]}/${task}`;
	const plays = () => page.evaluate(() => window.audioLog.filter(event => event.type === "play"));
	const rule = task => rules.find(rule => rule.ids.join("/") === [...ids.slice(0, 2), String(task)].join("/"));
	async function answer(task, wrong = false) {
		const inputs = page.locator('input[placeholder="..."]');
		for (const [index, value] of rule(task).answers.entries()) await inputs.nth(index).fill(wrong ? "wrong answer" : value);
		await page.getByRole("button", { name: t.check, exact: true }).click();
	}
	try {
		const first = Number(ids[2]), second = first + 1;
		await page.goto(baseURL + path(first));
		await page.waitForFunction(() => window.audioLog.some(event => event.type === "play"));
		await pause(550);
		assert.equal((await plays()).length, 1, "Initial sentence plays once");
		assert.equal((await plays())[0].rate, 1.25);
		assert.equal(await page.locator('input[placeholder="..."]').first().evaluate(input => input === document.activeElement), true, "Input is focused after session restoration");
		await answer(first, true); await pause(600);
		assert.equal((await plays()).length, 1, "Typing and checking cannot restart audio");
		await page.getByRole("button", { name: t.pause, exact: true }).click();
		await page.getByRole("button", { name: t.play, exact: true }).click();
		await page.waitForFunction(() => window.audioLog.filter(event => event.type === "play").length === 2);
		await page.getByRole("button", { name: t.choosePlaybackSpeed.replace("{rate}", "1.25"), exact: true }).click();
		await page.getByRole("button", { name: "0.75x", exact: true }).click();
		await page.keyboard.press("Control");
		assert.equal((await plays()).length, 3, "Ctrl replay still works");
		assert.equal((await plays()).at(-1).rate, 0.75);
		const previousMedia = (await plays()).at(-1).id;
		await answer(first);
		await page.waitForURL(url => url.pathname === path(second));
		await page.waitForFunction(() => window.audioLog.filter(event => event.type === "play").length >= 4);
		await pause(550);
		assert.equal((await plays()).length, 4, "Next sentence automatically plays only once");
		// Consecutive tasks may deliberately reuse the same MP3.
		assert.notEqual((await plays()).at(-1).id, previousMedia);
		assert.equal((await plays()).at(-1).rate, 0.75, "Speed persists across tasks");
		assert.ok(await page.evaluate(id => window.audioLog.some(event => event.type === "pause" && event.id === id), previousMedia));
		assert.equal(await page.locator('input[placeholder="..."]').first().evaluate(input => input === document.activeElement), true);

		// Block the next autoplay, then recover through the unchanged Play button.
		await page.evaluate(() => { window.blockNextPlay = true; });
		await page.getByRole("link", { name: t.previousExercise, exact: true }).click();
		await page.waitForURL(url => url.pathname === path(first));
		await page.waitForFunction(() => window.audioLog.filter(event => event.type === "play").length >= 5);
		await page.getByRole("button", { name: t.play, exact: true }).click();
		await page.waitForFunction(() => window.audioLog.filter(event => event.type === "play").length >= 6);

		// Switch away again before the new sentence's 450ms entry delay expires.
		await page.getByRole("link", { name: t.nextExercise, exact: true }).click();
		await page.waitForURL(url => url.pathname === path(second));
		await page.getByRole("link", { name: t.previousExercise, exact: true }).click();
		await page.waitForURL(url => url.pathname === path(first));
		await pause(1000);
		const finalPlays = await plays();
		assert.equal(finalPlays.length, 7, "Cancelled intermediate sentence must never play");
		assert.ok(finalPlays.every(event => event.connected), "Detached audio cannot start");
		assert.deepEqual(errors, []);
		console.log(`PASS ${width}px ${locale} ${ids[0]}: next sentence once, focus, controls/speed, check/render stability, blocked autoplay, rapid navigation cleanup`);
	} finally { await context.close(); }
}

(async () => {
	const browser = await chromium.launch({ channel: "chrome", headless: true });
	try {
		for (const width of [375, 1280]) for (const locale of ["vi", "en"]) {
			for (const ids of [["asking-for-directions", "finding-a-cafe", "3"], ["ten-minutes-a-day", "the-old-book", "1"]]) await run(browser, width, locale, ids);
		}
	} finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
