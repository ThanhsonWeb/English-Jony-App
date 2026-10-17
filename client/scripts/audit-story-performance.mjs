import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import net from "node:net";
import assert from "node:assert/strict";

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const url = process.argv[2] || "http://localhost:3000/en/dialogue/grateful/a-busy-morning";
const label = process.argv[3] || "audit";
const verifyPlayback = process.argv[4] !== "--no-play";
const playbackWaitMs = Number(process.env.MEDIA_PLAYBACK_WAIT_MS || 3000);
assert.ok(["localhost", "127.0.0.1"].includes(new URL(url).hostname), "Use a local test server only");
assert.ok(playbackWaitMs >= 1000 && playbackWaitMs <= 15000, "Playback wait must be 1 to 15 seconds");

async function freePort() {
	const server = net.createServer();
	await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
	const port = server.address().port;
	await new Promise((resolve) => server.close(resolve));
	return port;
}

async function browserSocket(port) {
	for (let attempt = 0; attempt < 80; attempt += 1) {
		try {
			const pages = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
			const page = pages.find((item) => item.type === "page");
			if (page) {
				const fresh = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" })).json();
				return fresh.webSocketDebuggerUrl;
			}
		} catch {}
		await new Promise((resolve) => setTimeout(resolve, 100));
	}
	throw new Error("Chrome debugging page did not start.");
}

