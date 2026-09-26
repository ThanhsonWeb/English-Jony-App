const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { isValidAvatar, uploadAvatar } = require("../services/avatarUpload");

const config = {
	CLOUDINARY_CLOUD_NAME: "studyjony-test",
	CLOUDINARY_API_KEY: "test-key",
	CLOUDINARY_API_SECRET: "test-secret",
};

test("avatar validation checks file signatures and size", () => {
	assert.equal(isValidAvatar(Buffer.from([0xff, 0xd8, 0xff, 0x00]), "image/jpeg"), true);
	assert.equal(isValidAvatar(Buffer.from([0xff, 0xd8, 0xff, 0x00]), "image/png"), false);
	assert.equal(isValidAvatar(Buffer.alloc(2 * 1024 * 1024 + 1), "image/jpeg"), false);
});

test("avatar upload signs the request and accepts only the signed storage URL", async () => {
	const originalFetch = global.fetch;
	const publicId = "studyjony/avatars/user_123";
	const version = 12345;
	const signature = crypto.createHash("sha1")
		.update(`public_id=${publicId}&version=${version}${config.CLOUDINARY_API_SECRET}`)
		.digest("hex");
	global.fetch = async (url, options) => {
		assert.equal(url, "https://api.cloudinary.com/v1_1/studyjony-test/image/upload");
		assert.equal(options.method, "POST");
		const form = options.body;
		assert.equal(form.get("public_id"), "user_123");
		assert.equal(form.get("folder"), "studyjony/avatars");
		assert.equal(form.get("api_key"), config.CLOUDINARY_API_KEY);
		const signed = `folder=studyjony/avatars&overwrite=true&public_id=user_123&timestamp=${form.get("timestamp")}${config.CLOUDINARY_API_SECRET}`;
		assert.equal(form.get("signature"), crypto.createHash("sha1").update(signed).digest("hex"));
		return {
			ok: true,
			json: async () => ({ public_id: publicId, version, signature, secure_url: `https://res.cloudinary.com/studyjony-test/image/upload/v${version}/${publicId}.jpg` }),
		};
	};
	try {
		const url = await uploadAvatar(Buffer.from([0xff, 0xd8, 0xff, 0x00]), "image/jpeg", "123", config);
		assert.equal(url, `https://res.cloudinary.com/studyjony-test/image/upload/v${version}/${publicId}.jpg`);
	} finally {
		global.fetch = originalFetch;
	}
});

test("avatar upload rejects an untrusted storage response", async () => {
	const originalFetch = global.fetch;
	global.fetch = async () => ({
		ok: true,
		json: async () => ({
			public_id: "studyjony/avatars/user_123",
			version: 12345,
			signature: "0".repeat(40),
			secure_url: "https://other.example/avatar.jpg",
		}),
	});
	try {
		await assert.rejects(
			uploadAvatar(Buffer.from([0xff, 0xd8, 0xff, 0x00]), "image/jpeg", "123", config),
			/invalid response/,
		);
	} finally {
		global.fetch = originalFetch;
	}
});
