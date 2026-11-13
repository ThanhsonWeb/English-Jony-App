const mongoose = require("mongoose");
const User = require("../models/userModel");
const Intent = require("../models/avatarUploadIntentModel");
const AppError = require("../utils/appError");

const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const uuidPattern = new RegExp(`^${uuid}$`, "i");
const extensions = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const transactionOptions = {
	readPreference: "primary", readConcern: { level: "snapshot" }, writeConcern: { w: "majority" },
};

function validStorageKey(intent, userId) {
	const extension = extensions[intent.contentType];
	if (!extension || typeof intent.storageKey !== "string") return false;
	const name = `user_${userId}_${uuid}`;
	return intent.provider === "local"
		? new RegExp(`^${name}\\.${extension}$`, "i").test(intent.storageKey)
		: intent.provider === "cloudinary" && typeof intent.cloudName === "string" && /^[a-zA-Z0-9_-]+$/.test(intent.cloudName) &&
			new RegExp(`^studyjony/avatars/${name}$`, "i").test(intent.storageKey);
}

function hasValidCleanupProof(intent, userId) {
	return intent.user instanceof mongoose.Types.ObjectId && String(intent.user).toLowerCase() === userId &&
		typeof intent.operationId === "string" && uuidPattern.test(intent.operationId) &&
		validStorageKey(intent, userId) && Number.isSafeInteger(intent.cleanupGeneration) && intent.cleanupGeneration >= 1 &&
		intent.cleanupStatus === "complete" && intent.attachmentStatus === "unattached" &&
		intent.cleanupClaimToken === undefined && typeof intent.lastCleanupClaimToken === "string" &&
		uuidPattern.test(intent.lastCleanupClaimToken);
}

function hasUnresolvedAvatar(user) {
	return (user.avatarIntent !== undefined && user.avatarIntent !== null) ||
		(user.avatar !== undefined && (typeof user.avatar !== "string" || user.avatar.trim() !== ""));
}

// A reserved intent is reconciled only after its completed cleanup claim is proven.
// The User fence serializes this transition with upload starts; this function never calls storage.
async function reconcileReservedAvatarIntent(userId, intentId) {
	if (!mongoose.isObjectIdOrHexString(userId) || !mongoose.isObjectIdOrHexString(intentId)) {
		throw new AppError("Invalid avatar intent", 400);
	}
	const ownerId = new mongoose.Types.ObjectId(userId);
	const ownerKey = String(ownerId).toLowerCase();
	return mongoose.connection.transaction(async session => {
		const user = await User.findOneAndUpdate({ _id: ownerId, lifecycleState: "deleting" },
			{ $inc: { accountWriteFence: 1 } },
			{ session, timestamps: false, returnDocument: "after" }).select("+lifecycleState +avatarIntent avatar").lean();
		if (!user) {
			if (!(await User.exists({ _id: ownerId }).session(session))) throw new AppError("Account not found", 404);
			throw new AppError("Account is not deleting", 409);
		}
		if (hasUnresolvedAvatar(user) || await Intent.exists({ user: ownerId, attachmentStatus: "attached" }).session(session)) {
			throw new AppError("Account avatar tracking is unresolved", 409);
		}

		const intent = await Intent.findOne({ _id: intentId, user: ownerId })
			.select("+cleanupClaimToken +lastCleanupClaimToken").session(session).lean();
		if (!intent) throw new AppError("Avatar intent not found", 404);
		if (!hasValidCleanupProof(intent, ownerKey)) throw new AppError("Avatar cleanup proof is incomplete or inconsistent", 409);

		const linkedUser = await User.exists({ avatarIntent: intentId }).session(session);
		const keyReference = await User.exists({ avatar: { $regex: intent.storageKey.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") } }).session(session);
		if (linkedUser || keyReference) throw new AppError("Avatar intent is still referenced", 409);

		if (intent.uploadStatus === "finished" && intent.uploadResult === "not_started") {
			return { reconciled: true };
		}
		if (intent.uploadStatus !== "reserved" || intent.uploadResult !== null) {
			throw new AppError("Avatar upload is not a reconciliable reservation", 409);
		}

		const updated = await Intent.findOneAndUpdate({
			_id: intentId, user: ownerId, uploadStatus: "reserved", uploadResult: null,
			attachmentStatus: "unattached", cleanupStatus: "complete", cleanupGeneration: intent.cleanupGeneration,
			cleanupClaimToken: { $exists: false }, lastCleanupClaimToken: intent.lastCleanupClaimToken,
		}, { $set: { uploadStatus: "finished", uploadResult: "not_started" } }, {
			session, returnDocument: "after", runValidators: true,
		});
		if (!updated) throw new AppError("Avatar reservation changed during reconciliation", 409);
		return { reconciled: true };
	}, transactionOptions);
}

module.exports = { reconcileReservedAvatarIntent };
