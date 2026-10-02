import test from "node:test";
import assert from "node:assert/strict";
import {
	PLAYBACK_RATES,
	readDialoguePlaybackRate,
	saveDialoguePlaybackRate,
} from "./playbackRate.mjs";

function createMemoryStorage() {
	const values = new Map();
	return {
		getItem: (key) => values.get(key) ?? null,
		setItem: (key, value) => values.set(key, value),
	};
}

test("defaults to 1x when there is no saved playback preference", () => {
	assert.equal(readDialoguePlaybackRate(createMemoryStorage()), 1);
});

test("keeps every supported speed when the next task remounts", () => {
	for (const rate of PLAYBACK_RATES) {
		const storage = createMemoryStorage();
		assert.equal(saveDialoguePlaybackRate(rate, storage), true);

		// Reading again models opening the next task or another lesson page.
		assert.equal(readDialoguePlaybackRate(storage), rate);
	}
});

test("uses 1x for an invalid saved preference", () => {
	const storage = createMemoryStorage();
	storage.setItem("studyjony-dialogue-playback-rate", "2");
	assert.equal(readDialoguePlaybackRate(storage), 1);
	assert.equal(saveDialoguePlaybackRate(2, storage), false);
});

test("keeps playback speed isolated when switching between user accounts", () => {
	const storage = createMemoryStorage();

	assert.equal(saveDialoguePlaybackRate(1.5, storage, "user-a"), true);
	assert.equal(readDialoguePlaybackRate(storage, "user-a"), 1.5);

	assert.equal(readDialoguePlaybackRate(storage, "user-b"), 1);
	assert.equal(saveDialoguePlaybackRate(0.75, storage, "user-b"), true);
	assert.equal(readDialoguePlaybackRate(storage, "user-b"), 0.75);

	assert.equal(readDialoguePlaybackRate(storage, "user-a"), 1.5);
});

test("keeps guest playback speed in its generic local preference", () => {
	const storage = createMemoryStorage();
	saveDialoguePlaybackRate(1.25, storage);

	assert.equal(readDialoguePlaybackRate(storage), 1.25);
	assert.equal(readDialoguePlaybackRate(storage, "user-a"), 1);
});
