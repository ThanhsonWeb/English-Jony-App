import { test } from "node:test";
import assert from "node:assert/strict";
import { splitExample } from "../app/_lib/exampleHighlight.mjs";

test("highlights whole words, phrases and common forms without changing sentence text", () => {
	for (const [word, sentence, matches] of [
		["achieve", "She achieved her dream. ACHIEVE more.", ["achieved", "ACHIEVE"]],
		["challenge", "A challenge, challenges, and unchallenged.", ["challenge", "challenges"]],
		["study", "She studied and studies while studying.", ["studied", "studies", "studying"]],
		["run", "Running runners run.", ["Running", "run"]],
		["look up", "Look up this word.", ["Look up"]],
		["c++", "Use C++ safely.", ["C++"]],
		["cat", "A category and a cat.", ["cat"]],
		["word", "<img onerror='bad'>word</img>", ["word"]],
	]) {
		const parts = splitExample(sentence, word);
		assert.equal(parts.map(part => part.text).join(""), sentence);
		assert.deepEqual(parts.filter(part => part.matched).map(part => part.text), matches);
	}
});
test("missing example and blank vocabulary are safe", () => {
	assert.deepEqual(splitExample(null, "word"), [{ text: "—", matched: false }]);
	assert.deepEqual(splitExample("An example", " "), [{ text: "An example", matched: false }]);
});
