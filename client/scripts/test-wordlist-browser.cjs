// Run with Playwright available and the Next app running on localhost:3000.
// All API requests are intercepted: this test never changes live data.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const messages = require("../messages/vi.json").Notebook;
const fixtures = () =>
	["nature", "challenge", "believe", "improve", "travel"].map((english, i) => ({
		_id: String(i + 1).padStart(24, "0"),
		english,
		vietnamese: [
			"thien nhien",
			"thu thach",
			"tin tuong",
			"cai thien",
			"du lich",
		][i],
		pronunciation: "/test/",
		example: `Example for ${english}.`,
		topic: i % 2 ? "topic-a" : "topic-b",
		reviewCount: i === 4 ? 0 : 2,
		status: i === 2,
		nextReview: i === 1 ? "2020-01-01" : "2099-01-01",
		learningLevel: 1,
	}));
async function setup(browser, width = 1440, theme = "cream", state = "normal") {
	const page = await browser.newPage({
		viewport: { width, height: 1000 },
		colorScheme: "light",
	});
	await page.addInitScript(
		(theme) => localStorage.setItem("studyjony-theme", theme),
		theme,
	);
	let words = state === "empty" ? [] : fixtures();
	const requests = [],
		errors = [];
	page.on("pageerror", (error) => errors.push(error.message));
	await page.route("**/api/v1/**", async (route) => {
		const request = route.request(),
			url = new URL(request.url());
		requests.push({
			path: url.pathname,
			method: request.method(),
			body: request.postDataJSON(),
		});
		if (url.pathname.endsWith("/users/me"))
			return route.fulfill({
				json: {
					data: { user: { _id: "learner", name: "Son Jony", role: "user" } },
				},
			});
		if (url.pathname.startsWith("/api/v1/dictionary/")) {
			if (state === "lookup-error") return route.fulfill({ status: 500, json: {} });
			if (state === "lookup") {
				await new Promise((resolve) => setTimeout(resolve, 200));
				return route.fulfill({
					json: { data: {
						vietnamese: "xin chào",
						pronunciation: "/həˈloʊ/",
						example: "Hello, my friend!",
					} },
				});
			}
			return route.fulfill({ json: { data: {} } });
		}
		if (url.pathname === "/api/v1/vocab") {
			if (request.method() === "POST") {
				const newVocab = {
					...request.postDataJSON(),
					_id: "added",
					reviewCount: 0,
					nextReview: "2020-01-01",
				};
				words.push(newVocab);
				return route.fulfill({ status: 201, json: { data: { newVocab } } });
			}
			if (state === "error") return route.fulfill({ status: 500, json: {} });
			if (state === "unauthorized")
				return route.fulfill({ status: 401, json: {} });
			return route.fulfill({ json: { data: { vocabularies: words } } });
		}
		if (url.pathname.startsWith("/api/v1/vocab/")) {
			const id = url.pathname.split("/")[4],
				word = words.find((word) => word._id === id);
			if (url.pathname.endsWith("/review"))
				return route.fulfill({
					json: {
						data: {
							updatedVocab: { ...word, reviewCount: word.reviewCount + 1 },
							correct: true,
							xp: { awarded: 5, total: 5, reason: "awarded" },
						},
					},
				});
			if (request.method() === "PATCH") {
				Object.assign(word, request.postDataJSON());
				return route.fulfill({ json: { data: { updatedVocab: word } } });
			}
			if (request.method() === "DELETE") {
				words = words.filter((word) => word._id !== id);
				return route.fulfill({ status: 204 });
			}
		}
		return route.fulfill({ json: { data: {} } });
	});
	await page.goto("http://localhost:3000/wordlist");
	return { page, requests, errors };
}
async function run() {
	const browser = await chromium.launch({ channel: "chrome", headless: true });
	try {
		for (const width of [1440, 390]) {
			for (const theme of ["light", "cream", "dark", "black", "system"]) {
				const { page, requests, errors } = await setup(browser, width, theme);
				await page.getByRole("rowheader", { name: /nature/ }).waitFor();
				await page.getByRole("button", { name: messages.viewDueWords }).click();
				assert.equal(
					await page.locator("aside").evaluate((element) => element === document.activeElement),
					true,
				);
				assert.equal(
					await page.getByRole("link", { name: messages.reviewNow, exact: true }).count(),
					1,
				);
				if (theme === "dark" || theme === "black") {
					for (const [tone, color, background] of [
						["total", "rgb(66, 245, 224)", "rgba(45, 212, 191, 0.14)"],
						["learning", "rgb(196, 181, 253)", "rgba(167, 139, 250, 0.16)"],
						["dueToday", "rgb(252, 211, 77)", "rgba(251, 191, 36, 0.16)"],
					]) {
						const styles = await page.locator(`[data-tone="${tone}"]`).evaluate((element) => ({
							color: getComputedStyle(element).color,
							background: getComputedStyle(element).backgroundColor,
						}));
						assert.deepEqual(styles, { color, background });
					}
					const reviewIcon = await page.locator("aside > svg").evaluate((element) => ({
						color: getComputedStyle(element).color,
						background: getComputedStyle(element).backgroundColor,
					}));
					assert.deepEqual(reviewIcon, {
						color: "rgb(66, 245, 224)",
						background: "rgba(45, 212, 191, 0.14)",
					});
				}
				if (width >= 768) {
					const activeNav = page.locator('header nav a[aria-current="page"]:visible');
					assert.equal(await activeNav.count(), 1);
					assert.match(await activeNav.innerText(), /Sổ tay/);
					const headerBackground = await page.getByRole("banner").evaluate((element) => getComputedStyle(element).backgroundColor);
					const activeBackground = await activeNav.evaluate((element) => getComputedStyle(element).backgroundColor);
					assert.notEqual(activeBackground, headerBackground);
				} else {
					await page.getByRole("button", { name: "Toggle menu" }).click();
					const activeNav = page.locator('header nav a[aria-current="page"]:visible');
					assert.equal(await activeNav.count(), 1);
					assert.match(await activeNav.innerText(), /Sổ tay/);
					await page.getByRole("button", { name: "Toggle menu" }).click();
				}
				assert.equal(await page.locator("tbody tr").count(), 5);
				assert.equal(
					requests.filter((r) => r.path === "/api/v1/vocab").length,
					1,
				);
				assert.ok(
					await page.evaluate(
						() => document.documentElement.scrollWidth <= innerWidth,
					),
				);
				assert.equal(
					await page.locator("html").getAttribute("data-theme"),
					theme === "system" ? "light" : theme,
				);
				await page.locator('[data-status="review"][aria-pressed]').click();
				assert.equal(await page.locator("tbody tr").count(), 1);
				await page.locator('[data-status="all"][aria-pressed]').click();
				await page
					.getByRole("textbox", { name: messages.search })
					.fill("du lich");
				assert.equal(await page.locator("tbody tr").count(), 1);
				await page
					.getByRole("textbox", { name: messages.search })
					.fill("no-matching-word");
				await page.getByText(messages.noResults).waitFor();
				await page.getByRole("textbox", { name: messages.search }).fill("");
				if (theme === "light" || theme === "dark")
					await page.screenshot({
						path: require("node:path").join(
							require("node:os").tmpdir(),
							`wordlist-${theme}-${width}.png`,
						),
						fullPage: true,
					});
				if (theme === "system") {
					await page.emulateMedia({ colorScheme: "dark" });
					await page.waitForFunction(
						() => document.documentElement.dataset.theme === "dark",
					);
				}
				assert.deepEqual(errors, []);
				await page.close();
				console.log(`PASS notebook ${width}px ${theme}`);
			}
		}
		const { page, requests } = await setup(browser);
		await page.getByRole("rowheader", { name: /nature/ }).waitFor();
		await page
			.getByRole("button", { name: messages.addWord, exact: true })
			.click();
		await page.locator('input[name="english"]').fill("notebook");
		await page.locator('input[name="vietnamese"]').fill("so tay");
		await page
			.getByRole("button", { name: messages.save, exact: true })
			.click();
		await page.getByRole("rowheader", { name: /notebook/ }).waitFor();
		assert.equal(
			requests.find((r) => r.method === "POST").body.topic,
			undefined,
		);
		await page
			.getByRole("button", { name: `${messages.edit} notebook`, exact: true })
			.click();
		await page.locator('input[name="english"]').fill("journal");
		await page
			.getByRole("button", { name: messages.save, exact: true })
			.click();
		await page.getByRole("rowheader", { name: /journal/ }).waitFor();
		await page
			.getByRole("button", { name: `${messages.remove} journal`, exact: true })
			.click();
		await page
			.getByRole("dialog")
			.getByRole("button", { name: messages.remove, exact: true })
			.click();
		await page.getByRole("dialog").waitFor({ state: "hidden" });
		assert.equal(await page.locator("tbody tr").count(), 5);
		await page.close();
		console.log("PASS topic-free create/edit/delete");
		const lookup = await setup(browser, 1440, "cream", "lookup");
		await lookup.page.getByRole("rowheader", { name: /nature/ }).waitFor();
		await lookup.page.getByRole("button", { name: messages.addWord, exact: true }).click();
		await lookup.page.locator('input[name="english"]').fill("hello");
		await lookup.page.locator('input[name="vietnamese"]').fill("chào bạn");
		await lookup.page.waitForFunction(() =>
			document.querySelector('input[name="pronunciation"]')?.value === "/həˈloʊ/",
		);
		assert.equal(await lookup.page.locator('input[name="vietnamese"]').inputValue(), "chào bạn");
		assert.equal(await lookup.page.locator('textarea[name="example"]').inputValue(), "Hello, my friend!");
		await lookup.page.locator('textarea[name="example"]').fill("Hello there!");
		await lookup.page.getByRole("button", { name: messages.save, exact: true }).click();
		await lookup.page.getByRole("rowheader", { name: /hello/ }).waitFor();
		assert.deepEqual(
			Object.fromEntries(Object.entries(lookup.requests.find((r) => r.method === "POST").body)
				.filter(([key]) => ["english", "vietnamese", "pronunciation", "example"].includes(key))),
			{ english: "hello", vietnamese: "chào bạn", pronunciation: "/həˈloʊ/", example: "Hello there!" },
		);
		await lookup.page.close();
		console.log("PASS dictionary autofill and manual edits");
		const fallback = await setup(browser, 390, "cream", "lookup-error");
		await fallback.page.getByRole("rowheader", { name: /nature/ }).waitFor();
		await fallback.page.getByRole("button", { name: messages.addWord, exact: true }).click();
		await fallback.page.locator('input[name="english"]').fill("hello");
		await fallback.page.getByText(messages.lookupUnavailable).waitFor();
		await fallback.page.locator('input[name="vietnamese"]').fill("xin chào");
		await fallback.page.getByRole("button", { name: messages.save, exact: true }).click();
		await fallback.page.getByRole("rowheader", { name: /hello/ }).waitFor();
		await fallback.page.close();
		console.log("PASS manual save after dictionary failure");
		for (const width of [1440, 390])
			for (const mode of ["flashcard", "quiz", "write"]) {
				const { page, requests, errors } = await setup(browser, width);
				await page.getByRole("rowheader", { name: /nature/ }).waitFor();
				await page.locator(`[data-mode="${mode}"]`).click();
				assert.equal(
					await page.locator(`input[name="review-mode"][value="${mode}"]`).isChecked(),
					true,
				);
				await page
					.getByRole("link", { name: messages.reviewNow, exact: true })
					.first()
					.click();
				await page.waitForURL(`**/wordlist/review/${mode}`);
				if (mode === "flashcard") {
					await page
						.getByRole("heading", { name: "challenge", exact: true })
						.waitFor();
					await page.getByRole("button", { name: /Còn mơ hồ/ }).click();
					await page
						.getByRole("heading", { name: "nature", exact: true })
						.waitFor();
				} else {
					if (mode === "write")
						await page.locator('input[type="text"]').first().fill("challenge");
					else await page.getByRole("button", { name: /thu thach/ }).click();
					await page
						.getByRole("button", { name: "Kiểm tra", exact: true })
						.click();
					await page
						.getByRole("button", { name: "Tiếp tục", exact: true })
						.waitFor();
				}
				const review = requests.find((r) => r.path.endsWith("/review"));
				assert.ok(review.path.includes(fixtures()[1]._id));
				assert.equal(review.body.mode, mode === "write" ? "writing" : mode);
				if (mode !== "flashcard") await page.getByRole("button", { name: "Tiếp tục", exact: true }).click();
				for (const index of [0, 3, 4]) {
					const word = fixtures()[index];
					if (mode === "flashcard") {
						await page.getByRole("heading", { name: word.english, exact: true }).waitFor();
						await page.getByRole("button", { name: /Còn mơ hồ/ }).click();
					} else {
						if (mode === "write") await page.locator('input[type="text"]').first().fill(word.english);
						else await page.getByRole("button", { name: new RegExp(word.vietnamese) }).click();
						await page.getByRole("button", { name: "Kiểm tra", exact: true }).click();
						await page.getByRole("button", { name: "Tiếp tục", exact: true }).click();
					}
				}
				await page.getByRole("button", { name: "Quay lại danh sách từ", exact: true }).click();
				await page.waitForURL("**/wordlist");
				assert.equal(requests.filter(r => r.path.endsWith("/review")).length, 4);
				assert.deepEqual(errors, []);
				await page.close();
				console.log(
					`PASS global ${width}px ${mode}: due first, existing review API`,
				);
			}
		for (const state of ["empty", "error", "unauthorized"]) {
			const { page } = await setup(browser, 390, "light", state);
			await page
				.getByText(
					messages[
						state === "empty"
							? "emptyTitle"
							: state === "error"
								? "loadError"
								: "unauthorized"
					],
				)
				.waitFor();
			assert.equal(
				await page
					.getByRole("link", { name: messages.reviewNow, exact: true })
					.count(),
				0,
			);
			assert.equal(
				await page.getByRole("button", { name: messages.reviewNow, exact: true }).isDisabled(),
				true,
			);
			await page.close();
			console.log(`PASS ${state} state`);
		}
	} finally {
		await browser.close();
	}
}
run().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
