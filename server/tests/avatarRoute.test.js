const { before, after, test } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const cookieParser = require("cookie-parser");
const User = require("../models/userModel");
const userRoutes = require("../routes/userRoutes");

let replicaSet;
let server;
let baseUrl;
let user;
const originalSecret = process.env.JWT_SECRET;
const originalCloudinary = Object.fromEntries(
	["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"]
		.map((key) => [key, process.env[key]]),
);

before(async () => {
	process.env.JWT_SECRET = "isolated-avatar-route-test-secret";
	replicaSet = await MongoMemoryReplSet.create({ binary: { version: "7.0.14" }, replSet: { count: 1 } });
	await mongoose.connect(replicaSet.getUri(), { dbName: "avatar_route_test" });
	user = await User.create({ name: "Avatar Learner", email: "avatar@example.com", googleId: "avatar-test", photo: "https://google.example/photo.jpg" });
	const app = express();
	app.use(cookieParser());
	app.use(express.json());
	app.use("/api/v1/users", userRoutes);
	app.use((error, req, res, next) => res.status(error.statusCode || 500).json({ message: error.message }));
	server = await new Promise(resolve => {
		const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
	});
	baseUrl = `http://127.0.0.1:${server.address().port}/api/v1/users/avatar`;
}, { timeout: 180000 });

after(async () => {
	if (server) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
	await mongoose.disconnect();
	await replicaSet?.stop();
	if (originalSecret === undefined) delete process.env.JWT_SECRET;
	else process.env.JWT_SECRET = originalSecret;
});

test("avatar route requires a user and stores only the verified URL", async () => {
	const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: "1h" });
	const bytes = Buffer.from([0xff, 0xd8, 0xff, 0x00]);
	const unauthorized = await fetch(baseUrl, { method: "PATCH", headers: { "Content-Type": "image/jpeg" }, body: bytes });
	assert.equal(unauthorized.status, 401);

	const invalid = await fetch(baseUrl, { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "image/jpeg" }, body: Buffer.from("not an image") });
	assert.equal(invalid.status, 400);

	const originalFetch = global.fetch;
	const publicId = `studyjony/avatars/user_${user.id}`;
	const version = 12345;
	const signature = crypto.createHash("sha1").update(`public_id=${publicId}&version=${version}test-secret`).digest("hex");
	const url = `https://res.cloudinary.com/studyjony-test/image/upload/v${version}/${publicId}.jpg`;
	process.env.CLOUDINARY_CLOUD_NAME = "studyjony-test";
	process.env.CLOUDINARY_API_KEY = "test-key";
	process.env.CLOUDINARY_API_SECRET = "test-secret";
	global.fetch = (input, options) => String(input).startsWith("https://api.cloudinary.com/")
		? Promise.resolve({ ok: true, json: async () => ({ public_id: publicId, version, signature, secure_url: url }) })
		: originalFetch(input, options);
	try {
		const response = await fetch(baseUrl, { method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "image/jpeg" }, body: bytes });
		assert.equal(response.status, 200);
		assert.equal((await response.json()).data.user.avatar, url);
		const saved = await User.findById(user.id).lean();
		assert.equal(saved.avatar, url);
		assert.equal(saved.photo, "https://google.example/photo.jpg");
	} finally {
		global.fetch = originalFetch;
		for (const [key, value] of Object.entries(originalCloudinary)) {
			if (value === undefined) delete process.env[key];
			else process.env[key] = value;
		}
	}
});