async function measure(device, port) {
	const socket = new WebSocket(await browserSocket(port));
	await new Promise((resolve, reject) => {
		socket.onopen = resolve;
		socket.onerror = reject;
	});
	let sequence = 0;
	const pending = new Map();
	const requests = new Map();
	const runtimeErrors = [];
	let loadResolve;
	const loaded = new Promise((resolve) => { loadResolve = resolve; });
	let loadStarted = false;
	socket.onmessage = ({ data }) => {
		const message = JSON.parse(data);
		if (message.id) {
			const callback = pending.get(message.id);
			pending.delete(message.id);
			if (message.error) callback.reject(new Error(message.error.message));
			else callback.resolve(message.result);
		} else if (message.method === "Runtime.exceptionThrown") {
			runtimeErrors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
		} else if (message.method === "Network.requestWillBeSent") {
			requests.set(message.params.requestId, {
				url: message.params.request.url,
				type: message.params.type,
				bytes: 0,
			});
		} else if (message.method === "Network.responseReceived") {
			const request = requests.get(message.params.requestId);
			if (request) {
				request.type = message.params.type;
				request.status = message.params.response.status;
				request.mime = message.params.response.mimeType;
			}
		} else if (message.method === "Network.loadingFinished") {
			const request = requests.get(message.params.requestId);
			if (request) request.bytes = message.params.encodedDataLength;
		} else if (message.method === "Page.loadEventFired" && loadStarted) {
			loadResolve();
		}
	};
	function send(method, params = {}) {
		const id = ++sequence;
		return new Promise((resolve, reject) => {
			pending.set(id, { resolve, reject });
			socket.send(JSON.stringify({ id, method, params }));
		});
	}
	try {
		await send("Page.enable");
		await send("Runtime.enable");
		await send("Network.enable");
		await send("Network.setCacheDisabled", { cacheDisabled: true });
		const mobile = device === "mobile";
		await send("Emulation.setDeviceMetricsOverride", {
			width: mobile ? 390 : 1365,
			height: mobile ? 844 : 768,
			screenWidth: mobile ? 390 : 1365,
			screenHeight: mobile ? 844 : 768,
			deviceScaleFactor: mobile ? 3 : 1,
			mobile,
		});
		if (mobile) await send("Emulation.setTouchEmulationEnabled", { enabled: true });
		await send("Page.addScriptToEvaluateOnNewDocument", {
			source: `window.__auditLcp = 0; window.__audioProgress = 0; window.__playedSources = []; document.addEventListener('playing', event => { if (event.target instanceof HTMLMediaElement) window.__playedSources.push(event.target.currentSrc); }, true); document.addEventListener('timeupdate', event => { if (event.target instanceof HTMLMediaElement) window.__audioProgress = Math.max(window.__audioProgress, event.target.currentTime); }, true); new PerformanceObserver(list => { for (const entry of list.getEntries()) window.__auditLcp = entry.startTime; }).observe({type: 'largest-contentful-paint', buffered: true});`,
		});
		loadStarted = true;
		await send("Page.navigate", { url });
		let timeoutId;
		try {
			await Promise.race([loaded, new Promise((_, reject) => {
				timeoutId = setTimeout(() => reject(new Error("Page load timeout")), 45000);
			})]);
		} finally {
			clearTimeout(timeoutId);
		}
		await new Promise((resolve) => setTimeout(resolve, 3000));
		const performance = await send("Runtime.evaluate", {
			expression: `(() => { const nav = performance.getEntriesByType('navigation')[0]; return { title: document.title, lcpMs: window.__auditLcp, fcpMs: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0, domContentLoadedMs: nav?.domContentLoadedEventEnd || 0, loadMs: nav?.loadEventEnd || 0, images: [...document.images].map(image => ({src: image.currentSrc, complete: image.complete, width: image.naturalWidth, height: image.naturalHeight})), background: getComputedStyle(document.querySelector('[style*=background-image]') || document.body).backgroundImage }; })()`,
			returnByValue: true,
		});
		const layout = await send("Runtime.evaluate", {
			expression: `({ overflow: document.documentElement.scrollWidth > innerWidth, brokenImages: [...document.images].filter(image => { const rect = image.getBoundingClientRect(); const waitingForScroll = image.loading === 'lazy' && !image.currentSrc; return rect.width && rect.height && rect.bottom > 0 && rect.top < innerHeight && !waitingForScroll && (!image.complete || !image.naturalWidth); }).map(image => ({ src: image.src, currentSrc: image.currentSrc, loading: image.loading, rect: image.getBoundingClientRect().toJSON() })) })`,
			returnByValue: true,
		});
		assert.equal(layout.result.value.overflow, false, `${device}: no horizontal overflow`);
		if (layout.result.value.brokenImages.length) {
			const failureScreenshot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
			await writeFile(path.join(tmpdir(), `studyjony-${label}-${device}-failure.png`), Buffer.from(failureScreenshot.data, "base64"));
		}
		assert.deepEqual(layout.result.value.brokenImages, [], `${device}: visible images decode`);
		const screenshot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
		const screenshotPath = path.join(tmpdir(), `studyjony-${label}-${device}.png`);
		await writeFile(screenshotPath, Buffer.from(screenshot.data, "base64"));
		const rows = [...requests.values()];
		const totals = {};
		for (const row of rows) {
			const type = row.type || "Other";
			totals[type] ??= { requests: 0, bytes: 0 };
			totals[type].requests += 1;
			totals[type].bytes += row.bytes;
		}
		let playback = null;
		let playingScreenshotPath = null;
		if (!verifyPlayback) {
			const lazyImages = await send("Runtime.evaluate", {
				expression: `[...document.images].flatMap((image, index) => { const rect = image.getBoundingClientRect(); return image.loading === 'lazy' && rect.width && rect.height ? [index] : []; })`,
				returnByValue: true,
			});
			for (const index of lazyImages.result.value) {
				await send("Runtime.evaluate", { expression: `document.images[${index}].scrollIntoView({ block: 'center' })` });
				await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
				let decoded = false;
				for (let attempt = 0; attempt < 40; attempt += 1) {
					const result = await send("Runtime.evaluate", { expression: `document.images[${index}].complete && document.images[${index}].naturalWidth > 0`, returnByValue: true });
					if (result.result.value) { decoded = true; break; }
					await new Promise((resolve) => setTimeout(resolve, 125));
				}
				if (!decoded) {
					const diagnostic = await send("Runtime.evaluate", { expression: `({ src: document.images[${index}].src, currentSrc: document.images[${index}].currentSrc, complete: document.images[${index}].complete, rect: document.images[${index}].getBoundingClientRect().toJSON(), scrollY, height: innerHeight, visibility: document.visibilityState })`, returnByValue: true });
					console.error(diagnostic.result.value);
				}
				assert.ok(decoded, `${device}: lazy image ${index} decodes after scrolling`);
			}
		}
		if (verifyPlayback) {
			const playButton = await send("Runtime.evaluate", {
				expression: `(() => { const button = document.querySelector('button[title^="Ctrl:"]'); if (!button) return null; const rect = button.getBoundingClientRect(); return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }; })()`,
				returnByValue: true,
			});
			if (!playButton.result.value) throw new Error("Story play button was not found.");
			const { x, y } = playButton.result.value;
			await send("Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
			await send("Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
			await new Promise((resolve) => setTimeout(resolve, playbackWaitMs));
			const result = await send("Runtime.evaluate", {
				expression: `(() => { const audio = document.querySelector('audio'); return { src: audio?.currentSrc, playedSources: window.__playedSources, scene: document.querySelector('[style*=background-image]')?.style.backgroundImage, currentTime: audio?.currentTime, progress: window.__audioProgress, paused: audio?.paused, error: audio?.error?.message || null, visibleCharacters: [...document.images].filter(image => image.src.includes('/shared/') && getComputedStyle(image).opacity !== '0').map(image => ({ src: image.currentSrc, complete: image.complete, width: image.naturalWidth })) }; })()`,
				returnByValue: true,
			});
			playback = result.result.value;
			assert.ok(playback.src && playback.progress > 0.1, `${device}: audio must advance`);
			assert.equal(playback.error, null, `${device}: audio decoding`);
			assert.ok(playback.visibleCharacters.length && playback.visibleCharacters.every((image) => image.complete && image.width > 0), `${device}: transparent characters must load`);
			const playingScreenshot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
			playingScreenshotPath = path.join(tmpdir(), `studyjony-${label}-${device}-playing.png`);
			await writeFile(playingScreenshotPath, Buffer.from(playingScreenshot.data, "base64"));
		}
		assert.deepEqual(runtimeErrors, [], `${device}: no runtime errors`);
		assert.deepEqual([...requests.values()].filter((request) => ["Image", "Media"].includes(request.type) && request.status >= 400), [], `${device}: no failed media requests`);
		return {
			device, url, screenshotPath,
			playingScreenshotPath, playback,
			performance: performance.result.value,
			requestCount: rows.length,
			encodedBytes: rows.reduce((sum, row) => sum + row.bytes, 0),
			totals,
			largest: rows.sort((a, b) => b.bytes - a.bytes).slice(0, 12),
		};
	} finally {
		socket.close();
	}
}

const port = await freePort();
const profile = await mkdtemp(path.join(tmpdir(), "studyjony-perf-"));
const chrome = spawn(chromePath, [
	"--headless=new", "--window-size=1365,1000", "--no-first-run", "--no-default-browser-check",
	"--disable-background-networking", "--disable-extensions", "--disable-gpu",
	"--disable-gpu-sandbox", "--no-sandbox", "--disable-software-rasterizer",
	`--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "about:blank",
], { stdio: "ignore" });
let exitCode = 0;
try {
	const results = [];
	for (const device of ["desktop", "mobile"]) results.push(await measure(device, port));
	const reportPath = path.join(tmpdir(), `studyjony-${label}-performance.json`);
	await writeFile(reportPath, JSON.stringify(results, null, 2));
	console.log(JSON.stringify({ reportPath, results: results.map((result) => ({
		device: result.device,
		requestCount: result.requestCount,
		encodedBytes: result.encodedBytes,
		totals: result.totals,
		performance: {
			fcpMs: result.performance.fcpMs,
			lcpMs: result.performance.lcpMs,
			loadMs: result.performance.loadMs,
		},
		largest: result.largest.slice(0, 5),
		screenshotPath: result.screenshotPath,
		playback: result.playback,
		playingScreenshotPath: result.playingScreenshotPath,
	})) }, null, 2));
} catch (error) {
	console.error(error);
	exitCode = 1;
} finally {
	if (chrome.pid && chrome.exitCode === null) {
		chrome.kill();
		const killer = spawn("taskkill", ["/PID", String(chrome.pid), "/T", "/F"], { stdio: "ignore" });
		killer.unref();
		chrome.unref();
	}
	if (path.resolve(profile).startsWith(path.resolve(tmpdir()) + path.sep)) {
		await rm(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }).catch(() => {});
	}
	process.exit(exitCode);
}
