const mongoose = require("mongoose");
const { randomUUID } = require("node:crypto");
const AvatarUploadIntent = require("../models/avatarUploadIntentModel");
const User = require("../models/userModel");
const AppError = require("../utils/appError");
const { fenceActiveAccountWrite } = require("../utils/accountLifecycle");
const { CLIENT_USER_FIELDS } = require("../utils/clientUser");

const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const cloudNamePattern = /^[a-zA-Z0-9_-]+$/;
const extensions = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const transactionOptions = {
	readPreference: "primary", readConcern: { level: "snapshot" }, writeConcern: { w: "majority" },
};
const cleanupSafeUpload = {
	$or: [
		{ uploadStatus: "reserved", uploadResult: null },
		{ uploadStatus: "finished", uploadResult: { $in: ["success", "failure"] } },
	],
};

function validateOwnerAndIntent(userId, intentId) {
	if (!mongoose.isObjectIdOrHexString(userId) || !mongoose.isObjectIdOrHexString(intentId)) {
		throw new AppError("Invalid avatar intent", 400);
	}
}

async function ownedIntent(userId, intentId, session) {
	const query = AvatarUploadIntent.findOne({ _id: intentId, user: userId });
	if (session) query.session(session);
	const intent = await query;
	if (!intent) throw new AppError("Avatar intent not found", 404);
	return intent;
}

// operationId is a stable server-generated UUID retained by the caller for retries.
async function reserveAvatarUpload(userId, { operationId, provider, contentType, cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim() }) {
	if (!mongoose.isObjectIdOrHexString(userId) || typeof operationId !== "string" || !uuidPattern.test(operationId) ||
		!["cloudinary", "local"].includes(provider) || typeof contentType !== "string" || !Object.hasOwn(extensions, contentType) ||
		(provider === "cloudinary" && (typeof cloudName !== "string" || !cloudNamePattern.test(cloudName)))) {
		throw new AppError("Invalid avatar upload intent", 400);
	}
	const storageCloudName = provider === "cloudinary" ? cloudName : undefined;
	const normalizedOperationId = operationId.toLowerCase();
	await AvatarUploadIntent.init();
	return mongoose.connection.transaction(async session => {
		await fenceActiveAccountWrite(userId, session);
		const existing = await AvatarUploadIntent.findOne({ user: userId, operationId: normalizedOperationId }).session(session);
		if (existing) {
			if (existing.provider !== provider || existing.contentType !== contentType || existing.cloudName !== storageCloudName) {
				throw new AppError("Avatar operation identity already used", 409);
			}
			return existing;
		}
		const name = `user_${String(userId).toLowerCase()}_${randomUUID()}`;
		const storageKey = provider === "cloudinary" ? `studyjony/avatars/${name}` : `${name}.${extensions[contentType]}`;
		const [intent] = await AvatarUploadIntent.create([{
			user: userId, operationId: normalizedOperationId, provider, cloudName: storageCloudName, contentType, storageKey,
		}], { session });
		return intent;
	}, transactionOptions);
}

// Only the successful claimant may initiate external upload work.
async function beginAvatarUpload(userId, intentId) {
	validateOwnerAndIntent(userId, intentId);
	return mongoose.connection.transaction(async session => {
		await fenceActiveAccountWrite(userId, session);
		const claimed = await AvatarUploadIntent.findOneAndUpdate(
			{ _id: intentId, user: userId, uploadStatus: "reserved", cleanupStatus: "none",
				$or: [{ provider: "local" }, { provider: "cloudinary", cloudName: { $type: "string", $regex: /^[a-zA-Z0-9_-]+$/ } }],
			},
			{ $set: { uploadStatus: "uploading", cleanupStatus: "pending" }, $inc: { cleanupGeneration: 1 } },
			{ session, returnDocument: "after" },
		);
		if (claimed) return { claimed: true, intent: claimed };
		return { claimed: false, intent: await ownedIntent(userId, intentId, session) };
	}, transactionOptions);
}

// Terminal outcomes require definitive evidence that no upload can still complete.
async function recordUploadOutcome(userId, intentId, outcome) {
	validateOwnerAndIntent(userId, intentId);
	if (!["uncertain", "success", "failure"].includes(outcome)) throw new AppError("Invalid avatar upload outcome", 400);
	const status = outcome === "uncertain" ? "uncertain" : "finished";
	const result = outcome === "uncertain" ? "unknown" : outcome;
	const allowed = outcome === "uncertain" ? ["uploading"] : ["uploading", "uncertain"];
	const updated = await AvatarUploadIntent.findOneAndUpdate(
		{ _id: intentId, user: userId, uploadStatus: { $in: allowed }, attachmentStatus: "unattached" },
		{ $set: { uploadStatus: status, uploadResult: result } }, { returnDocument: "after" },
	);
	if (updated) return updated;
	const intent = await ownedIntent(userId, intentId);
	if (intent.uploadStatus === status && intent.uploadResult === result && intent.attachmentStatus === "unattached") return intent;
	throw new AppError("Invalid avatar upload transition", 409);
}

