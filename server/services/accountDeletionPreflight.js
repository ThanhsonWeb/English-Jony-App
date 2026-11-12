const mongoose = require("mongoose");
const User = require("../models/userModel");
const AppError = require("../utils/appError");
const { checkAccountDeletionReadiness } = require("./accountDeletionReadiness");

// The caller must keep this session for any subsequent permanent deletion.
async function preflightAccountDeletion(userId, { session } = {}) {
	if (!mongoose.isObjectIdOrHexString(userId)) throw new AppError("Invalid account", 400);
	if (!session || typeof session.inTransaction !== "function" || !session.inTransaction()) {
		throw new TypeError("The supplied preflight session must have an active transaction");
	}

	const account = await User.findOneAndUpdate(
		{ _id: userId, lifecycleState: "deleting" },
		{ $inc: { accountWriteFence: 1 } },
		{ session, returnDocument: "after", timestamps: false },
	);
	if (!account) throw new AppError("Account is not deleting", 409);

	return checkAccountDeletionReadiness(userId, { session });
}

module.exports = { preflightAccountDeletion };
