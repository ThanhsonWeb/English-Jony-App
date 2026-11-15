const mongoose = require("mongoose");
const User = require("../models/userModel");
const AppError = require("../utils/appError");
const reviewEvents = require("./deleteVocabularyReviewEvents");
const vocabularies = require("./deleteVocabularies");
const topics = require("./deleteTopics");
const dialogueProgress = require("./deleteDialogueProgress");
const studyActivities = require("./deleteStudyActivities");
const xpEvents = require("./deleteXpEvents");
const dialogueAttempts = require("./deleteDialogueAttempts");
const avatarIntents = require("./deleteCompletedAvatarIntents");
const readiness = require("./accountDeletionReadiness");
const finalization = require("./finalizeAccountDeletion");

const cleanupSteps = [
	["vocabularyReviewEvents", userId => reviewEvents.deleteVocabularyReviewEvents(userId)],
	["vocabularies", userId => vocabularies.deleteVocabularies(userId)],
	["topics", userId => topics.deleteTopics(userId)],
	["dialogueProgress", userId => dialogueProgress.deleteDialogueProgress(userId)],
	["studyActivities", userId => studyActivities.deleteStudyActivities(userId)],
	["xpEvents", userId => xpEvents.deleteXpEvents(userId)],
	["dialogueAttempts", userId => dialogueAttempts.deleteDialogueAttempts(userId)],
	["avatarIntents", userId => avatarIntents.deleteCompletedAvatarIntents(userId)],
];

// Internal orchestration only. Storage cleanup remains with its dedicated worker.
async function coordinateAccountDeletion(userId) {
	if (!mongoose.isObjectIdOrHexString(userId)) throw new AppError("Invalid account", 400);
	const user = await User.findById(userId).select("+lifecycleState").lean();
	if (!user) throw new AppError("Account not found", 404);
	if (user.lifecycleState !== "deleting") throw new AppError("Account is not deleting", 409);

	for (const [step, run] of cleanupSteps) {
		// Let transactional/idempotent step errors propagate so a later invocation can retry.
		const result = await run(userId);
		if (result?.blocked) return { status: "blocked", step, reason: result.blocked };
		if (result?.hasMore) return { status: "in_progress", step };
	}

	const currentReadiness = await readiness.checkAccountDeletionReadiness(userId);
	if (!currentReadiness.ready) {
		return {
			status: "blocked",
			blockers: currentReadiness.blockers,
			remainingCounts: currentReadiness.remainingCounts,
		};
	}

	// The finalizer repeats preflight/readiness in its own transaction to close races.
	await finalization.finalizeAccountDeletion(userId);
	return { status: "completed" };
}

module.exports = { coordinateAccountDeletion };
