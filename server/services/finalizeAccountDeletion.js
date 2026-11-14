const mongoose = require("mongoose");
const User = require("../models/userModel");
const AppError = require("../utils/appError");
const { createAccountDeletionReceipt } = require("../utils/accountDeletionReceipt");
const { preflightAccountDeletion } = require("./accountDeletionPreflight");

async function finalizeAccountDeletion(userId) {
	if (!mongoose.isObjectIdOrHexString(userId)) throw new AppError("Invalid account", 400);

	return mongoose.connection.transaction(async session => {
		await preflightAccountDeletion(userId, { session });

		const user = await User.findOne({ _id: userId, lifecycleState: "deleting" })
			.select("+email")
			.session(session)
			.lean();
		if (!user) throw new AppError("Account is not deleting", 409);

		const receipt = await createAccountDeletionReceipt(user.email, { session });
		const deletion = await User.deleteOne({ _id: userId, lifecycleState: "deleting" }, { session });
		if (deletion.deletedCount !== 1) throw new AppError("Account deletion could not be finalized", 409);

		return { deleted: true, receipt };
	}, { readPreference: "primary", readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
}

module.exports = { finalizeAccountDeletion };
