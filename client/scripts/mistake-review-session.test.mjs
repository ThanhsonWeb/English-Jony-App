import { test } from "node:test";
import assert from "node:assert/strict";
import { createMistakeReviewSession } from "../app/_lib/mistakeReviewSession.mjs";
import { createReviewSaveController } from "../app/_lib/reviewSaveController.mjs";

for (const mode of ["quiz", "writing"]) {
	test(`${mode}: wrong → continue → other words → missed word returns → correct → finish`, async () => {
		const calls = [];
		const saves = createReviewSaveController((wordId, input) => {
			calls.push({ wordId, input });
			return Promise.resolve();
		});
		const session = createMistakeReviewSession(3);
		const firstWrong = { mode, answer: "wrong" };
		const correct = { mode, answer: "correct" };

		assert.deepEqual(saves.submitRetryAnswer(0, "word-0", firstWrong, false), {
			accepted: true, advance: false, firstAttempt: true,
		});
		assert.equal(session.answer(false).state.waitingForContinue, true);
		assert.equal(session.getSnapshot().currentIndex, 0);
		assert.equal(session.answer(false).accepted, false);
		assert.equal(session.continueAfterWrong().state.currentIndex, 1);
		assert.equal(session.getSnapshot().mistakesRemaining, 1);

		for (const index of [1, 2]) {
			assert.equal(saves.submitRetryAnswer(index, `word-${index}`, correct, true).firstAttempt, true);
			assert.equal(session.answer(true).accepted, true);
		}
		assert.equal(session.getSnapshot().phase, "mistakes");
		assert.equal(session.getSnapshot().currentIndex, 0);
		assert.equal(session.getSnapshot().finished, false);
		assert.equal(session.getSnapshot().mistakesRemaining, 1);

		assert.deepEqual(saves.submitRetryAnswer(0, "word-0", correct, true), {
			accepted: true, advance: true, firstAttempt: false,
		});
		assert.equal(session.answer(true).state.finished, true);
		assert.equal(session.getSnapshot().mistakesRemaining, 0);
		assert.deepEqual(calls.map(({ wordId }) => wordId), ["word-0", "word-1", "word-2"]);
		assert.deepEqual(calls[0].input, { ...firstWrong, reviewId: calls[0].input.reviewId });
		assert.equal(new Set(calls.map(call => call.input.reviewId)).size, 3);
	});

	test(`${mode}: a repeat mistake returns in the next round without another save`, () => {
		const calls = [];
		const saves = createReviewSaveController((wordId, input) => {
			calls.push({ wordId, input });
			return Promise.resolve();
		});
		const session = createMistakeReviewSession(2);
		const wrong = { mode, answer: "wrong" };
		const correct = { mode, answer: "correct" };

		saves.submitRetryAnswer(0, "word-0", wrong, false);
		session.answer(false);
		session.continueAfterWrong();
		saves.submitRetryAnswer(1, "word-1", correct, true);
		session.answer(true);
		assert.equal(session.getSnapshot().phase, "mistakes");

		assert.equal(saves.submitRetryAnswer(0, "word-0", wrong, false).firstAttempt, false);
		assert.equal(session.answer(false).state.waitingForContinue, true);
		assert.equal(session.continueAfterWrong().state.currentIndex, 0);
		assert.equal(session.getSnapshot().finished, false);
		assert.equal(session.getSnapshot().total, 1);
		assert.equal(saves.submitRetryAnswer(0, "word-0", correct, true).firstAttempt, false);
		assert.equal(session.answer(true).state.finished, true);
		assert.deepEqual(calls.map(({ wordId }) => wordId), ["word-0", "word-1"]);
	});
}
