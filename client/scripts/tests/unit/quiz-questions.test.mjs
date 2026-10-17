import test from "node:test";
import assert from "node:assert/strict";
import { buildQuestions, getUniqueTranslations, normalizeText } from "../../../app/_lib/quizQuestions.mjs";
import { selectReviewWords } from "../../../app/_lib/vocabulary.mjs";
import { createMistakeReviewSession } from "../../../app/_lib/mistakeReviewSession.mjs";
import { createReviewSaveController } from "../../../app/_lib/reviewSaveController.mjs";
import { submitQuizletReviewAnswer } from "../../../app/_lib/quizletReviewAction.mjs";

function wordsFor(due) {
	return Array.from({ length: 16 }, (_, index) => ({
		_id: `word-${index}`, english: `english-${index}`, vietnamese: `meaning-${index}`,
		reviewCount: 1, nextReview: index < due ? "2020-01-01" : "2099-01-01",
		status: index >= due,
	}));
}

for (const due of [0, 1, 2, 3, 4, 8]) {
	test(`${due} due words use saved vocabulary only as distinct distractors`, async () => {
		const vocabulary = wordsFor(due);
		const before = structuredClone(vocabulary);
		const reviewWords = selectReviewWords(vocabulary, { global: true, dueOnly: true });
		const questions = buildQuestions(reviewWords, vocabulary);
		assert.equal(questions.length, due);
		const saves = [];
		const reviewSave = createReviewSaveController((id, input) => { saves.push({ id, input }); });
		const session = createMistakeReviewSession(questions.length);
		for (const [index, question] of questions.entries()) {
			const choices = question.choices.map(normalizeText);
			assert.equal(choices.length, 4);
			assert.equal(new Set(choices).size, 4);
			assert.equal(choices.filter(value => value === normalizeText(question.correctAnswer)).length, 1);
			const result = submitQuizletReviewAnswer({ reviewSave, session, index, wordId: question.word._id,
				mode: "quiz", answer: question.correctAnswer, correctAnswer: question.correctAnswer, practice: false, correct: true });
			assert.equal(result.accepted, true);
		}
		await new Promise(resolve => setImmediate(resolve));
		assert.equal(session.getSnapshot().finished, true);
		assert.deepEqual(saves.map(save => save.id), reviewWords.map(word => word._id));
		assert.deepEqual(vocabulary, before, "Question generation cannot modify review dates, XP or vocabulary");
	});
}

test("fewer than four eligible meanings produces no malformed questions", () => {
	const words = wordsFor(1);
	assert.deepEqual(buildQuestions([words[0]], words.slice(0, 3)), []);
	assert.deepEqual(buildQuestions([words[0]], [words[0], ...words.slice(1).map(word => ({ ...word, english: "" }))]), []);
	assert.deepEqual(buildQuestions([words[0]], words.map(word => ({ ...word, vietnamese: "meaning-0" }))), []);
});

test("blank and case/whitespace duplicate translations never become extra answer choices", () => {
	const words = wordsFor(1).slice(0, 4);
	const pool = [...words, { ...words[0], vietnamese: "  MEANING-0 " },
		{ english: "blank", vietnamese: " " }, { english: " ", vietnamese: "ineligible" }];
	assert.equal(getUniqueTranslations(pool).length, 4);
	for (let run = 0; run < 30; run++) {
		const [question] = buildQuestions([words[0]], pool);
		assert.equal(new Set(question.choices.map(normalizeText)).size, 4);
		assert.equal(question.choices.filter(value => normalizeText(value) === "meaning-0").length, 1);
	}
});
