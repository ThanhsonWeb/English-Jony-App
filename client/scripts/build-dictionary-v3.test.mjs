import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import test from "node:test";
import { buildDictionary, dictionaryDirectory, loadSources, lowValueHeadword, overrides, selectSenses, senseQuality, validationWords } from "./build-dictionary-v3.mjs";

const snapshot = () => Object.fromEntries(fs.readdirSync(dictionaryDirectory).map(file => [file,
	createHash("sha256").update(fs.readFileSync(path.join(dictionaryDirectory, file))).digest("hex"),
]));
const before = snapshot();
const { output, report } = await buildDictionary();
const { lookup } = await loadSources();
const expected = {
	improve: "cải thiện; cải tiến", leader: "lãnh đạo, người đứng đầu", mail: "thư, thư từ",
	meeting: "cuộc họp, buổi gặp mặt chính thức", matter: "vấn đề; chuyện", it: "nó",
	interested: "quan tâm, thích thú", break: "vỡ; gãy; đập vỡ", watch: "đồng hồ đeo tay",
	version: "phiên bản", unit: "đơn vị", web: "web / mạng", feeling: "cảm giác; cảm xúc",
	team: "đội, nhóm", making: "làm, tạo ra, khiến cho", planning: "lên kế hoạch; trù tính",
	bring: "mang; đem; đưa",
	banks: "ngân hàng", leaders: "lãnh đạo, người đứng đầu",
	above: "ở trên, bên trên", absolute: "tuyệt đối, hoàn toàn", academic: "học thuật", account: "tài khoản",
};
for (const [word, meaning] of Object.entries(expected)) {
	test(`learner meaning: ${word}`, () => assert.equal(output[word]?.primaryMeaning, meaning));
}

test("input is explicitly reported missing, never invented", () => {
	assert(!lookup.has("input"));
	assert(!Object.hasOwn(output, "input"));
	assert.deepEqual(report.missingValidationWords, ["input"]);
	assert(validationWords.every(word => word === "input" || Object.hasOwn(expected, word)));
});

test("all exported meanings and metadata obey the contract", () => {
	for (const [word, entry] of Object.entries(output)) {
		const rows = lookup.get(word);
		assert(rows, word);
		assert(entry.pos.length && entry.primaryMeaning);
		assert(entry.meanings.length <= 3);
		const texts = [entry.primaryMeaning, ...entry.meanings];
		assert(texts.every(text => typeof text === "string" && text.trim()));
		assert.equal(new Set(texts.map(text => text.toLocaleLowerCase("vi"))).size, texts.length, word);
		const forms = [...new Map(rows.map(row => {
			const form = { pos: row.pos, pron: row.pron ?? null };
			return [JSON.stringify(form), form];
		})).values()];
		assert.deepEqual(entry.sourceForms, forms, word);
		assert.deepEqual(entry.pron, [...new Set(forms.map(form => form.pron).filter(value => typeof value === "string" && value.length))], word);
		if (!overrides[word]) {
			const lemma = report.inheritedLemmas.find(item => item.word === word)?.lemma;
			const sourceMeanings = (lemma ? lookup.get(lemma) : rows).flatMap(row => row.senses_vi).map(text => text.normalize("NFC").replace(/\s+/gu, " ").trim().replace(/[.;]+$/u, ""));
			assert(texts.every(text => sourceMeanings.some(source => source === text || source.startsWith(`${text} (`))), `Non-source sense: ${word}`);
			assert(entry.pos.every(pos => forms.some(form => form.pos === pos)), word);
		}
	}
});

test("inflected words inherit useful lemma senses without losing their own metadata", () => {
	for (const [word, lemma] of [["banks", "bank"], ["leaders", "leader"], ["making", "make"], ["planning", "plan"]]) {
		assert(report.inheritedLemmas.some(item => item.word === word && item.lemma === lemma));
		assert.deepEqual(output[word].pron, [...new Set(lookup.get(word).map(row => row.pron).filter(Boolean))]);
		assert(output[word].pos.every(pos => lookup.get(word).some(row => row.pos === pos)));
	}
	assert.equal(output.watching.primaryMeaning, "xem, theo dõi");
	for (const word of ["changes", "levels", "books", "accounts", "buildings"]) {
		assert(!lookup.has(word));
		assert(!Object.hasOwn(output, word));
	}
	assert.equal(output.iran.primaryMeaning, "Iran");
	assert.equal(output.scotland.primaryMeaning, "Scotland");
	assert.deepEqual(report.remainingInflectedSuspicious, []);
});

test("ordinary lowercase words reject person names; proper-name entries remain valid", () => {
	assert.deepEqual(selectSenses("banks", [{ pos: "n", senses_vi: ["Joseph Banks"] }]).selected, []);
	assert.equal(selectSenses("Banks", [{ pos: "n", senses_vi: ["Joseph Banks"] }]).selected[0].text, "Joseph Banks");
	assert.equal(selectSenses("iran", [{ pos: "n", senses_vi: ["Iran"] }]).selected[0].text, "Iran");
});

