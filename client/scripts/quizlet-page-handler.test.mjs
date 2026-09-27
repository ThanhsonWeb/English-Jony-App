import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createMistakeReviewSession } from "../app/_lib/mistakeReviewSession.mjs";
import { submitQuizletReviewAnswer } from "../app/_lib/quizletReviewAction.mjs";
import { useBackgroundReviewSave } from "../app/_lib/useBackgroundReviewSave.mjs";

for (const mode of ["quiz", "writing"]) {
	test(`${mode} page handler uses the real hook: wrong → reveal → Continue → return → correct`, async (t) => {
		const posts = [];
		t.mock.method(globalThis, "fetch", async (url, options) => {
			if (url.endsWith("/review")) posts.push({ url, input: JSON.parse(options.body) });
			return { ok: true };
		});

		let reviewSave;
		function HookHarness() {
			reviewSave = useBackgroundReviewSave();
			return createElement("div");
		}
		renderToStaticMarkup(createElement(HookHarness));
		assert.equal(typeof reviewSave.submitRetryAnswer, "function");

		const session = createMistakeReviewSession(3);
		function answer(index, text, correct) {
			return submitQuizletReviewAnswer({
				reviewSave, session, index, wordId: `word-${index}`,
				mode, answer: text, correctAnswer: "correct", practice: false, correct,
			});
		}

		const wrong = answer(0, "wrong", false);
		assert.equal(wrong.accepted, true);
		assert.equal(wrong.firstAttempt, true);
		assert.equal(wrong.state.currentIndex, 0);
		assert.equal(wrong.state.waitingForContinue, true);
		assert.deepEqual(wrong.feedback, { type: "wrong", answer: "correct" });
		assert.equal(answer(0, "wrong", false).accepted, false);
		assert.equal(session.continueAfterWrong().state.currentIndex, 1);
		assert.equal(answer(1, "correct", true).state.currentIndex, 2);
		assert.equal(answer(2, "correct", true).state.phase, "mistakes");
		const retry = answer(0, "correct", true);
		assert.equal(retry.firstAttempt, false);
		assert.equal(retry.state.finished, true);
		assert.deepEqual(retry.feedback, { type: "correct" });

		await new Promise((resolve) => setImmediate(resolve));
		assert.deepEqual(posts.map(({ input }) => input.answer), ["wrong", "correct", "correct"]);
		assert.equal(reviewSave.getSnapshot().pending, 0);
	});
}
