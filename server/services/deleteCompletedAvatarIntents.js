const mongoose = require("mongoose");
const User = require("../models/userModel");
const Intent = require("../models/avatarUploadIntentModel");
const AppError = require("../utils/appError");

const DEFAULT_BATCH_SIZE = 100;
const MAX_BATCH_SIZE = 1000;
const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const transactionOptions = {
	readPreference: "primary", readConcern: { level: "snapshot" }, writeConcern: { w: "majority" },
};

function completedFilter(userId) {
	const name = `user_${userId}_${uuid}`;
	const validKeys = Object.entries({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" })
		.flatMap(([contentType, extension]) => [
			{ provider: "local", contentType, storageKey: new RegExp(`^${name}\\.${extension}$`) },
			{ provider: "cloudinary", contentType, storageKey: new RegExp(`^studyjony/avatars/${name}$`) },
		]);
	return {
		user: userId,
		uploadStatus: "finished", uploadResult: { $in: ["success", "failure"] },
		attachmentStatus: "unattached", cleanupStatus: "complete",
		cleanupClaimToken: { $exists: false },
		lastCleanupClaimToken: new RegExp(`^${uuid}$`, "i"),
		operationId: new RegExp(`^${uuid}$`, "i"),
		cleanupGeneration: { $type: "number", $gte: 1, $lte: Number.MAX_SAFE_INTEGER },
		$expr: { $and: [
			{ $eq: [{ $type: "$user" }, "objectId"] },
			...[
				"operationId", "provider", "contentType", "storageKey", "uploadStatus", "uploadResult",
				"attachmentStatus", "cleanupStatus", "lastCleanupClaimToken",
			].map(field => ({ $eq: [{ $type: `$${field}` }, "string"] })),
			{ $cond: [{ $isNumber: "$cleanupGeneration" }, { $eq: [{ $mod: ["$cleanupGeneration", 1] }, 0] }, false] },
		] },
		$or: validKeys,
	};
}

// Only remove records that prove the external cleanup finished. Other intents remain for reconciliation.
async function deleteCompletedAvatarIntents(userId, { batchSize = DEFAULT_BATCH_SIZE } = {}) {
	if (!mongoose.isObjectIdOrHexString(userId)) throw new AppError("Invalid account", 400);
	if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > MAX_BATCH_SIZE) {
		throw new AppError("Invalid avatar intent deletion batch size", 400);
	}
	const ownerId = new mongoose.Types.ObjectId(userId);
	return mongoose.connection.transaction(async session => {
		const user = await User.findById(ownerId).select("+lifecycleState +avatarIntent avatar").session(session).lean();
		if (!user) throw new AppError("Account not found", 404);
		if (user.lifecycleState !== "deleting") throw new AppError("Account is not deleting", 409);
		if (user.avatarIntent != null || (user.avatar != null && user.avatar !== "") ||
			await Intent.exists({ user: ownerId, attachmentStatus: "attached" }).session(session)) {
			return { deletedCount: 0, hasMore: false, blocked: "avatar_tracking_unresolved" };
		}

		const filter = completedFilter(ownerId);
		const candidates = await Intent.aggregate([
			{ $match: filter },
			{ $lookup: { from: User.collection.name, localField: "_id", foreignField: "avatarIntent", as: "references" } },
			{ $match: { references: { $eq: [] } } },
			// A legacy or inconsistent URL can reference a key without an avatarIntent link.
			{ $lookup: { from: User.collection.name, let: { key: "$storageKey" }, pipeline: [
				{ $match: { $expr: { $cond: [
					{ $eq: [{ $type: "$avatar" }, "string"] },
					{ $gte: [{ $indexOfBytes: ["$avatar", "$$key"] }, 0] }, false,
				] } } }, { $limit: 1 },
			], as: "urlReferences" } },
			{ $match: { urlReferences: { $eq: [] } } },
			{ $sort: { _id: 1 } }, { $limit: batchSize + 1 }, { $project: { _id: 1 } },
		]).session(session);
		const ids = candidates.slice(0, batchSize).map(({ _id }) => _id);
		if (!ids.length) return { deletedCount: 0, hasMore: false };
		const result = await Intent.deleteMany({ ...filter, _id: { $in: ids } }, { session });
		return { deletedCount: result.deletedCount, hasMore: candidates.length > batchSize };
	}, transactionOptions);
}

module.exports = { deleteCompletedAvatarIntents, DEFAULT_BATCH_SIZE, MAX_BATCH_SIZE };

