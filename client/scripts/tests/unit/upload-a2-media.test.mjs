import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { planMedia, uploadPlan } from "../../upload-a2-media.mjs";

test("plans only registered A2 lesson media with stable keys and hashes", async t => {
	const root = await mkdtemp(path.join(os.tmpdir(), "a2-media-test-"));
	t.after(() => rm(root, { recursive: true, force: true }));
	const lesson = path.join(root, "public", "dialogue", "example", "lesson");
	await mkdir(path.join(lesson, "audio"), { recursive: true });
	await writeFile(path.join(lesson, "audio", "ben-01.mp3"), "audio");
	await writeFile(path.join(lesson, "bg.png"), "image");
	await writeFile(path.join(lesson, "notes.txt"), "ignored");
	const configs = [{ courseId: "example", level: "a2", contentType: "dialogue", dialogues: [{ dialogueId: "lesson" }] }];
	const plan = await planMedia({ clientRoot: root, courseId: "example", lessonId: "lesson", configs });
	assert.deepEqual(plan.map(item => item.key), ["a2/dialogue/example/lesson/audio/ben-01.mp3", "a2/dialogue/example/lesson/bg.png"]);
	assert.equal(plan[0].contentType, "audio/mpeg");
	assert.match(plan[0].sha256, /^[a-f0-9]{64}$/);
	await assert.rejects(planMedia({ clientRoot: root, courseId: "../example", lessonId: "lesson", configs }));
	await assert.rejects(planMedia({ clientRoot: root, courseId: "example", lessonId: "lesson", configs: [{ ...configs[0], level: "a1" }] }));
});

test("skips unchanged objects, creates missing objects and refuses conflicts", async () => {
	const plan = [{ key: "a2/dialogue/example/lesson/a.mp3", sha256: "abc" }];
	let writes = 0;
	await uploadPlan(plan, { head: async () => "abc", put: async () => { writes++; } }, () => {});
	assert.equal(writes, 0);
	await uploadPlan(plan, { head: async () => null, put: async () => { writes++; } }, () => {});
	assert.equal(writes, 1);
	await assert.rejects(uploadPlan(plan, { head: async () => "different", put: async () => { writes++; } }, () => {}), /Existing object differs/);
	assert.equal(writes, 1);
});
