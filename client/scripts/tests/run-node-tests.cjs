const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const clientRoot = path.resolve(__dirname, "../..");
const group = process.argv[2];
const testRoots = {
	unit: path.join(__dirname, "unit"),
	integration: path.join(__dirname, "integration"),
	app: path.join(clientRoot, "app"),
};

if (!Object.hasOwn(testRoots, group)) {
	console.error("Usage: node scripts/tests/run-node-tests.cjs <unit|integration|app>");
	process.exitCode = 1;
} else {
	const tests = [];
	function collect(directory) {
		for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
			const filePath = path.join(directory, entry.name);
			if (entry.isDirectory()) collect(filePath);
			else if (/\.test\.(?:cjs|js|mjs)$/.test(entry.name)) tests.push(filePath);
		}
	}

	collect(testRoots[group]);
	tests.sort();
	if (tests.length === 0) {
		console.error(`No ${group} tests were discovered.`);
		process.exitCode = 1;
	} else {
		console.log(`Discovered ${tests.length} ${group} tests.`);
		const result = spawnSync(process.execPath, ["--test", ...tests], {
			cwd: clientRoot,
			stdio: "inherit",
			env: process.env,
		});
		if (result.error) {
			console.error(result.error.message);
			process.exitCode = 1;
		} else {
			process.exitCode = result.status ?? 1;
		}
	}
}
