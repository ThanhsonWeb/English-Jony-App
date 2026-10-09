import test from "node:test";
import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
	courseConfigs,
	dialogueCourseConfigs,
	storyCourseConfigs,
} from "../../../config/index.mjs";

const configDirectory = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"../../../config",
);

test("shared config index discovers dialogue and story courses from their groups", async () => {
	assert.equal(courseConfigs.length, dialogueCourseConfigs.length + storyCourseConfigs.length);
	assert.ok(dialogueCourseConfigs.length > 0);
	assert.ok(storyCourseConfigs.length > 0);
	assert.ok(dialogueCourseConfigs.every((course) => course.contentType === "dialogue"));
	assert.ok(storyCourseConfigs.every((course) => course.contentType === "story"));
	assert.ok(courseConfigs.some((course) => course.courseId === "ten-minutes-a-day"));

	for (const course of courseConfigs) {
		const directory = course.contentType === "story" ? "stories" : "dialogues";
		await access(path.join(configDirectory, directory, `${course.courseId}.mjs`));
	}
});
