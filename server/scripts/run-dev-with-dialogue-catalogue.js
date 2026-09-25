const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");

const mode = process.argv[2];
if (mode !== "client" && mode !== "server") {
	console.error("Usage: node scripts/run-dev-with-dialogue-catalogue.js <client|server>");
	process.exit(1);
}

const serverRoot = path.resolve(__dirname, "..");
const workspaceRoot = path.resolve(serverRoot, "..");
const clientRoot = path.join(workspaceRoot, "client");
const generator = path.join(__dirname, "generate-dialogue-catalogue.js");
const watchRoots = [
	path.join(clientRoot, "app/[locale]/(main)/dialogue/_data"),
	path.join(clientRoot, "scripts/config/courses"),
];
const watchedExtensions = new Set([".js", ".json", ".mjs"]);

let debounceTimer;
let generating = false;
let generationPending = false;
let shuttingDown = false;

function regenerateCatalogue() {
	if (generating) {
		generationPending = true;
		return;
	}

	generating = true;
	console.log("\nDialogue data changed. Regenerating task catalogue...");
	const generatorProcess = spawn(
		process.execPath,
		["--experimental-vm-modules", generator],
		{ cwd: serverRoot, stdio: "inherit" },
	);

	generatorProcess.on("exit", (code, signal) => {
		generating = false;
		if (signal || code !== 0) {
			console.error(
				`Dialogue catalogue regeneration failed${signal ? ` (${signal})` : ` with exit code ${code}`}.`,
			);
		}

		if (generationPending && !shuttingDown) {
			generationPending = false;
			regenerateCatalogue();
		}
	});
}

function scheduleRegeneration(filename) {
	if (filename && !watchedExtensions.has(path.extname(String(filename)))) {
		return;
	}

	clearTimeout(debounceTimer);
	debounceTimer = setTimeout(regenerateCatalogue, 200);
}

const watchers = watchRoots.map((watchRoot) => {
	if (!fs.existsSync(watchRoot)) {
		throw new Error(`Dialogue catalogue watch path does not exist: ${watchRoot}`);
	}

	return fs.watch(watchRoot, { recursive: true }, (_eventType, filename) => {
		scheduleRegeneration(filename);
	});
});

const appProcess =
	mode === "client"
		? spawn(
				process.execPath,
				[path.join(clientRoot, "node_modules/next/dist/bin/next"), "dev"],
				{ cwd: clientRoot, stdio: "inherit" },
			)
		: spawn(
				process.execPath,
				[path.join(serverRoot, "node_modules/nodemon/bin/nodemon.js"), "server.js"],
				{ cwd: serverRoot, stdio: "inherit" },
			);

console.log(
	`Watching dialogue and course data while ${mode} development is running.`,
);

function closeWatchers() {
	if (shuttingDown) return;
	shuttingDown = true;
	clearTimeout(debounceTimer);
	for (const watcher of watchers) watcher.close();
}

for (const signal of ["SIGINT", "SIGTERM"]) {
	process.on(signal, () => {
		if (shuttingDown) return;
		closeWatchers();
		appProcess.kill(signal);
		setTimeout(() => process.exit(0), 1000).unref();
	});
}

appProcess.on("error", (error) => {
	closeWatchers();
	console.error(error);
	process.exitCode = 1;
});

appProcess.on("exit", (code, signal) => {
	closeWatchers();
	process.exitCode = signal ? 0 : (code ?? 1);
});
