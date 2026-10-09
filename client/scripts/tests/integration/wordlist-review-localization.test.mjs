import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createTranslator } from "use-intl/core";

const loadMessages = (locale) =>
	JSON.parse(fs.readFileSync(new URL(`../../../messages/${locale}.json`, import.meta.url), "utf8"));

function getLeafKeys(value, prefix = "") {
	return Object.entries(value).flatMap(([key, child]) => {
		const path = prefix ? `${prefix}.${key}` : key;
		return child && typeof child === "object"
			? getLeafKeys(child, path)
			: [path];
	});
}

test("WordlistReview has matching Vietnamese and English message keys", () => {
	const vi = loadMessages("vi").WordlistReview;
	const en = loadMessages("en").WordlistReview;

	assert.deepEqual(getLeafKeys(en).sort(), getLeafKeys(vi).sort());
});

test("English review prompts still identify Vietnamese learning meanings", () => {
	const en = loadMessages("en").WordlistReview;

	assert.equal(en.quiz.description, "Choose the correct Vietnamese meaning");
	assert.equal(en.writing.vietnameseMeaning, "Vietnamese meaning");
});

for (const locale of ["vi", "en"]) {
	test(`${locale} review messages format correctly`, () => {
		const messages = loadMessages(locale);
		const t = createTranslator({ locale, messages, namespace: "WordlistReview" });

		assert.ok(t("flashcard.completion", { count: 2 }));
		assert.ok(t("quiz.completion", { count: 2 }));
		assert.ok(t("writing.completion", { count: 2 }));
		assert.ok(t("common.incorrect", { answer: "ground" }).includes("ground"));
		assert.ok(t("common.savingNotice", { count: 2 }));
	});
}
