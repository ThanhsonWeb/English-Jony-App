import assert from "node:assert/strict";
import test from "node:test";

import {
	assertNoRegisteredA1Overwrite,
	validateDialogueLevel,
} from "../../lib/dialogue-level.mjs";

function checkLevel(draftLevel, courseLevel) {
	return validateDialogueLevel({
		draftLevel,
		courseLevel,
		courseId: "sample-course",
		dialogueId: "sample-lesson",
	});
}

test("accepts matching A1 levels and the legacy beginner alias", () => {
	assert.equal(checkLevel("a1", "a1"), "a1");
	assert.equal(checkLevel("A1", "beginner"), "a1");
	assert.equal(checkLevel("beginner", "A1"), "a1");
});

test("accepts matching A2 levels case-insensitively", () => {
	assert.equal(checkLevel("A2", "a2"), "a2");
});

test("accepts every canonical CEFR level case-insensitively", () => {
	for (const level of ["A1", "A2", "B1", "B2", "C1", "C2"]) {
		assert.equal(checkLevel(level, level.toLowerCase()), level.toLowerCase());
	}
});

test("rejects missing course or draft levels", () => {
	assert.throws(() => checkLevel(undefined, "a1"), /Draft .* level is missing/);
	assert.throws(() => checkLevel("a1", ""), /Course .* level is missing/);
});

test("rejects invalid course or draft levels", () => {
	assert.throws(() => checkLevel("a1", "beginner-plus"), /Course .* is invalid/);
	assert.throws(() => checkLevel("A0", "a1"), /Draft .* is invalid/);
});

test("rejects a valid but mismatched draft level before publication", () => {
	assert.throws(
		() => checkLevel("a1", "a2"),
		/Draft "sample-course\/sample-lesson" level "a1" does not match course "sample-course" level "a2"/,
	);
});

test("blocks republishing an existing registered A1 lesson even for an A1 draft", () => {
	assert.equal(checkLevel("A1", "beginner"), "a1");
	assert.throws(
		() => assertNoRegisteredA1Overwrite({
			courseLevel: "beginner",
			isRegisteredTarget: true,
			targetExists: true,
			courseId: "asking-for-directions",
			dialogueId: "finding-a-cafe",
		}),
		/Refusing to overwrite registered A1 lesson "asking-for-directions\/finding-a-cafe"/,
	);
});

test("allows a new registered A2 lesson through the existing workflow", () => {
	assert.equal(checkLevel("A2", "a2"), "a2");
	assert.doesNotThrow(() => assertNoRegisteredA1Overwrite({
		courseLevel: "a2",
		isRegisteredTarget: true,
		targetExists: false,
		courseId: "a2-course",
		dialogueId: "new-lesson",
	}));
});

test("blocks an existing A1 lesson when the course is mislabeled A2", () => {
	assert.throws(() => assertNoRegisteredA1Overwrite({
		courseLevel: "a2", existingLevel: "a1", isRegisteredTarget: true,
		courseId: "other-course", dialogueId: "existing-lesson",
	}), /Refusing to overwrite registered A1 lesson/);
});

test("blocks a protected registered A1 target when its JSON is missing and config changed", () => {
	assert.throws(() => assertNoRegisteredA1Overwrite({
		courseLevel: "a2", isRegisteredTarget: true,
		courseId: "asking-for-directions", dialogueId: "finding-a-cafe",
	}), /Refusing to overwrite registered A1 lesson/);
});

test("allows a new registered A1 target when its JSON is missing", () => {
	assert.doesNotThrow(() => assertNoRegisteredA1Overwrite({
		courseLevel: "beginner", isRegisteredTarget: true, targetExists: false,
		courseId: "asking-for-directions-v2", dialogueId: "finding-the-bus-stop",
	}));
});

test("blocks a registered A1 target when its JSON exists", () => {
	assert.throws(() => assertNoRegisteredA1Overwrite({
		courseLevel: "beginner", isRegisteredTarget: true, targetExists: true,
		courseId: "new-course", dialogueId: "existing-lesson",
	}), /Refusing to overwrite registered A1 lesson/);
});
