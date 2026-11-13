const User = require("../models/userModel");
const accountDeletion = require("./accountDeletionCoordinator");

let inFlightRun = null;

async function processNextDeletingAccount() {
	const [candidate] = await User.find({ lifecycleState: "deleting" })
		.select("_id")
		.sort({ _id: 1 })
		.limit(1)
		.lean();
	if (!candidate) return { status: "idle" };

	return accountDeletion.coordinateAccountDeletion(candidate._id);
}

// This runner is invoked explicitly by internal tooling; it is not started by the server.
// A rejected run clears the in-process guard, leaving the deleting account available for retry.
function runAccountDeletionOnce() {
	if (inFlightRun) return inFlightRun;
	inFlightRun = processNextDeletingAccount().finally(() => {
		inFlightRun = null;
	});
	return inFlightRun;
}

module.exports = { runAccountDeletionOnce };
