const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const Intent = require("../models/avatarUploadIntentModel");
const User = require("../models/userModel");
const { localAvatarDirectory } = require("./avatarUpload");
const { claimAvatarCleanup, queueAvatarCleanup, recordCleanupResult, deletingAvatarCleanupAccountExpr } = require("./avatarUploadIntent");
const cloudNamePattern = /^[a-zA-Z0-9_-]+$/;

// Never derive deletion targets from URLs or accept arbitrary paths, even from the database.
function validKey(intent) {
	const user = String(intent.user);
	const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
	const ext = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[intent.contentType];
	if (!/^[0-9a-f]{24}$/.test(user) || !ext || typeof intent.storageKey !== "string") return false;
	const name = `user_${user}_${uuid}`;
	if (intent.provider === "local") return new RegExp(`^${name}\\.${ext}$`).test(intent.storageKey);
	return intent.provider === "cloudinary" && typeof intent.cloudName === "string" && cloudNamePattern.test(intent.cloudName) &&
		new RegExp(`^studyjony/avatars/${name}$`).test(intent.storageKey);
}

async function deleteStoredAvatar(intent, { config = process.env, fetchImpl = fetch, unlink = fs.unlink } = {}) {
	if (intent.provider === "cloudinary" && (typeof intent.cloudName !== "string" || !cloudNamePattern.test(intent.cloudName))) {
		throw new Error("Cloudinary account identity is not verified");
	}
	if (!validKey(intent)) { const error = new Error("Invalid tracked avatar storage key"); error.safeToRetry = true; throw error; }
	if (intent.provider === "local") {
		try { await unlink(path.join(localAvatarDirectory, intent.storageKey)); }
		catch (error) { if (error.code !== "ENOENT") { error.safeToRetry = true; throw error; } }
		return;
	}
	const cloud = config.CLOUDINARY_CLOUD_NAME?.trim();
	const key = config.CLOUDINARY_API_KEY?.trim();
	const secret = config.CLOUDINARY_API_SECRET?.trim();
	if (!cloud || !/^[a-zA-Z0-9_-]+$/.test(cloud) || !key || !secret) {
		const error = new Error("Cloudinary is not configured"); error.safeToRetry = true; throw error;
	}
	if (intent.cloudName !== cloud) {
		const error = new Error("Cloudinary account identity does not match cleanup configuration");
		error.safeToRetry = true;
		throw error;
	}
	const timestamp = String(Math.floor(Date.now() / 1000));
	const signature = crypto.createHash("sha1").update(`public_id=${intent.storageKey}&timestamp=${timestamp}${secret}`).digest("hex");
	const body = new URLSearchParams({ public_id: intent.storageKey, timestamp, api_key: key, signature });
	const response = await fetchImpl(`https://api.cloudinary.com/v1_1/${cloud}/image/destroy`, {
		method: "POST", body, signal: AbortSignal.timeout(20000),
	});
	if (!response.ok) {
		const error = new Error("Cloudinary deletion failed");
		// Explicit authentication and rate-limit rejections did not start a deletion.
		error.safeToRetry = [401, 403, 429].includes(response.status);
		throw error;
	}
	const result = await response.json();
	if (!result || !["ok", "not found"].includes(result.result)) throw new Error("Unverified Cloudinary deletion response");
}

// Ambiguous provider outcomes retain the claim; they never expire automatically.
async function performClaim(claim, options) {
	let succeeded = false;
	try { await deleteStoredAvatar(claim.intent, options); succeeded = true; }
	catch (error) { if (!error.safeToRetry) return "held"; }
	await recordCleanupResult(claim.intent.user, claim.intent._id, claim.intent.cleanupGeneration, claim.claimToken, succeeded);
	return succeeded ? "complete" : "retry";
}

async function runAvatarCleanupBatch({ limit = 100, allowLocal = false, deletingOnly = false, ...options } = {}) {
	if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000) throw new Error("Invalid cleanup batch limit");
	if (typeof deletingOnly !== "boolean") throw new TypeError("Invalid cleanup scope");
	const candidateFilter = { cleanupStatus: { $in: ["pending", "retry"] }, attachmentStatus: "unattached",
		provider: allowLocal ? { $in: ["cloudinary", "local"] } : "cloudinary",
		$or: [{ uploadStatus: "reserved", uploadResult: null }, { uploadStatus: "finished", uploadResult: { $in: ["success", "failure"] } }],
	};
	let candidates;
	if (deletingOnly) {
		// Filter before the limit so active and legacy accounts cannot starve deleting accounts.
		candidates = await Intent.aggregate([
			{ $match: { ...candidateFilter, cleanupGeneration: { $gte: 1 } } },
			{ $sort: { updatedAt: 1, _id: 1 } },
			{ $lookup: { from: User.collection.name, let: { ownerId: "$user" }, pipeline: [
				{ $match: { $expr: { $and: [{ $eq: ["$_id", "$$ownerId"] }, deletingAvatarCleanupAccountExpr()] } } },
				{ $project: { _id: 1 } },
			], as: "eligibleOwner" } },
			{ $match: { "eligibleOwner.0": { $exists: true } } },
			{ $limit: limit },
			{ $project: { _id: 1, user: 1, cleanupStatus: 1 } },
		]);
	} else {
		candidates = await Intent.find(candidateFilter).sort({ updatedAt: 1, _id: 1 }).limit(limit).lean();
	}
	const counts = { complete: 0, retry: 0, held: 0, skipped: 0 };
	for (const candidate of candidates) {
		if (!deletingOnly && candidate.cleanupStatus === "retry") await queueAvatarCleanup(candidate.user, candidate._id);
		const claim = await claimAvatarCleanup(candidate.user, candidate._id, { deletingOnly });
		if (!claim.claimed) { counts.skipped++; continue; }
		counts[await performClaim(claim, options)]++;
	}
	return counts;
}

// Only call after an operator has fenced every old worker and established that
// no old storage request can still execute. There is deliberately no TTL.
async function recoverAvatarCleanup(userId, intentId, options) {
	const intent = await Intent.findOne({ _id: intentId, user: userId, cleanupStatus: "claimed", attachmentStatus: "unattached",
		$or: [{ uploadStatus: "reserved", uploadResult: null }, { uploadStatus: "finished", uploadResult: { $in: ["success", "failure"] } }],
	}).select("+cleanupClaimToken");
	if (!intent || !intent.cleanupClaimToken) throw new Error("Recoverable claim not found");
	if (intent.provider === "local" && !options?.allowLocal) throw new Error("Local cleanup requires the upload host");
	return performClaim({ intent, claimToken: intent.cleanupClaimToken }, options);
}

module.exports = { deleteStoredAvatar, runAvatarCleanupBatch, recoverAvatarCleanup };
