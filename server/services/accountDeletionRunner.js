const User = require("../models/userModel");
const accountDeletion = require("./accountDeletionCoordinator");

let inFlightRun = null;

const nextUnattemptedDeletingAccount = () => User.findOneAndUpdate(
	{ lifecycleState: "deleting", deletionRunnerCycleAttempted: { $ne: true } },
	{ $set: { deletionRunnerCycleAttempted: true } },
	{ sort: { _id: 1 }, returnDocument: "after", timestamps: false },
).select("_id").lean();

async function processNextDeletingAccount() {
	let candidate = await nextUnattemptedDeletingAccount();
	if (!candidate) {
		// Start a new round only after every currently deleting account was attempted.
		// The marker is written before coordination, so crashes and errors cannot pin
		// the runner to one blocked account; each account gets another turn next round.
		await User.updateMany(
			{ lifecycleState: "deleting", deletionRunnerCycleAttempted: true },
			{ $unset: { deletionRunnerCycleAttempted: 1 } },
			{ timestamps: false },
		);
		candidate = await nextUnattemptedDeletingAccount();
	}
	if (!candidate) return { status: "idle" };

	return accountDeletion.coordinateAccountDeletion(candidate._id);
}

// This runner is invoked explicitly by internal tooling; it is not started by the server.
// A rejected run clears the in-process guard, leaving this account eligible next cycle.
function runAccountDeletionOnce() {
	if (inFlightRun) return inFlightRun;
	inFlightRun = processNextDeletingAccount().finally(() => {
		inFlightRun = null;
	});
	return inFlightRun;
}

module.exports = { runAccountDeletionOnce };
