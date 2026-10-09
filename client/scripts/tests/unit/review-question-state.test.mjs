import { test } from "node:test";
import assert from "node:assert/strict";
import {
	createReviewQuestionState,
	reviewQuestionReducer,
} from "../../../app/_lib/reviewQuestionState.mjs";
import { createMistakeReviewSession } from "../../../app/_lib/mistakeReviewSession.mjs";
import { getFlashcardFaceContent } from "../../../app/_lib/flashcardFace.mjs";

test("answer A with feedback, then move to B and clear the old feedback", () => {
	const session = createMistakeReviewSession(2);
	let state = createReviewQuestionState(session.getSnapshot());

	state = reviewQuestionReducer(state, { type: "selected-answer", value: "ground" });
	state = reviewQuestionReducer(state, { type: "answer", value: "ground" });
	state = reviewQuestionReducer(state, { type: "reveal", value: true });
	state = reviewQuestionReducer(state, {
		type: "feedback",
		value: { type: "correct", answer: "ground", example: "I’ll prepare the fire pit." },
	});
	state = reviewQuestionReducer(state, { type: "temporarily-disabled", value: true });
	assert.equal(state.feedback.example, "I’ll prepare the fire pit.");

	const nextQuestion = session.answer(true).state;
	state = reviewQuestionReducer(state, { type: "session-changed", sessionState: nextQuestion });

	assert.deepEqual(state, createReviewQuestionState(nextQuestion));
});

test("continuing after an incorrect answer clears reveal and feedback state", () => {
	let state = createReviewQuestionState({ currentIndex: 0, phase: "main", waitingForContinue: false });
	state = reviewQuestionReducer(state, {
		type: "feedback",
		value: { type: "wrong", answer: "ground", example: "The ground is wet." },
	});
	state = reviewQuestionReducer(state, {
		type: "session-changed",
		sessionState: { currentIndex: 1, phase: "main", waitingForContinue: false },
	});

	assert.equal(state.feedback, null);
	assert.equal(state.revealed, false);
	assert.equal(state.submitted, false);
});

test("flipping shows the Vietnamese meaning, and the next word returns to the front", () => {
	const word = {
		english: "I'd like to",
		vietnamese: "Tôi muốn / Tôi muốn gọi...",
		pronunciation: "/aɪd laɪk tuː/",
		example: "I'd like to order a coffee.",
	};
	let state = createReviewQuestionState({ currentIndex: 0 });
	state = reviewQuestionReducer(state, { type: "reveal", value: true });
	assert.equal(state.revealed, true);
	const back = getFlashcardFaceContent(word, state.revealed ? "back" : "front");
	assert.equal(back.primary, word.vietnamese);
	assert.notEqual(back.primary, word.english);
	assert.equal(back.context, word.english);

	state = reviewQuestionReducer(state, { type: "question-changed", index: 1 });

	assert.equal(state.sessionState.currentIndex, 1);
	assert.equal(state.revealed, false);
	const front = getFlashcardFaceContent(word, state.revealed ? "back" : "front");
	assert.equal(front.primary, word.english);
});
