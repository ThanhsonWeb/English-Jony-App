const mongoose = require("mongoose");
const User = require("../models/userModel");
const AvatarUploadIntent = require("../models/avatarUploadIntentModel");
const DialogueAttempt = require("../models/dialogueAttemptModel");
const DialogueProgress = require("../models/dialogueProgressModel");
const StudyActivity = require("../models/studyActivityModel");
const Topic = require("../models/topicModel");
const Vocab = require("../models/vocabModel");
const VocabularyReviewEvent = require("../models/vocabularyReviewEventModel");
const XPEvent = require("../models/xpEventModel");
const AppError = require("../utils/appError");

const ownedRecordModels = {
	avatarUploadIntents: AvatarUploadIntent,
	dialogueAttempts: DialogueAttempt,
	dialogueProgress: DialogueProgress,
	studyActivities: StudyActivity,
	topics: Topic,
	vocabularies: Vocab,
	vocabularyReviewEvents: VocabularyReviewEvent,
	xpEvents: XPEvent,
};

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
async function readAccountDeletionReadiness(userId, session) {
	const userQuery = User.findById(userId).select("+lifecycleState +avatarIntent avatar").session(session);
	const user = await userQuery.lean();
	if (!user) throw new AppError("Account not found", 404);
	const intents = await AvatarUploadIntent.find({ user: userId }).session(session).lean();
	// Keep these reads sequential: MongoDB does not support parallel operations
	// on one transaction session. The snapshot keeps every count consistent.
	// The User row itself is the lifecycle tombstone and is intentionally not counted.
	const remainingCounts = {};
	for (const [key, Model] of Object.entries(ownedRecordModels)) {
		remainingCounts[key] = await Model.countDocuments({ user: userId }).session(session);
	}
	const blockers = new Set();
	if (user.lifecycleState !== "deleting") blockers.add("account_not_deleting");
	if (Object.values(remainingCounts).some(count => count > 0)) blockers.add("account_owned_data_remaining");

	const byId = new Map(intents.map(intent => [String(intent._id), intent]));
	const hasTrackedIntent = user.avatarIntent !== undefined && user.avatarIntent !== null;
	const trackedId = hasTrackedIntent && user.avatarIntent instanceof mongoose.Types.ObjectId
		? String(user.avatarIntent).toLowerCase()
		: null;
	if (hasTrackedIntent && trackedId === null) blockers.add("avatar_tracking_inconsistent");
	const avatarIsPresent = user.avatar !== undefined && user.avatar !== "";
	if (user.avatar !== undefined && typeof user.avatar !== "string") blockers.add("avatar_tracking_inconsistent");
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
	} else if (avatarIsPresent) {
		blockers.add("legacy_avatar_unresolved");
	}

	for (const intent of intents) {
		if (!isValidStorageKey(intent) || !["attached", "unattached"].includes(intent.attachmentStatus) ||
			!["none", "pending", "claimed", "retry", "complete"].includes(intent.cleanupStatus) ||
			!["reserved", "uploading", "uncertain", "finished"].includes(intent.uploadStatus) ||
			![null, undefined, "success", "failure", "unknown", "not_started"].includes(intent.uploadResult)) {
			blockers.add("avatar_tracking_inconsistent");
		}
		const notStartedReconciled = intent.uploadStatus === "finished" && intent.uploadResult === "not_started" &&
			intent.attachmentStatus === "unattached" && intent.cleanupStatus === "complete";
		if (["reserved", "uploading", "uncertain"].includes(intent.uploadStatus) ||
			(intent.uploadStatus === "finished" && !["success", "failure"].includes(intent.uploadResult) && !notStartedReconciled)) {
			blockers.add("avatar_upload_unfinished");
		}
		if ((intent.attachmentStatus === "attached" &&
			(intent.uploadStatus !== "finished" || intent.uploadResult !== "success" || intent.cleanupStatus !== "none")) ||
			(intent.uploadStatus === "uploading" && intent.cleanupStatus !== "pending") ||
			(intent.uploadStatus === "uncertain" && !["pending", "retry", "claimed"].includes(intent.cleanupStatus)) ||
			(intent.cleanupStatus === "complete" && intent.attachmentStatus !== "unattached") ||
			(intent.uploadResult === "not_started" && !notStartedReconciled)) {
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
	return { ready: ordered.length === 0, blockers: ordered, remainingCounts };
}

async function checkAccountDeletionReadiness(userId, { session } = {}) {
	if (!mongoose.isObjectIdOrHexString(userId)) throw new AppError("Invalid account", 400);
	if (session !== undefined && (!session || typeof session.inTransaction !== "function" || !session.inTransaction())) {
		throw new TypeError("The supplied readiness session must have an active transaction");
	}
	if (session) return readAccountDeletionReadiness(userId, session);
	return mongoose.connection.transaction(
		transactionSession => readAccountDeletionReadiness(userId, transactionSession),
		{ readPreference: "primary", readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } },
	);
}

module.exports = { checkAccountDeletionReadiness };
