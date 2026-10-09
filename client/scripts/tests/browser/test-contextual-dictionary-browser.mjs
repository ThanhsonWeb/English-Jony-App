// Node 22 + local Chrome. Start the built client before running this check.
// No Playwright dependency; uses Chrome's local DevTools connection.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { findLessonLookup } from "../../../app/_lib/dictionary/findLessonLookup.js";
import { SUBTITLE_WORD_PATTERN } from "../../../app/_lib/dictionary/findPreferredLookup.js";

const baseURL = process.env.STUDYJONY_TEST_URL || "http://127.0.0.1:3100";
const courseId = process.env.STUDYJONY_TEST_COURSE || "restaurant";
const dialogueId = process.env.STUDYJONY_TEST_LESSON || "getting-a-table";
const contentType = process.env.STUDYJONY_TEST_CONTENT_TYPE || "dialogue";
if (!["dialogue", "story"].includes(contentType) || [courseId, dialogueId].some(slug => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))) throw new Error("Invalid browser lesson selection");
const draft = JSON.parse(fs.readFileSync(new URL(`../../../app/[locale]/(main)/dialogue/_data/${contentType === "story" ? "stories" : "dialogues"}/${courseId}/${dialogueId}.json`, import.meta.url), "utf8"));
const wordCount = draft.dialogue.reduce((total, line) => total + [...line.text.matchAll(SUBTITLE_WORD_PATTERN)].length, 0);
const chromePath = process.env.STUDYJONY_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "studyjony-glossary-browser-"));
const chrome = spawn(chromePath, ["--headless=new", "--no-first-run", "--no-default-browser-check", "--mute-audio",
	"--remote-debugging-address=127.0.0.1", "--remote-debugging-port=0", `--user-data-dir=${profile}`], { stdio: "ignore", windowsHide: true });
let launchError, socket;
chrome.on("error", error => { launchError = error; });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function until(check, description) {
	const deadline = Date.now() + 15000;
	while (Date.now() < deadline) {
		if (launchError) throw launchError;
		const value = await check();
		if (value) return value;
		await delay(50);
	}
	throw new Error(`Timed out: ${description}`);
}