// Store the new URL and change both managed intent records in one fenced transaction.
async function attachAvatarUpload(userId, intentId, avatar) {
	validateOwnerAndIntent(userId, intentId);
	return mongoose.connection.transaction(async session => {
		await fenceActiveAccountWrite(userId, session);
		const current = await User.findById(userId).select("+avatarIntent").session(session);
		if (current?.avatarIntent == null && current?.avatar !== undefined && current.avatar !== "") {
			throw new AppError("Existing avatar has no tracked cleanup intent", 409);
		}
		const intent = await AvatarUploadIntent.findOneAndUpdate(
			{ _id: intentId, user: userId, uploadStatus: "uploading", attachmentStatus: "unattached", cleanupStatus: "pending" },
			{ $set: { uploadStatus: "finished", uploadResult: "success", attachmentStatus: "attached", cleanupStatus: "none" } },
			{ session, returnDocument: "after" },
		);
		if (!intent) throw new AppError("Invalid avatar attachment", 409);
		if (current.avatarIntent) {
			const previous = await AvatarUploadIntent.findOneAndUpdate(
				{ _id: current.avatarIntent, user: userId, attachmentStatus: "attached", cleanupStatus: "none" },
				{ $set: { attachmentStatus: "unattached", cleanupStatus: "pending" }, $inc: { cleanupGeneration: 1 } },
				{ session, returnDocument: "after" },
			);
			if (!previous) throw new AppError("Previous avatar intent not found", 409);
		}
		return User.findByIdAndUpdate(userId, { avatar, avatarIntent: intentId }, {
			returnDocument: "after", runValidators: true, session,
		}).select(CLIENT_USER_FIELDS);
	}, transactionOptions);
}

async function queueAvatarCleanup(userId, intentId) {
	validateOwnerAndIntent(userId, intentId);
	const updated = await AvatarUploadIntent.findOneAndUpdate(
		{ _id: intentId, user: userId, attachmentStatus: "unattached", cleanupStatus: { $in: ["none", "retry"] } },
		{ $set: { cleanupStatus: "pending" }, $inc: { cleanupGeneration: 1 } }, { returnDocument: "after" },
	);
	if (updated) return updated;
	const intent = await ownedIntent(userId, intentId);
	if (intent.attachmentStatus === "attached") throw new AppError("Avatar is still attached", 409);
	return intent;
}

// Claims do not expire automatically: an old worker might still be deleting.
async function claimAvatarCleanup(userId, intentId) {
	validateOwnerAndIntent(userId, intentId);
	const claimToken = randomUUID();
	return mongoose.connection.transaction(async session => {
		const claimed = await AvatarUploadIntent.findOneAndUpdate(
			{ _id: intentId, user: userId, attachmentStatus: "unattached", ...cleanupSafeUpload, cleanupStatus: "pending" },
			{ $set: { cleanupStatus: "claimed", cleanupClaimToken: claimToken } },
			{ session, returnDocument: "after" },
		);
		if (claimed) return { claimed: true, intent: claimed, claimToken };
		return { claimed: false, intent: await ownedIntent(userId, intentId, session) };
	}, transactionOptions);
}

async function recordCleanupResult(userId, intentId, generation, claimToken, succeeded) {
	validateOwnerAndIntent(userId, intentId);
	if (!Number.isSafeInteger(generation) || generation < 1 || typeof claimToken !== "string" ||
		!uuidPattern.test(claimToken) || typeof succeeded !== "boolean") {
		throw new AppError("Invalid avatar cleanup result", 400);
	}
	const state = succeeded ? "complete" : "retry";
	const filter = { _id: intentId, user: userId, attachmentStatus: "unattached", ...cleanupSafeUpload,
		cleanupStatus: "claimed", cleanupGeneration: generation, cleanupClaimToken: claimToken };
	const updated = await AvatarUploadIntent.findOneAndUpdate(filter,
		{ $set: { cleanupStatus: state, lastCleanupClaimToken: claimToken }, $unset: { cleanupClaimToken: 1 } },
		{ returnDocument: "after", writeConcern: { w: "majority" } });
	if (updated) return updated;
	const intent = await AvatarUploadIntent.findOne({ _id: intentId, user: userId }).select("+lastCleanupClaimToken");
	if (!intent) throw new AppError("Avatar intent not found", 404);
	if (intent.cleanupGeneration === generation && intent.cleanupStatus === state && intent.lastCleanupClaimToken === claimToken) return intent;
	throw new AppError("Invalid or stale avatar cleanup result", 409);
}

module.exports = { reserveAvatarUpload, beginAvatarUpload, recordUploadOutcome, attachAvatarUpload, queueAvatarCleanup, claimAvatarCleanup, recordCleanupResult };
