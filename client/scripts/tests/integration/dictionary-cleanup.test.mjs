import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const dictionary = JSON.parse(
	fs.readFileSync("app/_lib/dictionary/dictionary.cleaned.json", "utf8"),
);
const lemmaMap = JSON.parse(
	fs.readFileSync("app/_lib/dictionary/lemma-map.json", "utf8"),
);
const report = JSON.parse(
	fs.readFileSync("app/_lib/dictionary/dictionary-audit.json", "utf8"),
);

test("keeps useful words from existing dialogues", () => {
	for (const word of [
		"breakfast",
		"fire",
		"free",
		"great",
		"help",
		"hotel",
		"name",
		"night",
		"office",
		"please",
		"reservation",
		"room",
		"stay",
		"team",
	]) {
		assert.ok(dictionary[word], `Expected cleaned entry for ${word}`);
	}
});

test("keeps useful beginner function words with clean meanings", () => {
	const expectedMeanings = {
		a: "một",
		an: "một",
		at: "ở / tại / lúc",
		for: "cho / vì / trong",
		from: "từ",
		on: "trên / vào",
		the: "mạo từ xác định (thường không dịch riêng)",
		to: "đến / để",
	};

	for (const [word, meaning] of Object.entries(expectedMeanings)) {
		assert.equal(dictionary[word]?.meaning, meaning);
	}
});

test("maps grammar-only inflections to useful lemmas", () => {
	assert.equal(lemmaMap.worked, "work");
	assert.equal(dictionary.worked.type, "verb");
	assert.equal(dictionary.worked.meaning, dictionary.work.meaning);
});

test("writes every audit category and processes the full source", () => {
	assert.ok(report.summary.sourceEntries >= 2002);
	for (const category of [
		"suspiciousEntries",
		"lemmaCandidates",
		"grammarDescriptions",
		"brokenIpa",
		"questionablePos",
	]) {
		assert.ok(Array.isArray(report[category]));
	}
});
