const mongoose = require("mongoose");
const runner = require("../services/accountDeletionRunner");

const CONFIRMATION_FLAG = "--confirm-account-deletion";

async function runAccountDeletionCli(args = process.argv.slice(2), {
	env = process.env,
	connect = uri => mongoose.connect(uri),
	disconnect = () => mongoose.disconnect(),
	runOnce = runner.runAccountDeletionOnce,
} = {}) {
	if (args.length !== 1 || args[0] !== CONFIRMATION_FLAG) {
		throw new Error(`Explicit confirmation required: pass ${CONFIRMATION_FLAG}`);
	}
	if (!env.DATABASE) throw new Error("DATABASE is required");

	let connected = false;
	try {
		await connect(env.DATABASE);
		connected = true;
		return await runOnce();
	} finally {
		if (connected) await disconnect();
	}
}

async function main() {
	require("dotenv").config({ quiet: true });
	const result = await runAccountDeletionCli();
	console.log(JSON.stringify(result));
}

if (require.main === module) {
	main().catch(() => {
		console.error("Account-deletion runner failed; retry only after checking the internal service state.");
		process.exitCode = 1;
	});
}

module.exports = { runAccountDeletionCli, CONFIRMATION_FLAG };
