// Local Next HTML with provider/API mocks. No live credentials or provider work.
const assert = require("node:assert/strict");
const http = require("node:http");
const { chromium } = require("playwright");
const baseURL = process.env.STUDYJONY_TEST_URL || "http://localhost:3024";
const base = new URL(baseURL);
assert.ok(["localhost", "127.0.0.1"].includes(base.hostname));
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=", "base64");
const googleScript = "window.googleLoaded=true;window.google={accounts:{oauth2:{initCodeClient:options=>({requestCode(){window.googleStarted=true;window.googleOptions=options;}})}}};";
const analyticsScript = "window.analyticsLoaded=true;fetch('/_vercel/insights/view',{method:'POST',body:'{}'});";
// Short valid PCM WAV for mocked dictionary pronunciation URLs.
const wav = Buffer.alloc(44 + 1600);
wav.write("RIFF"); wav.writeUInt32LE(wav.length - 8, 4); wav.write("WAVEfmt ", 8); wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(8000, 24); wav.writeUInt32LE(16000, 28);
wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write("data", 36); wav.writeUInt32LE(1600, 40);

(async () => {
	const browser = await chromium.launch({ channel: "chrome", headless: true });
	let checks = 0, frameServer;
	try {
		for (const width of [320, 1280]) for (const locale of ["vi", "en"]) for (const theme of ["light", "dark"]) {
			const context = await browser.newContext({ viewport: { width, height: 800 }, colorScheme: theme, hasTouch: width < 768 });
			const page = await context.newPage(), errors = [], prefix = locale === "en" ? "/en" : "";
			const messages = require(`../messages/${locale}.json`);
			page.on("pageerror", error => errors.push(error.message));
			await context.addInitScript(theme => { localStorage.setItem("studyjony-theme", theme); window.cspFailures = []; document.addEventListener("securitypolicyviolation", event => window.cspFailures.push({ directive: event.effectiveDirective, blocked: event.blockedURI })); }, theme);
			await context.route("**/*", route => {
				const url = new URL(route.request().url());
				if (url.origin === base.origin) return route.continue();
				if (url.href === "https://accounts.google.com/gsi/client") return route.fulfill({ contentType: "application/javascript", body: googleScript });
				if (url.hostname === "va.vercel-scripts.com") return route.fulfill({ contentType: "application/javascript", body: analyticsScript });
				if (/^(lh[3-6]\.googleusercontent\.com|res\.cloudinary\.com)$/.test(url.hostname)) return route.fulfill({ contentType: "image/png", body: png });
				if (["api.dictionaryapi.dev", "ssl.gstatic.com"].includes(url.hostname)) return route.fulfill({ contentType: "audio/wav", body: wav });
				return route.abort();
			});
			await context.route("**/_vercel/insights/**", route => route.request().url().endsWith("script.js") ? route.fulfill({ contentType: "application/javascript", body: analyticsScript }) : route.fulfill({ status: 204 }));
			await context.route("**/api/v1/**", route => {
				const path = new URL(route.request().url()).pathname;
				if (path.endsWith("/credentials/signup")) return route.fulfill({ status: 400, json: { status: "fail", code: "passwordTooLong", message: "Password must be at most 72 UTF-8 bytes" } });
				if (path.endsWith("/google/state")) return route.fulfill({ json: { status: "success", data: { state: "mock-state", clientId: "mock-client", redirectUri: baseURL + "/api/v1/auth/google/callback" } } });
				return route.fulfill({ json: { status: "success", data: { user: null, vocabularies: [], topics: [], activities: [], progress: [] } } });
			});
			try {
				for (const path of ["/", "/login", "/signup", "/wordlist", "/dialogue/asking-for-directions/finding-a-cafe", "/dialogue/ten-minutes-a-day/the-old-book"]) {
					const response = await page.goto(baseURL + prefix + path, { waitUntil: "networkidle" });
					assert.equal(response.status(), 200); const headers = await response.allHeaders();
					assert.match(headers["content-type"], /text\/html/); assert.match(headers["content-security-policy"], /frame-ancestors 'none'/);
					assert.doesNotMatch(headers["content-security-policy"], /unsafe-eval/); assert.equal(headers["x-frame-options"], "DENY");
					assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
					await page.waitForFunction(() => window.analyticsLoaded === true);
					assert.deepEqual(await page.evaluate(() => window.cspFailures), []);
					if (path === "/login" || path === "/signup") {
						await page.waitForFunction(() => window.googleLoaded === true);
						await page.getByRole("button", { name: messages.Auth[path === "/login" ? "googleLogin" : "googleSignup"], exact: true }).click();
						await page.waitForFunction(() => window.googleStarted === true);
					}
					if (path === "/signup") {
						await page.locator('input[name="name"]').fill("Byte Learner"); await page.locator('input[name="email"]').fill("byte@example.test");
						await page.locator('input[name="password"]').fill("ế".repeat(25)); await page.locator('input[name="passwordConfirm"]').fill("ế".repeat(25));
						await page.locator('button[type="submit"]').click(); await page.getByRole("alert").filter({ hasText: messages.Auth.passwordTooLong }).waitFor();
					}
					assert.deepEqual(errors, []); checks++;
				}
				const imageResults = await page.evaluate(async () => Promise.all(["/icon.png", "https://res.cloudinary.com/mock/image.png", "https://lh3.googleusercontent.com/mock.png"].map(src => new Promise(resolve => { const img = new Image(); img.onload = () => resolve(true); img.onerror = () => resolve(false); img.src = src; }))));
				assert.deepEqual(imageResults, [true, true, true]); assert.deepEqual(await page.evaluate(() => window.cspFailures), []);
				const audioResults = await page.evaluate(async () => {
					const sources = ["/dialogue/asking-for-directions/finding-a-cafe/audio/ben-01.mp3", "/stories/ten-minutes-a-day/the-old-book/audio/mr-daniel-01.mp3", "https://api.dictionaryapi.dev/media/mock.wav", "https://ssl.gstatic.com/dictionary/mock.wav"];
					return Promise.all(sources.map(src => new Promise(resolve => { const audio = new Audio(); const timer = setTimeout(() => resolve(false), 10000); audio.onloadeddata = () => { clearTimeout(timer); resolve(true); }; audio.onerror = () => { clearTimeout(timer); resolve(false); }; audio.src = src; audio.load(); })));
				});
				assert.deepEqual(audioResults, [true, true, true, true]); assert.deepEqual(await page.evaluate(() => window.cspFailures), []);
				console.log(`PASS ${width}px ${locale} ${theme}: six HTML routes, headers, hydration, Google start, analytics, images, byte feedback`);
			} finally { await context.close(); }
		}
		// Different local origin tries framing actual Next HTML. The child cannot load.
		frameServer = await new Promise(resolve => { const server = http.createServer((req, res) => { res.setHeader("Content-Type", "text/html"); res.end(`<iframe src="${baseURL}/login"></iframe>`); }).listen(0, "127.0.0.1", () => resolve(server)); });
		const page = await browser.newPage();
		await page.goto(`http://127.0.0.1:${frameServer.address().port}`); await page.waitForTimeout(250);
		assert.ok(!page.frames().some(frame => frame.url() === baseURL + "/login")); await page.close();
		console.log(`PASS ${checks} production HTML checks and cross-origin framing rejection; providers mocked`);
	} finally { if (frameServer) await new Promise(resolve => frameServer.close(resolve)); await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
