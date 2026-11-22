import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

test("media audit checks local assets independently of the A2 R2 flag", () => {
	const audit = fileURLToPath(new URL("../../audit-dialogue-media.mjs", import.meta.url));
	const results = ["0", "1"].map(value => JSON.parse(execFileSync(process.execPath, ["--experimental-vm-modules", audit], {
		encoding: "utf8", env: { ...process.env, NEXT_PUBLIC_A2_R2_MEDIA: value }, stdio: ["ignore", "pipe", "pipe"],
	})));
	assert.deepEqual(results[0], results[1]);
	assert.ok(results[0].assets > 0);
	assert.deepEqual(results[0].missing, []);
});
