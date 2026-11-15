const mongoose = require("mongoose");
const User = require("../models/userModel");
const VocabularyReviewEvent = require("../models/vocabularyReviewEventModel");
const AppError = require("../utils/appError");

const transactionOptions = {
	readPreference: "primary",
	readConcern: { level: "snapshot" },
	writeConcern: { w: "majority" },
};

// Internal, idempotent account-deletion step. Other collections are handled separately.
async function deleteVocabularyReviewEvents(userId) {
	if (!mongoose.isObjectIdOrHexString(userId)) throw new AppError("Invalid account", 400);
	return mongoose.connection.transaction(async session => {
		const user = await User.findById(userId).select("+lifecycleState").session(session).lean();
		if (!user) throw new AppError("Account not found", 404);
		if (user.lifecycleState !== "deleting") throw new AppError("Account is not deleting", 409);

		const result = await VocabularyReviewEvent.deleteMany({ user: userId }, { session });
		return { deletedCount: result.deletedCount };
	}, transactionOptions);
}

module.exports = { deleteVocabularyReviewEvents };
