const crypto = require("node:crypto");

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

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
	const cloudName = config.CLOUDINARY_CLOUD_NAME;
	const apiKey = config.CLOUDINARY_API_KEY;
	const apiSecret = config.CLOUDINARY_API_SECRET;
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
	const expectedSignature = signParameters({ public_id: result.public_id, version: result.version }, apiSecret);
	const actualSignature = typeof result.signature === "string" ? result.signature : "";
	const url = new URL(result.secure_url);
	if (
		url.protocol !== "https:" ||
		url.hostname !== "res.cloudinary.com" ||
		!url.pathname.startsWith(`/${cloudName}/image/upload/`) ||
		actualSignature.length !== expectedSignature.length ||
		!crypto.timingSafeEqual(Buffer.from(actualSignature), Buffer.from(expectedSignature))
	) {
		throw new Error("Avatar storage returned an invalid response");
	}
	return result.secure_url;
}

module.exports = { AVATAR_TYPES, MAX_AVATAR_BYTES, isValidAvatar, uploadAvatar };
