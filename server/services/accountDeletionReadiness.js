const mongoose = require("mongoose");
const User = require("../models/userModel");
const AvatarUploadIntent = require("../models/avatarUploadIntentModel");
const AppError = require("../utils/appError");

const extensions = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";

function isValidStorageKey(intent) {
	const userId = String(intent.user);
	const extension = extensions[intent.contentType];
	if (!/^[0-9a-f]{24}$/.test(userId) || !extension || typeof intent.storageKey !== "string") return false;
	const name = `user_${userId}_${uuid}`;
	return intent.provider === "local"
		? new RegExp(`^${name}\\.${extension}$`).test(intent.storageKey)
		: intent.provider === "cloudinary" && new RegExp(`^studyjony/avatars/${name}$`).test(intent.storageKey);
}

function avatarMatchesIntent(avatar, intent) {
	if (typeof avatar !== "string" || !avatar) return false;
	if (intent.provider === "local") return avatar === `/api/v1/users/avatar-files/${intent.storageKey}`;
	try {
		const url = new URL(avatar);
		const extension = extensions[intent.contentType];
		const match = url.pathname.match(/^\/[^/]+\/image\/upload\/v[1-9][0-9]*\/(.+)$/);
		return url.protocol === "https:" && url.hostname === "res.cloudinary.com" && !url.port && !url.username && !url.password &&
			!url.search && !url.hash && Boolean(match) && match[1] === `${intent.storageKey}.${extension}`;
	} catch { return false; }
}

// Read a consistent snapshot. This service reports readiness only; it performs no writes.
async function checkAccountDeletionReadiness(userId) {
	if (!mongoose.isObjectIdOrHexString(userId)) throw new AppError("Invalid account", 400);
	return mongoose.connection.transaction(async session => {
		const user = await User.findById(userId).select("+lifecycleState +avatarIntent avatar").session(session).lean();
		if (!user) throw new AppError("Account not found", 404);
		const intents = await AvatarUploadIntent.find({ user: userId }).session(session).lean();
		const blockers = new Set();
		if (user.lifecycleState !== "deleting") blockers.add("account_not_deleting");

		const byId = new Map(intents.map(intent => [String(intent._id), intent]));
		const trackedId = user.avatarIntent ? String(user.avatarIntent) : null;
		if (trackedId && !mongoose.isObjectIdOrHexString(trackedId)) blockers.add("avatar_tracking_inconsistent");
		const attached = intents.filter(intent => intent.attachmentStatus === "attached");
		if (attached.length > 1 || attached.some(intent => String(intent._id) !== trackedId)) {
			blockers.add("avatar_tracking_inconsistent");
		}
		if (trackedId) {
			const current = byId.get(trackedId);
			if (!current || String(current.user) !== String(userId).toLowerCase() || current.attachmentStatus !== "attached" ||
				current.cleanupStatus !== "none" || current.uploadStatus !== "finished" || current.uploadResult !== "success" ||
				!isValidStorageKey(current) || !avatarMatchesIntent(user.avatar, current)) {
				blockers.add("avatar_tracking_inconsistent");
			}
		} else if (typeof user.avatar === "string" && user.avatar.trim()) {
			blockers.add("legacy_avatar_unresolved");
		}

		for (const intent of intents) {
			if (!isValidStorageKey(intent) || !["attached", "unattached"].includes(intent.attachmentStatus) ||
				!["none", "pending", "claimed", "retry", "complete"].includes(intent.cleanupStatus) ||
				!["reserved", "uploading", "uncertain", "finished"].includes(intent.uploadStatus) ||
				![null, undefined, "success", "failure", "unknown"].includes(intent.uploadResult)) {
				blockers.add("avatar_tracking_inconsistent");
			}
			if (["reserved", "uploading", "uncertain"].includes(intent.uploadStatus) ||
				(intent.uploadStatus === "finished" && !["success", "failure"].includes(intent.uploadResult))) {
				blockers.add("avatar_upload_unfinished");
			}
			if ((intent.attachmentStatus === "attached" &&
				(intent.uploadStatus !== "finished" || intent.uploadResult !== "success" || intent.cleanupStatus !== "none")) ||
				(intent.uploadStatus === "uploading" && intent.cleanupStatus !== "pending") ||
				(intent.uploadStatus === "uncertain" && !["pending", "retry", "claimed"].includes(intent.cleanupStatus)) ||
				(intent.cleanupStatus === "complete" && intent.attachmentStatus !== "unattached")) {
				blockers.add("avatar_tracking_inconsistent");
			}
			if (["pending", "retry"].includes(intent.cleanupStatus)) blockers.add("avatar_cleanup_pending");
			if (intent.cleanupStatus === "claimed") blockers.add("avatar_cleanup_claim_held");
			if (intent.attachmentStatus === "unattached" && intent.uploadStatus === "finished" &&
				["success", "failure"].includes(intent.uploadResult) && intent.cleanupStatus === "none") {
				blockers.add("avatar_tracking_inconsistent");
			}
		}

		const ordered = [...blockers].sort();
		return { ready: ordered.length === 0, blockers: ordered };
	}, { readPreference: "primary", readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
}

module.exports = { checkAccountDeletionReadiness };
