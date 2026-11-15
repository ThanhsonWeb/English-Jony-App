const mongoose = require("mongoose");
const User = require("../models/userModel");
const Vocab = require("../models/vocabModel");
const VocabularyReviewEvent = require("../models/vocabularyReviewEventModel");
const AppError = require("../utils/appError");

const transactionOptions = {
	readPreference: "primary",
	readConcern: { level: "snapshot" },
	writeConcern: { w: "majority" },
};
const DEFAULT_BATCH_SIZE = 100;
const MAX_BATCH_SIZE = 1000;

// Delete at most one batch. Call again while hasMore is true; other records are untouched.
async function deleteVocabularies(userId, { batchSize = DEFAULT_BATCH_SIZE } = {}) {
	if (!mongoose.isObjectIdOrHexString(userId)) throw new AppError("Invalid account", 400);
	if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > MAX_BATCH_SIZE) {
		throw new AppError("Invalid vocabulary deletion batch size", 400);
	}
	return mongoose.connection.transaction(async session => {
		const user = await User.findById(userId).select("+lifecycleState").session(session).lean();
		if (!user) throw new AppError("Account not found", 404);
		if (user.lifecycleState !== "deleting") throw new AppError("Account is not deleting", 409);

		const reviewReceiptsRemain = await VocabularyReviewEvent.exists({ user: userId }).session(session);
		if (reviewReceiptsRemain) throw new AppError("Vocabulary review receipts must be removed first", 409);

		const batch = await Vocab.find({ user: userId }).select("_id").sort({ _id: 1 }).limit(batchSize).session(session).lean();
		if (batch.length === 0) return { deletedCount: 0, hasMore: false };

		const result = await Vocab.deleteMany({ user: userId, _id: { $in: batch.map(({ _id }) => _id) } }, { session });
		const hasMore = Boolean(await Vocab.exists({ user: userId }).session(session));
		return { deletedCount: result.deletedCount, hasMore };
	}, transactionOptions);
}

module.exports = { deleteVocabularies, DEFAULT_BATCH_SIZE, MAX_BATCH_SIZE };
