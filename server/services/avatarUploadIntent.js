const mongoose = require("mongoose");
const { randomUUID } = require("node:crypto");
const AvatarUploadIntent = require("../models/avatarUploadIntentModel");
const User = require("../models/userModel");
const AppError = require("../utils/appError");
const { fenceActiveAccountWrite } = require("../utils/accountLifecycle");
const { CLIENT_USER_FIELDS } = require("../utils/clientUser");

const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const extensions = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const transactionOptions = {
	readPreference: "primary", readConcern: { level: "snapshot" }, writeConcern: { w: "majority" },
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
async function reserveAvatarUpload(userId, { operationId, provider, contentType }) {
	if (!mongoose.isObjectIdOrHexString(userId) || typeof operationId !== "string" || !uuidPattern.test(operationId) ||
		!["cloudinary", "local"].includes(provider) || typeof contentType !== "string" || !Object.hasOwn(extensions, contentType)) {
		throw new AppError("Invalid avatar upload intent", 400);
	}
	const normalizedOperationId = operationId.toLowerCase();
	await AvatarUploadIntent.init();
	return mongoose.connection.transaction(async session => {
		await fenceActiveAccountWrite(userId, session);
		const existing = await AvatarUploadIntent.findOne({ user: userId, operationId: normalizedOperationId }).session(session);
		if (existing) {
			if (existing.provider !== provider || existing.contentType !== contentType) {
				throw new AppError("Avatar operation identity already used", 409);
			}
			return existing;
		}
		const name = `user_${String(userId).toLowerCase()}_${randomUUID()}`;
		const storageKey = provider === "cloudinary" ? `studyjony/avatars/${name}` : `${name}.${extensions[contentType]}`;
		const [intent] = await AvatarUploadIntent.create([{
			user: userId, operationId: normalizedOperationId, provider, contentType, storageKey,
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
			{ _id: intentId, user: userId, uploadStatus: "reserved", cleanupStatus: "none" },
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

async function recordCleanupResult(userId, intentId, generation, succeeded) {
	validateOwnerAndIntent(userId, intentId);
	if (!Number.isSafeInteger(generation) || generation < 1 || typeof succeeded !== "boolean") {
		throw new AppError("Invalid avatar cleanup result", 400);
	}
	const state = succeeded ? "complete" : "retry";
	const filter = { _id: intentId, user: userId, attachmentStatus: "unattached", cleanupStatus: "pending", cleanupGeneration: generation };
	// A missing asset is not final while an upload might still arrive later.
	if (succeeded) filter.uploadStatus = { $in: ["reserved", "finished"] };
	const updated = await AvatarUploadIntent.findOneAndUpdate(filter, { $set: { cleanupStatus: state } }, { returnDocument: "after" });
	if (updated) return updated;
	const intent = await ownedIntent(userId, intentId);
	if (intent.cleanupGeneration === generation && intent.cleanupStatus === state) return intent;
	throw new AppError("Invalid or stale avatar cleanup result", 409);
}

module.exports = { reserveAvatarUpload, beginAvatarUpload, recordUploadOutcome, attachAvatarUpload, queueAvatarCleanup, recordCleanupResult };
