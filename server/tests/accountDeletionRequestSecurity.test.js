const assert = require("node:assert/strict");
const { before, after, beforeEach, test } = require("node:test");
const crypto = require("node:crypto");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const User = require("../models/userModel");
const Vocab = require("../models/vocabModel");
const VocabularyReviewEvent = require("../models/vocabularyReviewEventModel");
const AccountDeletionReceipt = require("../models/accountDeletionReceiptModel");
const { receiptIdForEmail } = require("../utils/accountDeletionReceipt");
const { coordinateAccountDeletion } = require("../services/accountDeletionCoordinator");
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

test("profile exposes password deletion eligibility separately from the public user projection", async () => {
	async function getProfile(user) {
		return fetch(`${base}/users/me`, {
			headers: { Origin: frontend, Cookie: `jwt=${tokenFor(user)}` },
		});
	}
	const passwordResponse = await getProfile(passwordUser);
	assert.equal(passwordResponse.status, 200);
	const passwordProfile = await passwordResponse.json();
	assert.equal(passwordProfile.data.accountCapabilities.canRequestPasswordAccountDeletion, true);
	assert.equal(passwordProfile.data.user.canRequestPasswordAccountDeletion, undefined);

	const googleResponse = await getProfile(googleUser);
	assert.equal(googleResponse.status, 200);
	const googleProfile = await googleResponse.json();
	assert.equal(googleProfile.data.accountCapabilities.canRequestPasswordAccountDeletion, false);
	assert.equal(googleProfile.data.user.canRequestPasswordAccountDeletion, undefined);
});

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

test("legacy-avatar deletion request is rejected while the account remains active", async () => {
	process.env.ACCOUNT_DELETION_REQUEST_ENABLED = "true";
	const legacyAvatar = "https://legacy.example.test/old-avatar.jpg";
	await User.updateOne({ _id: passwordUser._id }, { $set: { avatar: legacyAvatar } });

	const response = await request(passwordUser, validBody(password));
	assert.equal(response.status, 409);
	assert.equal(await lifecycle(passwordUser), "active");
	assert.equal((await User.findById(passwordUser.id)).avatar, legacyAvatar);
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
	const stub = t.mock.method(User, "exists", async () => {
		// Model a password change after the bcrypt check but during the final recheck.
		await User.updateOne({ _id: passwordUser._id }, { $set: { password: replacementHash } });
		return true;
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

test("password deletion request cleans learning data, finalizes with a receipt, and prevents later sign-in", async () => {
	const previousFlag = process.env.ACCOUNT_DELETION_REQUEST_ENABLED;
	const previousReceiptSecret = process.env.ACCOUNT_DELETION_RECEIPT_HMAC_SECRET;
	process.env.ACCOUNT_DELETION_REQUEST_ENABLED = "true";
	process.env.ACCOUNT_DELETION_RECEIPT_HMAC_SECRET = "account-deletion-test-secret-0123456789abcdef";
	try {
		const word = await Vocab.create({
			user: passwordUser.id,
			english: "temporary word",
			vietnamese: "từ tạm",
		});
		await VocabularyReviewEvent.create({
			_id: crypto.randomUUID(),
			user: passwordUser._id,
			word: word._id,
			inputHash: "a".repeat(64),
			correct: true,
			completedAt: new Date(),
		});

		const requestResponse = await request(passwordUser, validBody(password));
		assert.equal(requestResponse.status, 202);
		assert.equal(await lifecycle(passwordUser), "deleting");

		assert.deepEqual(await coordinateAccountDeletion(passwordUser.id), { status: "completed" });
		assert.equal(await User.findById(passwordUser.id), null);
		assert.equal(await Vocab.countDocuments({ user: passwordUser._id }), 0);
		assert.equal(await VocabularyReviewEvent.countDocuments({ user: passwordUser._id }), 0);

		const receipt = await AccountDeletionReceipt.findById(receiptIdForEmail(passwordUser.email)).lean();
		assert.ok(receipt);
		assert.ok(receipt.completedAt instanceof Date);
		assert.ok(receipt.expiresAt > receipt.completedAt);
		assert.deepEqual(Object.keys(receipt).sort(), ["_id", "completedAt", "expiresAt"]);

		const loginResponse = await fetch(`${base}/auth/login`, {
			method: "POST",
			headers: { "Content-Type": "application/json", Origin: frontend },
			body: JSON.stringify({ email: passwordUser.email, password }),
		});
		assert.equal(loginResponse.status, 401);
	} finally {
		if (previousFlag === undefined) delete process.env.ACCOUNT_DELETION_REQUEST_ENABLED;
		else process.env.ACCOUNT_DELETION_REQUEST_ENABLED = previousFlag;
		if (previousReceiptSecret === undefined) delete process.env.ACCOUNT_DELETION_RECEIPT_HMAC_SECRET;
		else process.env.ACCOUNT_DELETION_RECEIPT_HMAC_SECRET = previousReceiptSecret;
	}
});
