const assert = require("node:assert/strict");
const { test } = require("node:test");
const { execFileSync } = require("node:child_process");
const path = require("node:path");
const catalogue = require("../data/dialogueTaskCatalogue.json");
const { isKnownDialogueTask } = require("../utils/dialogueCatalogue");

test("every published dialogue task is allowed and generated catalogue matches source", () => {
	execFileSync(process.execPath, ["--experimental-vm-modules", path.resolve(__dirname, "../scripts/generate-dialogue-catalogue.js"), "--check"], { stdio: "pipe" });
	assert.ok(catalogue.length > 0);
	for (const ids of catalogue) assert.equal(isKnownDialogueTask(...ids), true);
	assert.equal(isKnownDialogueTask("office-introduction", "meeting-tom", "unknown"), false);
});

test("catalogue generation is independent of the A2 R2 flag", () => {
	for (const value of ["0", "1"]) {
		execFileSync(process.execPath, ["--experimental-vm-modules", path.resolve(__dirname, "../scripts/generate-dialogue-catalogue.js"), "--check"], {
			stdio: "pipe", env: { ...process.env, NEXT_PUBLIC_A2_R2_MEDIA: value },
		});
	}
});
