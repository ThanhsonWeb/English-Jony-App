import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { getDialogueAudioFailureKind } from "./dialogueAudioFailure.mjs";

test("missing audio URLs produce the unavailable state", () => {
	for (const line of [undefined, null, {}, { audioUrl: "" }, { audioUrl: "  " }]) {
		assert.equal(getDialogueAudioFailureKind(line), "missing");
	}
});

test("playback errors are surfaced while aborted stale requests are ignored", () => {
	const line = { audioUrl: "/dialogue/course/lesson/audio/line-01.mp3" };
	assert.equal(getDialogueAudioFailureKind(line, new Error("Not supported")), "failed");
	assert.equal(getDialogueAudioFailureKind(line, new DOMException("Stopped", "AbortError")), null);
});

test("dialogue audio failure messages are localized", async () => {
	for (const locale of ["en", "vi"]) {
		const messages = JSON.parse(await readFile(new URL(`../../../messages/${locale}.json`, import.meta.url), "utf8"));
		assert.ok(messages.DialogueFeature.dialogueAudioPlaybackFailed);
		assert.ok(messages.DialogueFeature.dialogueAudioMissing);
	}
});
