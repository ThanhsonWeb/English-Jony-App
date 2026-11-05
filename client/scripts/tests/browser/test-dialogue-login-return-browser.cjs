// Login return-path regression checks. APIs and OAuth session are mocked.
const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const baseURL = process.env.STUDYJONY_TEST_URL || "http://localhost:3000";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname));
const userId = "aaaaaaaaaaaaaaaaaaaaaaaa";
const dialoguePath = "/dialogue/ten-minutes-a-day/the-old-book/1";

async function createPage(browser, { signedIn = false } = {}) {
	const context = await browser.newContext();
	await context.addInitScript(() => {
		localStorage.setItem("studyjony-theme", "dark");
	});
	await context.route("**/*", (route) => new URL(route.request().url()).origin === new URL(baseURL).origin
		? route.continue()
		: route.fulfill({ body: "" }));
	await context.route("**/api/v1/**", (route) => {
		const url = new URL(route.request().url());
		if (url.pathname.endsWith("/users/me")) {
			return route.fulfill({ status: signedIn ? 200 : 401, json: signedIn
				? { status: "success", data: { user: { _id: userId, name: "Return tester", theme: "dark", language: "en" } } }
				: { status: "fail" } });
		}
		if (url.pathname.endsWith("/auth/credentials/login")) {
			const attempt = route.request().headers()["x-studyjony-auth-attempt"];
			return route.fulfill({ json: { status: "success", data: {
				credentialAttempt: attempt,
				user: { _id: userId, name: "Return tester", theme: "dark", language: "en" },
			} } });
		}
		if (url.pathname.endsWith("/auth/google/state")) {
			return route.fulfill({ json: { status: "success", data: {
				clientId: "browser-test-client",
				redirectUri: `${baseURL}/api/v1/auth/google/callback`,
				state: "browser-test-state",
			} } });
		}
		return route.fulfill({ json: { status: "success", data: {} } });
	});
	const page = await context.newPage();
	const errors = [];
	page.on("pageerror", (error) => errors.push(error.message));
	return { context, page, errors };
}

async function passwordLogin(browser, returnTo, expectedPath) {
	const fixture = await createPage(browser);
	try {
		const query = returnTo === null ? "" : `?returnTo=${encodeURIComponent(returnTo)}`;
		await fixture.page.goto(`${baseURL}/en/login${query}`);
		await fixture.page.locator("#login-email").fill("learner@example.test");
		await fixture.page.locator("#login-password").fill("safe-test-password");
		await fixture.page.locator("form").getByRole("button", { name: "Sign in", exact: true }).click();
		await fixture.page.waitForURL((url) => url.pathname === `/en${expectedPath}`);
		assert.deepEqual(fixture.errors, []);
		console.log(`PASS password login: ${returnTo || "no return path"} -> ${new URL(fixture.page.url()).pathname}`);
	} finally {
		await fixture.context.close();
	}
}

async function googleOAuth(browser) {
	const fixture = await createPage(browser, { signedIn: true });
	try {
		await fixture.page.goto(`${baseURL}/en/login`);
		await fixture.page.evaluate((returnPath) => sessionStorage.setItem("studyjony-google-oauth-return-path", returnPath), dialoguePath);
		await fixture.page.goto(`${baseURL}/en/oauth/google/callback`);
		await fixture.page.waitForURL((url) => url.pathname === `/en${dialoguePath}`);
		assert.equal(await fixture.page.evaluate(() => sessionStorage.getItem("studyjony-google-oauth-return-path")), null,
			"Google return destination is removed after use");
		assert.deepEqual(fixture.errors, []);
		console.log(`PASS Google OAuth callback restores ${new URL(fixture.page.url()).pathname}`);
	} finally {
		await fixture.context.close();
	}
}

(async () => {
	const browser = await chromium.launch({ channel: "chrome", headless: true });
	try {
		await passwordLogin(browser, dialoguePath, dialoguePath);
		await passwordLogin(browser, "https://attacker.example/steal", "/wordlist");
		await passwordLogin(browser, null, "/wordlist");
		await googleOAuth(browser);
	} finally {
		await browser.close();
	}
})().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
