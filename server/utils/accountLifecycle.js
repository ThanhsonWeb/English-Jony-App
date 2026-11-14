const mongoose = require("mongoose");
const User = require("../models/userModel");
const AppError = require("./appError");

// Existing user documents may predate the lifecycle field. Mongoose applies
// the schema's active default to those documents when this field is selected.
function isActiveAccount(user) {
	return Boolean(user) && user.lifecycleState === "active";
}

// Save filters operate on stored MongoDB values, where legacy fields are absent.
function activeAccountFilter() {
	return { $or: [{ lifecycleState: "active" }, { lifecycleState: { $exists: false } }] };
}

/**
 * Fence an active account inside the caller's transaction. The caller must pass
 * the same session explicitly to every account-owned operation in that transaction.
 */
async function fenceActiveAccountWrite(userId, session) {
	if (!mongoose.isObjectIdOrHexString(userId)) {
		throw new AppError("Account is not active.", 401);
	}
	if (!session || typeof session.inTransaction !== "function" || !session.inTransaction()) {
		throw new TypeError("The supplied account-write session must have an active transaction");
	}
	const account = await User.findOneAndUpdate(
		{ _id: userId, ...activeAccountFilter() },
		{ $inc: { accountWriteFence: 1 } },
		{ session, returnDocument: "after", timestamps: false },
	);
	if (!account) throw new AppError("Account is not active.", 401);
}

module.exports = { isActiveAccount, activeAccountFilter, fenceActiveAccountWrite };
