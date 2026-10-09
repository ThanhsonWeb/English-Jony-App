// Run against a local production Next server. API/provider responses are mocked.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
const baseURL = process.env.STUDYJONY_TEST_URL || "http://localhost:3015";
const origin = new URL(baseURL).origin;
assert.ok(["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname), "Use a local test server only");
const root = path.resolve(__dirname, "../../..");
const png = fs.readFileSync(path.join(root, "public/lugo.png"));
const assets = ["/lugo.png", "/dialogue/coffee-shop/thumbnails/coffee-shop.png", "/stories/ten-minutes-a-day/the-old-book/bg.png"];
const audio = "/dialogue/asking-for-directions/finding-a-cafe/audio/ben-01.mp3";

(async () => {
	const manifest = JSON.parse(fs.readFileSync(path.join(root, ".next/routes-manifest.json")));
	const rewrites = Array.isArray(manifest.rewrites) ? manifest.rewrites : Object.values(manifest.rewrites).flat();
	assert.ok(rewrites.some(rule => rule.source === "/api/v1/:path*" && rule.destination.endsWith("/api/v1/:path*")), "Production API rewrite remains compiled");
	const browser = await chromium.launch({ channel: "chrome", headless: true });
	let pages = 0;
	try {
		for (const width of [320, 375, 430, 768, 1280]) for (const locale of ["vi", "en"]) for (const theme of ["light", "dark"]) {
			const page = await browser.newPage({ viewport: { width, height: 740 }, hasTouch: width < 768, colorScheme: theme });
			const errors = [], prefix = locale === "en" ? "/en" : "";
			page.on("pageerror", error => errors.push(error.message));
			page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
			await page.addInitScript(theme => localStorage.setItem("studyjony-theme", theme), theme);
			await page.route("**/*", route => {
				const url = new URL(route.request().url());
				if (url.origin === origin) return route.continue();
				if (url.hostname === "avatar.example.test") return route.fulfill({ contentType: "image/png", body: png });
				return route.fulfill({ contentType: "application/javascript", body: "" });
			});
			await page.route("**/_vercel/insights/**", route => route.fulfill({ contentType: "application/javascript", body: "" }));
			await page.route("**/api/v1/**", route => route.fulfill({ json: { status: "success", data: {
				user: { _id: "000000000000000000000001", name: "Media Learner", email: "media@example.test", photo: "https://avatar.example.test/avatar.png", theme },
				vocabularies: [], topics: [], progress: [], activities: [],
			} } }));
			try {
				for (const route of ["/profile", "/dialogue", "/dialogue/coffee-shop/ordering-a-coffee/1", "/dialogue/ten-minutes-a-day/only-ten-minutes/1"]) {
					const response = await page.goto(baseURL + prefix + route, { waitUntil: "networkidle" });
					assert.equal(response.status(), 200, route);
					await page.waitForFunction(theme => document.documentElement.dataset.theme === theme, theme);
					await page.waitForFunction(() => {
						const visible = [...document.images].filter(img => {
							const r = img.getBoundingClientRect(); return r.width && r.height && r.bottom > 0 && r.top < innerHeight;
						});
						return visible.length > 0 && visible.every(img => img.complete && img.naturalWidth > 0);
					});
					assert.ok(await page.locator('img[src="https://avatar.example.test/avatar.png"]').count(), "Account avatar remains rendered");
					assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "No horizontal overflow");
					assert.deepEqual(errors, [], "No hydration/runtime/console errors"); pages++;
				}
				if (pages === 4) {
					for (const asset of assets) {
						const image = await page.request.get(`${baseURL}/_next/image?url=${encodeURIComponent(asset)}&w=128&q=75`, { headers: { Accept: "image/webp" } });
						assert.equal(image.status(), 200, asset); assert.match(image.headers()["content-type"], /^image\//); assert.ok((await image.body()).length > 0);
					}
					const range = await page.request.get(baseURL + audio, { headers: { Range: "bytes=0-63" } });
					assert.equal(range.status(), 206); assert.equal((await range.body()).length, 64);
					assert.match(range.headers()["content-type"], /audio/);
					const duration = await page.evaluate(src => new Promise((resolve, reject) => {
						const audio = new Audio(), timer = setTimeout(() => reject(new Error("Audio metadata timed out")), 10000);
						audio.onloadedmetadata = () => { clearTimeout(timer); resolve(audio.duration); audio.src = ""; };
						audio.onerror = () => { clearTimeout(timer); reject(new Error("Audio decoding failed")); }; audio.src = src; audio.load();
					}), baseURL + audio);
					assert.ok(duration > 0);
				}
			} finally { await page.close(); }
			console.log(`PASS ${width}px ${locale} ${theme}: Profile avatars, catalogue thumbnails, Dialogue/Story lessons`);
		}
		console.log(`PASS ${pages} production page checks; 3 Next Image optimizations, audio range/decoding, compiled API rewrite`);
	} finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
