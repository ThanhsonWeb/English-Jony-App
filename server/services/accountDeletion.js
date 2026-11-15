const mongoose = require("mongoose");
const User = require("../models/userModel");
const AvatarUploadIntent = require("../models/avatarUploadIntentModel");
const AppError = require("../utils/appError");
const { activeAccountFilter } = require("../utils/accountLifecycle");
const { isValidStorageKey, avatarMatchesIntent } = require("./accountDeletionReadiness");

// Internal initiation only. Outstanding uploads and account data remain tracked.
async function initiateAccountDeletion(userId, { expectedPasswordHash } = {}) {
	if (!mongoose.isObjectIdOrHexString(userId)) throw new AppError("Invalid account", 400);
	return mongoose.connection.transaction(async session => {
		const user = await User.findById(userId).select("+lifecycleState +avatarIntent +password").session(session);
		if (!user) throw new AppError("Account not found", 404);
		if (expectedPasswordHash !== undefined &&
			(typeof expectedPasswordHash !== "string" || !expectedPasswordHash || user.password !== expectedPasswordHash)) {
			throw new AppError("Current password verification is no longer valid", 401);
		}
		if (user.lifecycleState === "deleting") {
			if (user.avatarIntent) throw new AppError("Deleting account still has a tracked avatar", 409);
			return { initiated: false };
		}
		if (user.lifecycleState !== "active") throw new AppError("Invalid account lifecycle state", 409);
		// Keep unresolved legacy avatars active so their owners can retry after reconciliation.
		if (!user.avatarIntent && user.avatar !== undefined && user.avatar !== "") {
			throw new AppError("Legacy avatar cannot be safely deleted", 409);
		}
		if (user.avatarIntent) {
			const tracked = await AvatarUploadIntent.findOne({
				_id: user.avatarIntent, user: userId, attachmentStatus: "attached", cleanupStatus: "none",
				uploadStatus: "finished", uploadResult: "success",
			}).session(session).lean();
			if (!tracked || !isValidStorageKey(tracked) || !avatarMatchesIntent(user.avatar, tracked)) {
				throw new AppError("Tracked avatar identity is inconsistent", 409);
			}
		}

		const update = { $set: { lifecycleState: "deleting" } };
		if (user.avatarIntent) {
			update.$set.avatar = "";
			update.$unset = { avatarIntent: 1 };
		}
		// This write serializes with all fenced account writes, including avatar attachment.
		const changed = await User.findOneAndUpdate({ _id: userId, ...activeAccountFilter() }, update,
			{ session, returnDocument: "after" });
		if (!changed) throw new AppError("Account state changed", 409);

		if (user.avatarIntent) {
			const detached = await AvatarUploadIntent.findOneAndUpdate({
				_id: user.avatarIntent, user: userId, attachmentStatus: "attached", cleanupStatus: "none",
				uploadStatus: "finished", uploadResult: "success",
			}, { $set: { attachmentStatus: "unattached", cleanupStatus: "pending" }, $inc: { cleanupGeneration: 1 } },
			{ session, returnDocument: "after" });
			if (!detached) throw new AppError("Tracked avatar cannot be safely detached", 409);
		}
		return { initiated: true };
	}, { readPreference: "primary", readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
}

module.exports = { initiateAccountDeletion };
