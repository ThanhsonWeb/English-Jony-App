const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const browserDirectory = __dirname;
const clientRoot = path.resolve(browserDirectory, "../../..");
const tests = fs.readdirSync(browserDirectory)
	.filter((name) => /^test-.*\.cjs$/.test(name))
	.sort();

if (tests.length === 0) {
	console.error("No browser tests were discovered.");
	process.exitCode = 1;
} else {
	console.log(`Discovered ${tests.length} browser tests.`);
	try {
		require.resolve("playwright", { paths: [clientRoot] });
	} catch {
		console.error(`Playwright is not installed; 0 of ${tests.length} browser tests could run.`);
		process.exitCode = 1;
	}

	if (process.exitCode !== 1) {
		let failures = 0;
		let skipped = 0;
		for (const name of tests) {
			if (name === "test-avatar-crop-encoding.cjs" &&
				!["STUDYJONY_TEST_EMAIL", "STUDYJONY_TEST_PASSWORD", "STUDYJONY_TEST_IMAGE"].every(key => process.env[key])) {
				skipped += 1;
				console.log(`\nSKIP ${name}: isolated local account and image fixture not configured. Run it directly with STUDYJONY_TEST_EMAIL, STUDYJONY_TEST_PASSWORD and STUDYJONY_TEST_IMAGE.`);
				continue;
			}
			console.log(`\nRunning ${name}`);
			const result = spawnSync(process.execPath, [path.join(browserDirectory, name)], {
				cwd: clientRoot,
				stdio: "inherit",
				env: process.env,
			});
			if (result.error || result.status !== 0) {
				failures += 1;
				console.error(`${name} failed${result.status === null ? `: ${result.error?.message || "process could not start"}` : ` with exit code ${result.status}`}.`);
			}
		}
		console.log(`\nBrowser tests: ${tests.length - failures - skipped} passed, ${failures} failed, ${skipped} skipped.`);
		if (failures > 0) process.exitCode = 1;
	}
}
