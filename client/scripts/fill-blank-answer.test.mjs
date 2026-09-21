import assert from "node:assert/strict";
import test from "node:test";

import {
	fillBlankAnswersMatch,
	normalizeAnswer,
} from "../app/_utils/fillBlankAnswer.js";

test("normalizes Fill Blank capitalization, punctuation, and extra spaces", () => {
	const expected = "Yes, there is";

	assert.equal(fillBlankAnswersMatch("Yes, there is", expected), true);
	assert.equal(fillBlankAnswersMatch("yes there is", expected), true);
	assert.equal(fillBlankAnswersMatch("Yes there is", expected), true);
	assert.equal(fillBlankAnswersMatch("  YES,   there is!  ", expected), true);
	assert.equal(fillBlankAnswersMatch("yes. there is?", expected), true);
});

test("keeps normal incorrect words incorrect", () => {
	assert.equal(fillBlankAnswersMatch("No there is", "Yes, there is"), false);
	assert.equal(fillBlankAnswersMatch("Yes there are", "Yes, there is"), false);
	assert.equal(fillBlankAnswersMatch("coffee", "tea"), false);
});

test("accepts harmless Wi-Fi case, hyphen, and space differences", () => {
	const expected = "Wi-Fi";

	assert.equal(fillBlankAnswersMatch("Wi-Fi", expected), true);
	assert.equal(fillBlankAnswersMatch("wi-fi", expected), true);
	assert.equal(fillBlankAnswersMatch("WiFi", expected), true);
	assert.equal(fillBlankAnswersMatch("wifi", expected), true);
	assert.equal(fillBlankAnswersMatch("wi fi", expected), true);
	assert.equal(fillBlankAnswersMatch("wireless", expected), false);
	assert.equal(fillBlankAnswersMatch("wi-fix", expected), false);
	assert.equal(fillBlankAnswersMatch("wifiname", "Wi-Fi name"), false);
});

test("does not change the original answer while normalizing", () => {
	const expected = "Yes, there is";

	assert.equal(normalizeAnswer(expected), "yes there is");
	assert.equal(expected, "Yes, there is");
});
