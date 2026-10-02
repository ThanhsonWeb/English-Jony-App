import { test } from "node:test";
import assert from "node:assert/strict";
import {
	createReviewSaveController,
	isReviewCompletionReady,
} from "../app/_lib/reviewSaveController.mjs";

function deferred() {
	let resolve;
	let reject;
	const promise = new Promise((yes, no) => {
		resolve = yes;
		reject = no;
	});
	return { promise, resolve, reject };
}

const settle = () => new Promise((resolve) => setImmediate(resolve));

for (const mode of ["flashcard", "quiz", "writing"]) {
	test(`${mode}: rapid answers advance while saves run, and double answers save once`, async () => {
		const first = deferred();
		const second = deferred();
		const calls = [];
		const controller = createReviewSaveController((wordId, input) => {
			calls.push({ wordId, input });
			return calls.length === 1 ? first.promise : second.promise;
		});
		const answer = mode === "flashcard" ? { mode, rating: "hard" } : { mode, answer: "correct" };
		const submit = (index, wordId) => mode === "flashcard"
			? controller.submitAnswer(index, wordId, answer)
			: controller.submitRetryAnswer(index, wordId, answer, true).accepted;

		assert.equal(submit(0, "word-1"), true);
		assert.equal(submit(0, "word-1"), false);
		assert.equal(controller.getSnapshot().pending, 1);
		assert.equal(submit(1, "word-2"), true);
		assert.equal(calls.length, 2);
		assert.equal(controller.getSnapshot().pending, 2);
		assert.equal(isReviewCompletionReady(true, 2), false);

		first.resolve();
		await settle();
		assert.equal(controller.getSnapshot().pending, 1);
		assert.equal(isReviewCompletionReady(true, 1), false);
		second.resolve();
		await settle();
		assert.deepEqual(controller.getSnapshot(), { pending: 0, failed: 0 });
		assert.equal(isReviewCompletionReady(true, 0), true);
	});

	test(`${mode}: failed save shows a notice and does not block progress`, async () => {
		const first = deferred();
		const calls = [];
		const controller = createReviewSaveController((wordId) => {
			calls.push(wordId);
			return calls.length === 1 ? first.promise : Promise.resolve();
		});
		const answer = mode === "flashcard" ? { mode, rating: "again" } : { mode, answer: "wrong" };

		if (mode === "flashcard") {
			assert.equal(controller.submitAnswer(0, "word-1", answer), true);
		} else {
			assert.deepEqual(controller.submitRetryAnswer(0, "word-1", answer, false), {
				accepted: true, advance: false, firstAttempt: true,
			});
		}
		first.reject(new Error("offline"));
		await settle();
		assert.deepEqual(controller.getSnapshot(), { pending: 0, failed: 1 });
		if (mode === "flashcard") {
			assert.equal(controller.submitAnswer(1, "word-2", answer), true);
		} else {
			assert.deepEqual(controller.submitRetryAnswer(0, "word-1", { mode, answer: "correct" }, true), {
				accepted: true, advance: true, firstAttempt: false,
			});
			assert.equal(calls.length, 1, "correct retry must not replace the mistake schedule");
			assert.equal(controller.submitRetryAnswer(1, "word-2", { mode, answer: "correct" }, true).advance, true);
		}
		await settle();
		assert.deepEqual(calls, ["word-1", "word-2"]);
		assert.equal(isReviewCompletionReady(true, controller.getSnapshot().pending), true);
		assert.equal(controller.getSnapshot().failed, 1);
	});
}

for (const mode of ["quiz", "writing"]) {
	test(`${mode}: repeated misses and later success save only the first mistake`, async () => {
		const firstSave = deferred();
		const calls = [];
		const controller = createReviewSaveController((wordId, input) => {
			calls.push({ wordId, input });
			return firstSave.promise;
		});
		const wrong = { mode, answer: "wrong" };
		const right = { mode, answer: "correct" };

		assert.deepEqual(controller.submitRetryAnswer(0, "word-1", wrong, false), {
			accepted: true, advance: false, firstAttempt: true,
		});
		assert.deepEqual(controller.submitRetryAnswer(0, "word-1", wrong, false), {
			accepted: true, advance: false, firstAttempt: false,
		});
		assert.deepEqual(controller.submitRetryAnswer(0, "word-1", right, true), {
			accepted: true, advance: true, firstAttempt: false,
		});
		assert.deepEqual(controller.submitRetryAnswer(0, "word-1", right, true), {
			accepted: false, advance: false, firstAttempt: false,
		});
		assert.deepEqual(calls, [{ wordId: "word-1", input: wrong }]);
		assert.equal(controller.getSnapshot().pending, 1);
		firstSave.resolve();
		await settle();
		assert.deepEqual(controller.getSnapshot(), { pending: 0, failed: 0 });
	});
}

test("practice restart accepts each word again without duplicating the first pass", async () => {
	const calls = [];
	const controller = createReviewSaveController((wordId, input) => {
		calls.push({ wordId, input });
		return Promise.resolve();
	});
	assert.equal(controller.submitAnswer(0, "word-1", { mode: "flashcard", rating: "easy" }), true);
	assert.equal(controller.submitAnswer(0, "word-1", { mode: "flashcard", rating: "easy" }), false);
	controller.resetAnswers();
	assert.equal(controller.submitAnswer(0, "word-1", { mode: "flashcard", rating: "easy", practice: true }), true);
	await settle();
	assert.equal(calls.length, 2);
});
