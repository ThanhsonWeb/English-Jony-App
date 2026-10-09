import assert from "node:assert/strict";
import test from "node:test";
import { resolveWordlistFilter } from "../../../app/_lib/wordlistFilter.mjs";
import { getWordStatus } from "../../../app/_lib/vocabulary.mjs";

const now = new Date("2026-10-06T10:00:00Z");
const fresh = { reviewCount: 0, lastReviewedAt: null, nextReview: now.toISOString() };
const due = { reviewCount: 1, lastReviewedAt: "2026-10-01", nextReview: now.toISOString() };
const later = { ...due, nextReview: "2026-10-07" };
function select(words, requested) {
	const counts = { review: 0, new: 0 };
	for (const word of words) {
		const status = getWordStatus(word, now);
		counts[status] = (counts[status] || 0) + 1;
	}
	const filter = resolveWordlistFilter(requested, counts);
	return { filter, words: words.filter(word => filter === "all" || getWordStatus(word, now) === filter) };
}
test("explicit Due remains empty for no vocabulary or no due vocabulary", () => {
	for (const words of [[], [fresh], [fresh, later]]) {
		assert.deepEqual(select(words, "review"), { filter: "review", words: [] });
	}
});
test("Due selects exactly one, some, or all due words without changing SRS", () => {
	for (const words of [[due], [fresh, due, later], [due, { ...due }]]) {
		assert.deepEqual(select(words, "review").words, words.filter(word => getWordStatus(word, now) === "review"));
	}
});
test("switching to other explicit filters works, including empty results", () => {
	const words = [fresh, due, later];
	assert.equal(select(words, "all").words.length, 3);
	assert.deepEqual(select(words, "new").words, [fresh]);
	assert.deepEqual(select(words, "learning").words, [later]);
	assert.deepEqual(select(words, "mastered").words, []);
	assert.deepEqual(select(words, "review").words, [due]);
});
test("only an absent/invalid selection uses the original initial default", () => {
	for (const value of [null, "", "invalid"]) {
		assert.equal(select([fresh, due], value).filter, "review");
		assert.equal(select([fresh, later], value).filter, "new");
		assert.equal(select([later], value).filter, "all");
	}
	assert.equal(resolveWordlistFilter(null, { review: 0, new: 0 }, true), "review");
	assert.equal(resolveWordlistFilter("all", { review: 0, new: 0 }, true), "all");
});
test("URL selection survives serialization/reload even when Due count changes", () => {
	const params = new URLSearchParams("unrelated=keep&status=review");
	const reloaded = new URLSearchParams(params.toString());
	assert.equal(reloaded.get("unrelated"), "keep");
	assert.equal(select([fresh], reloaded.get("status")).filter, "review");
	assert.equal(select([due], reloaded.get("status")).filter, "review");
});
