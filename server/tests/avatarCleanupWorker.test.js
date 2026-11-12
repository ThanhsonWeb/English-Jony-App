const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { test } = require("node:test");
const { deleteStoredAvatar } = require("../services/avatarCleanupWorker");

const user = "0123456789abcdef01234567";
const name = `user_${user}_${randomUUID()}`;
const cloud = { user, provider: "cloudinary", contentType: "image/jpeg", storageKey: `studyjony/avatars/${name}` };
const local = { user, provider: "local", contentType: "image/png", storageKey: `${name}.png` };
const config = { CLOUDINARY_CLOUD_NAME: "test", CLOUDINARY_API_KEY: "key", CLOUDINARY_API_SECRET: "secret" };

test("Cloudinary destroy is signed and accepts ok and not found", async () => {
	for (const result of ["ok", "not found"]) {
		await deleteStoredAvatar(cloud, { config, fetchImpl: async (url, request) => {
			assert.equal(url, "https://api.cloudinary.com/v1_1/test/image/destroy");
			assert.equal(request.body.get("public_id"), cloud.storageKey);
			assert.match(request.body.get("signature"), /^[a-f0-9]{40}$/);
			return { ok: true, json: async () => ({ result }) };
		} });
	}
});

test("Cloudinary ambiguous results retain the claim and explicit rejections can retry", async () => {
	for (const fetchImpl of [async () => { throw new Error("timeout"); },
		async () => ({ ok: true, json: async () => ({ result: "unexpected" }) }),
		async () => ({ ok: false, status: 500 })]) {
		await assert.rejects(deleteStoredAvatar(cloud, { config, fetchImpl }), error => !error.safeToRetry);
	}
	await assert.rejects(deleteStoredAvatar(cloud, { config, fetchImpl: async () => ({ ok: false, status: 429 }) }),
		error => error.safeToRetry === true);
});

test("local deletion handles missing files and rejects forged keys", async () => {
	let target;
	await deleteStoredAvatar(local, { unlink: async value => { target = value; } });
	assert.ok(target.endsWith(local.storageKey));
	await deleteStoredAvatar(local, { unlink: async () => { const error = new Error(); error.code = "ENOENT"; throw error; } });
	await assert.rejects(deleteStoredAvatar({ ...local, storageKey: "../other.png" }, { unlink: async () => assert.fail() }));
	await assert.rejects(deleteStoredAvatar({ ...cloud, user: "ffffffffffffffffffffffff" }, { config, fetchImpl: async () => assert.fail() }));
});
