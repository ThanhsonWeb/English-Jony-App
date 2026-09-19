// Run with Playwright available and Next dev running on port 3000.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");

async function run() {
	const browser = await chromium.launch({ channel: "chrome", headless: true });
	try {
		for (const width of [1440, 390]) {
			for (const mode of ["flashcard", "quiz", "write"]) {
				const page = await browser.newPage({ viewport: { width, height: 900 } });
				const submitted = [];
				const errors = [];
				page.on("pageerror", error => errors.push(error.message));
				const words = ["hello", "apple", "book", "water"].map((english, i) => ({
					_id: String(i + 1).padStart(24, "0"), english, vietnamese: ["xin chao", "tao", "sach", "nuoc"][i],
					nextReview: "2020-01-01", reviewCount: 0, learningLevel: 0,
				}));
				await page.route("**/api/v1/**", async route => {
					const url = new URL(route.request().url());
					if (url.pathname.endsWith("/review")) {
						assert.equal(route.request().method(), "POST");
						const input = route.request().postDataJSON();
						submitted.push(input);
						return route.fulfill({ json: { status: "success", data: { updatedVocab: { ...words[0], reviewCount: 1 }, correct: true, xp: { awarded: mode === "flashcard" ? 2 : 5, total: 5, reason: "awarded" } } } });
					}
					if (url.pathname === "/api/v1/vocab") return route.fulfill({ json: { data: { vocabularies: words } } });
					if (url.pathname === "/api/v1/study-activities") return route.fulfill({ json: { status: "success" } });
					return route.fulfill({ status: 401, json: { status: "fail" } });
				});
				await page.goto(`http://localhost:3000/wordlist/000000000000000000000099/learn/${mode}`);
				if (mode === "flashcard") {
					await page.getByRole("button", { name: /Còn mơ hồ/ }).click();
					await page.getByRole("heading", { name: "apple", exact: true }).waitFor();
				} else {
					if (mode === "write") await page.locator('input[type="text"]').first().fill("hello");
					else await page.getByRole("button", { name: /xin chao/ }).click();
					await page.getByRole("button", { name: "Kiểm tra", exact: true }).click();
					await page.getByRole("button", { name: "Tiếp tục", exact: true }).waitFor();
				}
				assert.equal(submitted.length, 1);
				assert.equal(submitted[0].mode, mode === "write" ? "writing" : mode);
				assert.equal(submitted[0].practice, false);
				assert.equal(submitted[0].rating ?? submitted[0].answer, mode === "flashcard" ? "hard" : mode === "quiz" ? "xin chao" : "hello");
				assert.deepEqual(errors, []);
				console.log(`PASS ${width}px ${mode}: dedicated review submitted and saved`);
				await page.close();
			}
		}
	} finally { await browser.close(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
