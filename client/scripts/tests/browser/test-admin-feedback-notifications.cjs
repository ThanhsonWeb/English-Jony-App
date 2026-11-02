const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const baseURL = process.env.STUDYJONY_TEST_URL || "http://localhost:3016";
const base = new URL(baseURL);
assert.ok(["localhost", "127.0.0.1"].includes(base.hostname), "Admin feedback UI tests run against localhost only");

const messages = {
	en: require("../../../messages/en.json"),
	vi: require("../../../messages/vi.json"),
};
const sample = {
	_id: "65b000000000000000000001",
	type: "suggestion",
	message: "Please add more travel dialogues.",
	status: "new",
	createdAt: "2026-01-01T00:00:00.000Z",
};

function json(route, status, body) {
	return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

async function mockApi(page, role, language = role ? "en" : "vi") {
	let unreadCount = 1;
	let countRequests = 0;
	let statusUpdates = 0;
	let currentSample = { ...sample };
	await page.route("**/api/v1/**", async (route) => {
		const request = route.request();
		const url = new URL(request.url());
		if (url.pathname === "/api/v1/users/me") {
			if (!role) return json(route, 401, { status: "fail", message: "Please log in." });
			return json(route, 200, {
				status: "success",
				data: { user: { _id: `test-${role}`, name: `Test ${role}`, email: `${role}@example.test`, role, theme: "system", language } },
			});
		}
		if (url.pathname === "/api/v1/admin/feedback/unread-count") {
			countRequests += 1;
			return json(route, 200, { status: "success", data: { count: unreadCount } });
		}
		if (url.pathname === "/api/v1/admin/feedback" && request.method() === "GET") {
			return json(route, 200, {
				status: "success",
				data: { feedback: [currentSample], pagination: { page: 1, limit: 20, totalRecords: 1, totalPages: 1 } },
			});
		}
		if (url.pathname === `/api/v1/admin/feedback/${sample._id}/status` && request.method() === "PATCH") {
			const body = JSON.parse(request.postData() || "{}");
			assert.equal(body.status, "resolved");
			statusUpdates += 1;
			unreadCount = 0;
			currentSample = { ...currentSample, status: body.status };
			return json(route, 200, { status: "success", data: { feedback: currentSample } });
		}
		return json(route, 200, { status: "success", data: {} });
	});
	return {
		get countRequests() { return countRequests; },
		get statusUpdates() { return statusUpdates; },
	};
}

async function adminScenario(browser, { locale, theme, width }) {
	const context = await browser.newContext({ viewport: { width, height: 740 }, colorScheme: theme });
	const page = await context.newPage();
	const errors = [];
	page.on("pageerror", (error) => errors.push(error.message));
	const api = await mockApi(page, "admin", locale);
	try {
		await page.goto(new URL(`/${locale}/dialogue`, base).href);
		const notification = page.getByTestId("admin-feedback-notifications");
		await notification.waitFor();
		await page.waitForFunction(() => document.querySelector('[data-testid="admin-feedback-unread-count"]')?.textContent === "1");
		assert.equal(await notification.getAttribute("aria-label"), messages[locale].Header.newFeedbackNotifications.replace("{count}", "1"));
		assert.equal(await page.locator("html").getAttribute("data-theme"), theme);

		if (width < 768) {
			assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, "mobile header must not overflow horizontally");
		}

		assert.equal(await notification.evaluate((element) => element.tabIndex), 0, "notification button must be keyboard focusable");
		await notification.focus();
		await page.keyboard.press("Enter");
		const dashboardPath = locale === "vi" ? "/admin/feedback" : "/en/admin/feedback";
		await page.waitForURL(new URL(dashboardPath, base).href);
		await page.getByRole("button", { name: messages[locale].AdminFeedback.markResolved, exact: true }).click();
		await page.waitForFunction(() => !document.querySelector('[data-testid="admin-feedback-unread-count"]'));
		assert.equal(api.statusUpdates, 1);
		assert.ok(api.countRequests >= 2, "header refreshes its count after feedback status changes");
		assert.deepEqual(errors, []);
	} finally {
		await context.close();
	}
}

async function deniedScenario(browser, role) {
	const locale = role ? "en" : "vi";
	const context = await browser.newContext({ viewport: { width: 1280, height: 740 } });
	const page = await context.newPage();
	const api = await mockApi(page, role, locale);
	try {
		await page.goto(new URL(`/${locale}/dialogue`, base).href);
		if (role) await page.getByText(`Test ${role}`, { exact: true }).waitFor();
		else await page.getByRole("link", { name: messages.vi.Header.signIn, exact: true }).waitFor();
		assert.equal(await page.getByTestId("admin-feedback-notifications").count(), 0);
		assert.equal(api.countRequests, 0, "non-admin sessions must not request the protected count endpoint");
	} finally {
		await context.close();
	}
}

(async () => {
	const browser = await chromium.launch({ channel: "chrome", headless: true });
	try {
		await adminScenario(browser, { locale: "vi", theme: "dark", width: 375 });
		await adminScenario(browser, { locale: "en", theme: "light", width: 1280 });
		await deniedScenario(browser, "user");
		await deniedScenario(browser, null);
		console.log("PASS 4 admin feedback notification browser scenarios; local frontend and mocked API only");
	} finally {
		await browser.close();
	}
})().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
