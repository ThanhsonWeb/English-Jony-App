import { test } from "node:test";
import assert from "node:assert/strict";
import { getWordStatus, selectReviewWords } from "../app/_lib/vocabulary.mjs";
const now = new Date("2026-09-20T12:00:00Z");
const words = [
	{
		_id: "new",
		english: "new",
		vietnamese: "moi",
		reviewCount: 0,
		nextReview: "2026-09-19",
	},
	{
		_id: "learning",
		english: "learning",
		vietnamese: "hoc",
		reviewCount: 2,
		nextReview: "2026-09-25",
	},
	{
		_id: "due",
		english: "due",
		vietnamese: "on",
		reviewCount: 2,
		nextReview: "2026-09-19",
	},
	{
		_id: "mastered",
		english: "mastered",
		vietnamese: "nho",
		reviewCount: 5,
		status: true,
		nextReview: "2026-09-25",
	},
];
test("statuses preserve new/due rules and use the existing learned flag", () => {
	assert.deepEqual(
		words.map((word) => getWordStatus(word, now)),
		["new", "learning", "review", "mastered"],
	);
	assert.equal(
		getWordStatus({ ...words[3], nextReview: "2026-09-19" }, now),
		"review",
	);
});
test("global queue spans topics, prioritizes due then learning and leaves input unchanged", () => {
	assert.deepEqual(
		selectReviewWords(words, { global: true, now }).map((word) => word._id),
		["due", "learning", "new"],
	);
	assert.equal(words[0]._id, "new");
	assert.deepEqual(
		selectReviewWords(words, { now }).map((word) => word._id),
		["new", "due"],
	);
});

test("due sessions use only due learned words; review-all keeps the full 85-word queue", () => {
	const due = Array.from({ length: 37 }, (_, index) => ({
		_id: `due-${index}`,
		english: `due ${index}`,
		vietnamese: `on ${index}`,
		reviewCount: 1,
		nextReview: index === 0 ? now.toISOString() : "2026-09-19T12:00:00Z",
	}));
	const later = Array.from({ length: 47 }, (_, index) => ({
		_id: `later-${index}`,
		english: `later ${index}`,
		vietnamese: `sau ${index}`,
		reviewCount: 1,
		nextReview: "2026-09-20T13:00:00Z",
	}));
	const newWord = {
		_id: "new-word", english: "new word", vietnamese: "tu moi",
		reviewCount: 0, nextReview: "2026-09-19T12:00:00Z",
	};
	const vocabulary = [newWord, ...later, ...due];
	for (const mode of ["flashcard", "quiz", "write"]) {
		const dueSession = selectReviewWords(vocabulary, { global: true, dueOnly: true, now });
		const allSession = selectReviewWords(vocabulary, { global: true, now });
		assert.equal(dueSession.length, 37, `${mode} due progress is 1 / 37`);
		assert.ok(dueSession.every((word) => word._id.startsWith("due-")));
		assert.equal(allSession.length, 85, `${mode} review-all progress is 1 / 85`);
		assert.equal(allSession[0]._id, "due-0");
	}
	assert.equal(selectReviewWords(vocabulary, { dueOnly: true, now }).length, 37);
	assert.equal(selectReviewWords(vocabulary, { now }).length, 38);
});
