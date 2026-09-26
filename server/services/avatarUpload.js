const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const localAvatarDirectory = path.resolve(__dirname, "../local-avatars");

function getCloudinaryConfig(config = process.env) {
	return {
		cloudName: config.CLOUDINARY_CLOUD_NAME?.trim(),
		apiKey: config.CLOUDINARY_API_KEY?.trim(),
		apiSecret: config.CLOUDINARY_API_SECRET?.trim(),
	};
}

function assertAvatarStorageConfigured(config = process.env) {
	if (config.NODE_ENV === "development") return;
	const { cloudName, apiKey, apiSecret } = getCloudinaryConfig(config);
	if (!cloudName || !apiKey || !apiSecret || !/^[a-zA-Z0-9_-]+$/.test(cloudName)) {
		throw new Error(
			"Production avatar uploads require CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET",
		);
	}
}

async function saveLocalAvatar(buffer, type, userId) {
	if (!/^[0-9a-f]{24}$/.test(String(userId))) throw new Error("Invalid user ID");
	const extension = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[type];
	const filename = `user_${userId}_${crypto.randomUUID()}.${extension}`;
	await fs.mkdir(localAvatarDirectory, { recursive: true });
	await fs.writeFile(path.join(localAvatarDirectory, filename), buffer, { flag: "wx" });
	return `/api/v1/users/avatar-files/${filename}`;
}

function isValidAvatar(buffer, type) {
	if (!Buffer.isBuffer(buffer) || !buffer.length || buffer.length > MAX_AVATAR_BYTES) return false;
	if (!AVATAR_TYPES.has(type)) return false;
	if (type === "image/jpeg") return buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
	if (type === "image/png") return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
	return buffer.subarray(0, 4).toString() === "RIFF" && buffer.subarray(8, 12).toString() === "WEBP";
}

function signParameters(parameters, secret) {
	const payload = Object.entries(parameters)
		.sort(([first], [second]) => first.localeCompare(second))
		.map(([key, value]) => `${key}=${value}`)
		.join("&");
	return crypto.createHash("sha1").update(payload + secret).digest("hex");
}

async function uploadAvatar(buffer, type, userId, config = process.env) {
	const { cloudName, apiKey, apiSecret } = getCloudinaryConfig(config);
	const hasAnyCloudinarySetting = Boolean(cloudName || apiKey || apiSecret);
	if (!hasAnyCloudinarySetting && config.NODE_ENV === "development") {
		return saveLocalAvatar(buffer, type, userId);
	}
	if (!cloudName || !apiKey || !apiSecret || !/^[a-zA-Z0-9_-]+$/.test(cloudName)) {
		throw new Error("Avatar storage is not configured");
	}

	const parameters = {
		folder: "studyjony/avatars",
		overwrite: "true",
		public_id: `user_${userId}`,
		timestamp: String(Math.floor(Date.now() / 1000)),
	};
	const form = new FormData();
	form.append("file", new Blob([buffer], { type }), "avatar");
	for (const [key, value] of Object.entries(parameters)) form.append(key, value);
	form.append("api_key", apiKey);
	form.append("signature", signParameters(parameters, apiSecret));

	const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
		method: "POST",
		body: form,
		signal: AbortSignal.timeout(20000),
	});
	if (!response.ok) throw new Error("Avatar storage rejected the upload");
	const result = await response.json();
	const expectedPublicId = `studyjony/avatars/user_${userId}`;
	const expectedSignature = signParameters({ public_id: result.public_id, version: result.version }, apiSecret);
	const actualSignature = typeof result.signature === "string" ? result.signature : "";
	const url = new URL(result.secure_url);
	if (
		url.protocol !== "https:" ||
		url.hostname !== "res.cloudinary.com" ||
		!url.pathname.startsWith(`/${cloudName}/image/upload/`) ||
		result.public_id !== expectedPublicId ||
		actualSignature.length !== expectedSignature.length ||
		!crypto.timingSafeEqual(Buffer.from(actualSignature), Buffer.from(expectedSignature))
	) {
		throw new Error("Avatar storage returned an invalid response");
	}
	return result.secure_url;
}

module.exports = {
	AVATAR_TYPES,
	MAX_AVATAR_BYTES,
	assertAvatarStorageConfigured,
	isValidAvatar,
	localAvatarDirectory,
	uploadAvatar,
};
