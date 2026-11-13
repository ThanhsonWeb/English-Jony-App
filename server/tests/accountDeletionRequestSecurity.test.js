const assert = require("node:assert/strict");
const { before, after, beforeEach, test } = require("node:test");
const crypto = require("node:crypto");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const User = require("../models/userModel");
const app = require("../app");

const frontend = "https://studyjony.test";
const password = "current-password-for-test";
const previousEnv = Object.fromEntries([
	"NODE_ENV", "FRONTEND_URL", "JWT_SECRET", "ACCOUNT_DELETION_REQUEST_ENABLED",
].map(key => [key, process.env[key]]));
let mongo, server, base, passwordUser, googleUser;

before(async () => {
	process.env.NODE_ENV = "production";
	process.env.FRONTEND_URL = frontend;
	process.env.JWT_SECRET = "local-account-deletion-request-test-key";
	delete process.env.ACCOUNT_DELETION_REQUEST_ENABLED;
	mongo = await MongoMemoryReplSet.create({
		binary: { version: "7.0.14" },
		replSet: { count: 1, storageEngine: "wiredTiger" },
	});
	await mongoose.connect(mongo.getUri(), { dbName: "account_deletion_request_security" });
	await User.init();
	server = await new Promise(resolve => {
		const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
	});
	base = `http://127.0.0.1:${server.address().port}/api/v1`;
}, { timeout: 180000 });

after(async () => {
	if (server) await new Promise(resolve => server.close(resolve));
	await mongoose.disconnect();
	await mongo?.stop();
	for (const [key, value] of Object.entries(previousEnv)) {
		if (value === undefined) delete process.env[key];
		else process.env[key] = value;
	}
});

beforeEach(async () => {
	delete process.env.ACCOUNT_DELETION_REQUEST_ENABLED;
	await User.deleteMany({});
	[passwordUser, googleUser] = await User.create([
		{ name: "Password Account", email: `password-${crypto.randomUUID()}@example.test`, password, passwordConfirm: password },
		{ name: "Google Account", email: `google-${crypto.randomUUID()}@example.test`, googleId: crypto.randomUUID() },
	]);
});

function tokenFor(user) {
	return jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: "10m" });
}

async function request(user, body, { origin = frontend } = {}) {
	const headers = { "Content-Type": "application/json", Origin: origin };
	if (user) headers.Cookie = `jwt=${tokenFor(user)}`;
	return fetch(`${base}/users/request-account-deletion`, {
		method: "POST",
		headers,
		...(body === undefined ? {} : { body: JSON.stringify(body) }),
	});
}

const validBody = currentPassword => ({ confirmation: "DELETE MY ACCOUNT", currentPassword });

async function lifecycle(user) {
	const current = await User.findById(user.id).select("+lifecycleState").lean();
	return current?.lifecycleState;
}

test("request API is disabled by default even with valid authentication and confirmation", async () => {
	assert.equal(process.env.ACCOUNT_DELETION_REQUEST_ENABLED, undefined);
	const response = await request(passwordUser, validBody(password));
	assert.equal(response.status, 404);
	assert.equal(await lifecycle(passwordUser), "active");
});

test("request requires an authenticated session and same-origin CSRF approval", async () => {
	process.env.ACCOUNT_DELETION_REQUEST_ENABLED = "true";
	assert.equal((await request(null, validBody(password))).status, 401);
	assert.equal((await request(passwordUser, validBody(password), { origin: "https://attacker.test" })).status, 403);
	assert.equal(await lifecycle(passwordUser), "active");
});

test("explicit typed confirmation and an exact request body are required", async () => {
	process.env.ACCOUNT_DELETION_REQUEST_ENABLED = "true";
	for (const body of [
		{ currentPassword: password },
		{ confirmation: "DELETE", currentPassword: password },
		{ ...validBody(password), role: "admin" },
	]) assert.equal((await request(passwordUser, body)).status, 400);
	assert.equal(await lifecycle(passwordUser), "active");
});

test("wrong current password and Google-only account are rejected without initiation", async () => {
	process.env.ACCOUNT_DELETION_REQUEST_ENABLED = "true";
	assert.equal((await request(passwordUser, validBody("wrong-password"))).status, 401);
	assert.equal((await request(googleUser, validBody(password))).status, 403);
	assert.equal(await lifecycle(passwordUser), "active");
	assert.equal(await lifecycle(googleUser), "active");
});

test("valid password reauthentication initiates deletion through the existing service", async () => {
	process.env.ACCOUNT_DELETION_REQUEST_ENABLED = "true";
	const response = await request(passwordUser, validBody(password));
	assert.equal(response.status, 202);
	assert.deepEqual(await response.json(), { status: "success", data: { requested: true } });
	assert.equal(await lifecycle(passwordUser), "deleting");
	assert.equal(await lifecycle(googleUser), "active");
});

test("a password hash change during reauthentication fails closed", async t => {
	process.env.ACCOUNT_DELETION_REQUEST_ENABLED = "true";
	const replacementHash = await require("bcrypt").hash("new-password", 4);
	const originalExists = User.exists;
	const stub = t.mock.method(User, "exists", async function (filter) {
		await User.updateOne({ _id: passwordUser._id }, { $set: { password: replacementHash } });
		return originalExists.call(this, filter);
	});
	try {
		const response = await request(passwordUser, validBody(password));
		assert.equal(response.status, 401);
		assert.equal(await lifecycle(passwordUser), "active");
	} finally {
		stub.mock.restore();
	}
});

test("per-user rate limiting blocks repeated reauthentication attempts", async () => {
	process.env.ACCOUNT_DELETION_REQUEST_ENABLED = "true";
	for (let attempt = 0; attempt < 5; attempt += 1) {
		assert.equal((await request(passwordUser, validBody("wrong-password"))).status, 401);
	}
	assert.equal((await request(passwordUser, validBody("wrong-password"))).status, 429);
	assert.equal(await lifecycle(passwordUser), "active");
});
