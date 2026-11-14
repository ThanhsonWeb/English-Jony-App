require("dotenv").config({ quiet: true });
const mongoose = require("mongoose");
const { runAvatarCleanupBatch, recoverAvatarCleanup } = require("../services/avatarCleanupWorker");

async function main() {
	if (!process.env.DATABASE) throw new Error("DATABASE is required");
	const args = process.argv.slice(2);
	const allowLocal = args.includes("--local-upload-host");
	const deletingOnly = args.includes("--deleting-only");
	if (args.filter(arg => arg === "--local-upload-host").length > 1 ||
		args.filter(arg => arg === "--deleting-only").length > 1) throw new Error("Invalid cleanup arguments");
	const command = args.filter(arg => arg !== "--local-upload-host" && arg !== "--deleting-only");
	if ((deletingOnly && command.length) || (command.length && (command.length !== 4 || command[0] !== "recover" || command[3] !== "--workers-fenced-and-requests-settled"))) {
		throw new Error("Invalid cleanup arguments");
	}
	await mongoose.connect(process.env.DATABASE);
	console.log(JSON.stringify(command.length ? await recoverAvatarCleanup(command[1], command[2], { allowLocal }) : await runAvatarCleanupBatch({ allowLocal, deletingOnly })));
}
main().catch(() => { console.error("Avatar cleanup failed; inspect worker state before retrying."); process.exitCode = 1; })
	.finally(() => mongoose.disconnect());