try {
	await until(() => fs.existsSync(path.join(profile, "DevToolsActivePort")), "Chrome startup");
	const [port, endpoint] = fs.readFileSync(path.join(profile, "DevToolsActivePort"), "utf8").trim().split(/\r?\n/u);
	socket = new WebSocket(`ws://127.0.0.1:${port}${endpoint}`);
	await new Promise((resolve, reject) => { socket.addEventListener("open", resolve, { once: true }); socket.addEventListener("error", reject, { once: true }); });
	let nextId = 0;
	const pending = new Map(), runtimeErrors = [];
	socket.addEventListener("message", event => {
		const message = JSON.parse(event.data);
		if (message.method === "Runtime.exceptionThrown") runtimeErrors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
		if (!message.id) return;
		const task = pending.get(message.id);
		if (!task) return;
		pending.delete(message.id); clearTimeout(task.timer);
		if (message.error) task.reject(new Error(message.error.message)); else task.resolve(message.result);
	});
	function send(method, params = {}, sessionId) {
		const id = ++nextId;
		return new Promise((resolve, reject) => {
			const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 15000);
			pending.set(id, { resolve, reject, timer });
			socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
		});
	}
	let clicks = 0, popupChecks = 0;
	for (const width of [1365, 390]) {
		const { targetId } = await send("Target.createTarget", { url: "about:blank" });
		const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
		const command = (method, params) => send(method, params, sessionId);
		async function evaluate(expression) {
			const result = await command("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
			if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
			return result.result.value;
		}
		await command("Page.enable"); await command("Runtime.enable");
		await command("Emulation.setDeviceMetricsOverride", { width, height: 844, deviceScaleFactor: 1, mobile: width < 640 });
		await command("Emulation.setTouchEmulationEnabled", { enabled: width < 640 });
		// Test guest APIs and media requests without a backend, account, or audible
		// playback. Verify the existing audio URL and speech callback below.
		await command("Page.addScriptToEvaluateOnNewDocument", { source: `
			const originalFetch = window.fetch.bind(window);
			window.__dictionaryAPICalls = 0;
			window.fetch = (input, init) => {
				const url = new URL(typeof input === 'string' ? input : input.url, location.origin);
				if (url.pathname.startsWith('/api/v1/')) {window.__dictionaryAPICalls++;return Promise.resolve(new Response(JSON.stringify({status:'success',data:{user:null,progress:[],activities:[],vocabularies:[]}}),{headers:{'Content-Type':'application/json'}}));}
				return originalFetch(input,init);
			};
			window.__dictionarySpoken = [];
			window.speechSynthesis.speak = utterance => window.__dictionarySpoken.push({text:utterance.text,lang:utterance.lang,rate:utterance.rate});
			HTMLMediaElement.prototype.play = function(){this.dispatchEvent(new Event('play'));return Promise.resolve();};
		` });
		await command("Page.navigate", { url: `${baseURL}/dialogue/${courseId}/${dialogueId}` });
		await until(() => evaluate(`window.__dictionaryAPICalls > 0`), "Client hydration and guest session effect");
		await until(() => evaluate(`[...document.querySelectorAll('button')].some(button => button.textContent.trim() === 'Transcript')`), "Transcript button");
		await evaluate(`[...document.querySelectorAll('button')].find(button => button.textContent.trim() === 'Transcript').click()`);
		await until(() => evaluate(`[...document.querySelectorAll('button')].some(button => button.querySelector('p.mt-1')?.textContent === ${JSON.stringify(draft.dialogue[0].text)})`), "Expanded transcript");
		for (const line of draft.dialogue) {
			await evaluate(`[...document.querySelectorAll('button')].find(button => button.querySelector('p.mt-1')?.textContent === ${JSON.stringify(line.text)}).click()`);
			await until(() => evaluate(`document.querySelector('.dialogue-subtitle-text')?.textContent === ${JSON.stringify(line.text)}`), `Line ${line.id}`);
			await until(() => evaluate(`document.querySelector('audio')?.src.endsWith(${JSON.stringify(line.audioUrl)})`), "Audio source");
			const words = [...line.text.matchAll(SUBTITLE_WORD_PATTERN)];
			for (const [clickedWordIndex] of words.entries()) {
				const expected = findLessonLookup({ lessonId: courseId, dialogueId, line, clickedWordIndex });
				// Keep the viewport still: scrolling intentionally dismisses the
				// production popup. Phone emulation checks the existing bottom sheet.
				await evaluate(`document.querySelectorAll('[data-dictionary-token="true"]')[${clickedWordIndex}].click()`);
				const selections = expected.wordLookup ? [expected, expected.wordLookup, expected] : [expected];
				for (const [selectionIndex, selection] of selections.entries()) {
					if (selectionIndex > 0) await evaluate(`document.querySelector('[data-dictionary-switch="true"]').click()`);
					await until(() => evaluate(`document.querySelector('.dialogue-word-popup strong')?.textContent === ${JSON.stringify(selection.result.text)} && document.querySelector('.dialogue-word-popup p.mt-2')?.textContent === ${JSON.stringify(selection.result.displayMeaning)}`), `Popup line ${line.id}, word ${clickedWordIndex}, mode ${selectionIndex}, width ${width}`);
					const popup = await evaluate(`(() => {const p=document.querySelector('.dialogue-word-popup'),r=p.getBoundingClientRect();return{text:p.querySelector('strong').textContent,ipa:p.querySelector('p.mt-1')?.textContent||'',highlight:document.querySelector('.dialogue-subtitle-text .box-decoration-clone')?.textContent||null,left:r.left,right:r.right,bottom:r.bottom,viewportWidth:innerWidth,viewportHeight:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth};})()`);
					assert.equal(popup.text, selection.result.text);
					assert.equal(popup.ipa, selection.result.pron.join(", "));
					assert.equal(popup.highlight, selection.startWordIndex < selection.endWordIndex ? selection.result.text : null);
					const selectedTokens = await evaluate(`[...document.querySelectorAll('[data-dictionary-token="true"]')].map((button,index)=>button.className.includes('bg-cyan-400/15')?index:null).filter(index=>index!==null)`);
					if (selection.result.source === "word") assert.deepEqual(selectedTokens, [clickedWordIndex]);
					assert.equal(await evaluate(`document.querySelector('.dialogue-word-popup')?.textContent.includes('không dịch riêng')`), false, "Notes stay hidden");
					assert(popup.left >= 0 && popup.right <= popup.viewportWidth + 1 && !popup.overflow);
					if (width < 640) assert(Math.abs(popup.bottom - (popup.viewportHeight - 12)) <= 1, "Phone bottom sheet stays visible");
					await evaluate(`document.querySelector('.dialogue-word-popup button').click()`);
					const spoken = await evaluate(`window.__dictionarySpoken.at(-1)`);
					assert.equal(spoken.text, selection.result.text);
					assert.equal(spoken.lang, "en-US");
					assert(Math.abs(spoken.rate - 0.9) < 0.000001, "Existing speech rate is preserved");
					popupChecks++;
					}
					await command("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
					await until(() => evaluate(`!document.querySelector('.dialogue-word-popup')`), "Escape dismisses popup");
					clicks++;
				}
			}
			await send("Target.closeTarget", { targetId });
		console.log(`PASS: ${width}px, all ${wordCount} clicks for ${courseId}/${dialogueId}, meanings, IPA, phrase highlights, audio URLs, speech requests, dismissal and popup bounds.`);
		}
		assert.deepEqual(runtimeErrors, [], "No browser runtime errors");
		console.log(`PASS: ${clicks} rendered word clicks and ${popupChecks} popup selections including word/phrase switches on desktop/phone layouts. APIs and media mocked; no codec, audible speech, or physical touch validation.`);
		await send("Browser.close");
	} finally {
		socket?.close();
		if (chrome.exitCode === null) {
			await Promise.race([new Promise(resolve => chrome.once("exit", resolve)), delay(2000)]);
			if (chrome.exitCode === null) chrome.kill();
		}
		// This directory was created above. Verify the absolute boundary before
		// recursively removing this isolated browser profile, never a user profile.
		assert(path.resolve(profile).startsWith(path.resolve(os.tmpdir()) + path.sep));
		fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
	}
