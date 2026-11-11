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

const ACCOUNT_WRITE_TRANSACTION_OPTIONS = {
	readPreference: "primary",
	readConcern: { level: "snapshot" },
	writeConcern: { w: "majority" },
};

/**
 * Run account-owned database writes while serializing against lifecycle changes.
 * Every write in `write` must use the supplied session. Callers already inside a
 * transaction can pass that session to avoid starting a nested transaction.
 */
async function withActiveAccountWrite(userId, write, { session } = {}) {
	if (typeof write !== "function") throw new TypeError("An account write callback is required");
	if (!mongoose.isObjectIdOrHexString(userId)) {
		throw new AppError("Account is not active.", 401);
	}

	const run = async activeSession => {
		const account = await User.findOneAndUpdate(
			{ _id: userId, ...activeAccountFilter() },
			{ $inc: { accountWriteFence: 1 } },
			{ session: activeSession, returnDocument: "after", timestamps: false },
		);
		if (!account) throw new AppError("Account is not active.", 401);
		return write(activeSession);
	};

	if (session !== undefined) {
		if (!session || !session.inTransaction()) {
			throw new TypeError("The supplied account-write session must have an active transaction");
		}
		return run(session);
	}

	return mongoose.connection.transaction(run, ACCOUNT_WRITE_TRANSACTION_OPTIONS);
}

module.exports = { isActiveAccount, activeAccountFilter, withActiveAccountWrite };
