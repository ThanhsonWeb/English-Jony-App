const { before, after, test } = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const User = require("../models/userModel");
const app = require("../app");

let replicaSet;
let server;
let baseUrl;
const originalSecret = process.env.JWT_SECRET;
const originalExpiry = process.env.JWT_EXPIRES_IN;
const originalNodeEnv = process.env.NODE_ENV;
const originalFrontend = process.env.FRONTEND_URL;
const trustedOrigin = "http://studyjony.test";

before(async () => {
	process.env.JWT_SECRET = "isolated-user-theme-test-secret";
	process.env.JWT_EXPIRES_IN = "1h";
	process.env.NODE_ENV = "development";
	process.env.FRONTEND_URL = trustedOrigin;
	replicaSet = await MongoMemoryReplSet.create({ binary: { version: "7.0.14" }, replSet: { count: 1 } });
	await mongoose.connect(replicaSet.getUri(), { dbName: "user_theme_test" });
	await User.create([
		{ name: "Learner A", email: "theme-a@example.com", password: "password123", passwordConfirm: "password123" },
		{ name: "Learner B", email: "theme-b@example.com", password: "password123", passwordConfirm: "password123" },
	]);
	server = await new Promise((resolve) => {
		const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
	});
	baseUrl = `http://127.0.0.1:${server.address().port}/api/v1`;
}, { timeout: 180000 });

after(async () => {
	if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
	await mongoose.disconnect();
	await replicaSet?.stop();
	if (originalSecret === undefined) delete process.env.JWT_SECRET;
	else process.env.JWT_SECRET = originalSecret;
	if (originalExpiry === undefined) delete process.env.JWT_EXPIRES_IN;
	else process.env.JWT_EXPIRES_IN = originalExpiry;
	if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
	else process.env.NODE_ENV = originalNodeEnv;
	if (originalFrontend === undefined) delete process.env.FRONTEND_URL;
	else process.env.FRONTEND_URL = originalFrontend;
});

async function login(email) {
	const response = await fetch(`${baseUrl}/auth/login`, {
		method: "POST",
		headers: { "Content-Type": "application/json", Origin: trustedOrigin },
		body: JSON.stringify({ email, password: "password123" }),
	});
	assert.equal(response.status, 200);
	return { user: (await response.json()).data.user, cookie: response.headers.get("set-cookie").split(";")[0] };
}

async function saveTheme(cookie, userId, theme) {
	return fetch(`${baseUrl}/users/theme`, {
		method: "PATCH",
		headers: { "Content-Type": "application/json", Cookie: cookie, Origin: trustedOrigin },
		body: JSON.stringify({ theme, expectedUserId: userId }),
	});
}

async function getMe(cookie) {
	const response = await fetch(`${baseUrl}/users/me`, { headers: { Cookie: cookie } });
	assert.equal(response.status, 200);
	return (await response.json()).data.user;
}

test("A dark, logout, B light, then A again restores each saved theme", async () => {
	const firstA = await login("theme-a@example.com");
	assert.equal(firstA.user.theme, "system");
	assert.equal((await saveTheme(firstA.cookie, firstA.user._id, "dark")).status, 200);
	assert.equal((await getMe(firstA.cookie)).theme, "dark");

	const logout = await fetch(`${baseUrl}/auth/logout`, { method: "POST", headers: { Cookie: firstA.cookie, Origin: trustedOrigin } });
	assert.equal(logout.status, 200);
	assert.match(logout.headers.get("set-cookie"), /jwt=;/);

	const firstB = await login("theme-b@example.com");
	assert.equal(firstB.user.theme, "system");
	assert.equal((await saveTheme(firstB.cookie, firstB.user._id, "light")).status, 200);
	assert.equal((await getMe(firstB.cookie)).theme, "light");

	const secondA = await login("theme-a@example.com");
	assert.equal(secondA.user.theme, "dark");
	assert.equal((await getMe(secondA.cookie)).theme, "dark");
	assert.equal((await User.findById(firstB.user._id)).theme, "light");
});

test("theme updates reject invalid values and a stale account request", async () => {
	const a = await login("theme-a@example.com");
	const b = await login("theme-b@example.com");
	assert.equal((await saveTheme(a.cookie, a.user._id, "bright-pink")).status, 400);
	assert.equal((await saveTheme(b.cookie, a.user._id, "dark")).status, 409);
	assert.equal((await getMe(b.cookie)).theme, "light");
});