test("low-value numeric labels are excluded while ordinary words remain", () => {
	for (const word of [".22", "11-plus", "9/11"]) {
		assert(lowValueHeadword(word));
		assert(!Object.hasOwn(output, word));
		assert(report.excludedHeadwords.includes(word));
	}
	assert(!lowValueHeadword("above"));
	assert(!lowValueHeadword("22"));
});

test("report counts describe actual output, not source row counts", () => {
	assert.equal(report.validRecordsLoaded, [...lookup.values()].reduce((sum, rows) => sum + rows.length, 0));
	assert.equal(report.uniqueHeadwordsExported, Object.keys(output).length);
	assert.equal(report.uniqueHeadwordsExported + report.excludedHeadwords.length, lookup.size);
	assert.equal(report.entriesWithMultipleMeanings, Object.values(output).filter(entry => entry.meanings.length).length);
	assert.equal(report.overrideCount, Object.keys(output).filter(word => overrides[word]).length);
	assert(report.specialistFallbacks.every(word => output[word].meanings.length === 0));
});

test("known bad cases are corrected without losing source POS or pronunciation", () => {
	assert.deepEqual(output.it.pos, ["pron"]);
	assert.deepEqual(output.it.sourceForms, [{ pos: "n", pron: "/ɪt/" }]);
	assert.equal(output.a.primaryMeaning, "một");
	assert.equal(output.are.primaryMeaning, "là");
	assert.equal(output.can.primaryMeaning, "có thể");
	assert.equal(output.will.primaryMeaning, "sẽ");
	assert(!JSON.stringify([output.team.primaryMeaning, ...output.team.meanings]).includes("cỗ"));
	assert(output.break.meanings.every(text => !text.includes("địa chất")));
	assert(output.watch.meanings.every(text => !text.includes("trên tàu")));
});

test("specialist fallback is used only without a general sense", () => {
	const specialized = { pos: "n", senses_vi: ["đứt gãy (địa chất)"] };
	const normal = { pos: "n", senses_vi: ["giờ giải lao"] };
	const mixed = selectSenses("fixture", [specialized, normal]);
	assert.equal(mixed.fallback, false);
	assert.deepEqual(mixed.selected.map(sense => sense.text), ["giờ giải lao"]);
	assert.equal(selectSenses("fixture", [specialized]).fallback, true);
	assert.equal(selectSenses("fixture", [{ pos: "n", senses_vi: ["(từ cổ) xe ngựa"] }]).selected.length, 0);
	assert.equal(senseQuality("lỗi thời; không hợp mốt"), "general");
	assert.equal(senseQuality("hay"), "general");
});

test("duplicates do not consume alternative slots", () => {
	const rows = [{ pos: "v", senses_vi: ["cải thiện; cải tiến", "cải thiện", "CẢI THIỆN."] }];
	assert.equal(selectSenses("fixture", rows).selected.length, 1);
});

test("streaming loader reports malformed/schema-invalid lines and keeps later records", async () => {
	const temp = fs.mkdtempSync(path.join(os.tmpdir(), "studyjony-v3-test-"));
	const files = [1, 2, 3, 4].map(number => `freq-tier1-0${number}.jsonl`);
	const row = { headword: "sample", pos: "n", pron: "/sample/", senses_vi: ["mẫu"] };
	const contents = [
		`\uFEFF${JSON.stringify(row)}\r\n\r\n`,
		`W${JSON.stringify(row)}\n${JSON.stringify({ ...row, pos: "v", senses_vi: ["lấy mẫu"] })}\n`,
		`{"headword":"bad"}\n${JSON.stringify({ ...row, headword: "other", pron: null })}\n`,
		`${JSON.stringify({ ...row, headword: "last" })}\n`,
	];
	try {
		files.forEach((file, index) => fs.writeFileSync(path.join(temp, file), contents[index]));
		const result = await loadSources(temp);
		assert.equal(result.report.validRecordsLoaded, 4);
		assert.equal(result.lookup.size, 3);
		assert.equal(result.lookup.get("sample").length, 2);
		assert.equal(result.report.malformedLines.length, 1);
		assert.equal(result.report.skippedLines.length, 2);
		assert.equal(result.report.blankLines, 1);
		assert.equal(result.report.malformedLines[0].line, 1);
		assert.equal(result.report.malformedLines[0].file, files[1]);
		files.forEach((file, index) => assert.equal(fs.readFileSync(path.join(temp, file), "utf8"), contents[index]));
	} finally {
		for (const file of files) fs.rmSync(path.join(temp, file), { force: true });
		fs.rmdirSync(temp);
	}
});

test("the build is read-only and reproduces dictionary-v3.json", () => {
	assert.deepEqual(snapshot(), before);
	assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dictionaryDirectory, "dictionary-v3.json"), "utf8")), output);
});
