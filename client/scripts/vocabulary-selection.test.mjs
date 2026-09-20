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
