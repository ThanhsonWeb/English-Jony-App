import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { buildCandidate, sha256, withSQLiteSnapshot } from "../../build-dictionary-candidate.mjs";
import { evaluateCandidate } from "../../evaluate-dictionary-candidate.mjs";
import { rankSenses } from "../../extract-dictionary-v2.mjs";
import { sourceDirectory, prototypeDirectory, readJSON, readContentFiles,
	createCandidateLookup, morphologyCandidates, tokenize } from "../../lib/dictionary-candidate.mjs";
import { findPreferredLookup } from "../../../app/_lib/dictionary/findPreferredLookup.js";

const before = Object.fromEntries(fs.readdirSync(sourceDirectory)
	.map(name => [name, sha256(path.join(sourceDirectory, name))]));
const { candidate, report } = buildCandidate();
const lookup = createCandidateLookup(candidate);

function baselineAdapter() {
	const words = readJSON(path.join(sourceDirectory, "dictionary-v3.json"));
	const hints = readJSON(path.join(sourceDirectory, "lemma-map.json"));
	// Production attaches lemma hints to existing words but does not follow a
	// hint when the surface word is absent. Alias fallback is new candidate work.
	const lemmas = Object.fromEntries(Object.entries(hints).filter(([word]) => words[word]));
	return createCandidateLookup({ words, lemmas, phrases: candidate.phrases });
}

test("SQLite ranker prefers an everyday sense and ignores source order", () => {
	const rows = [
		{ definition: "(y học) Một cấu trúc giải phẫu.", pos: "N" },
		{ definition: "(từ cổ) Sự bày biện.", pos: "N" },
		{ definition: "Bánh mì.", pos: "N" },
		{ definition: "Số nhiều của bread", pos: "N" },
	];
	assert.equal(rankSenses(rows)[0].text, "bánh mì");
	assert.deepEqual(rankSenses(rows), rankSenses([...rows].reverse()));
	assert.deepEqual(rankSenses([{ definition: ".", pos: "V" }]), []);
});

test("build is deterministic and matches the shipped candidate", () => {
	const second = buildCandidate();
	assert.deepEqual(candidate, second.candidate);
	assert.deepEqual(report, second.report);
	assert.deepEqual(candidate, readJSON(path.join(prototypeDirectory, "dictionary-candidate.json")));
	assert.deepEqual(report, readJSON(path.join(prototypeDirectory, "build-review.json")));
});

test("retained v3 entries preserve primary and alternate meanings, POS and IPA", () => {
	const original = readJSON(path.join(sourceDirectory, "dictionary-v3.json"));
	let retained = 0;
	for (const [word, evidence] of Object.entries(report.selection)) {
		if (evidence.method !== "preserved-v3") continue;
		retained++;
		for (const field of ["primaryMeaning", "meanings", "pos", "pron"]) assert.deepEqual(candidate.words[word][field], original[word][field], `${word}: ${field}`);
	}
	assert(retained > 4000);
});

test("all current phrase overrides are retained exactly", () => {
	assert.deepEqual(candidate.phrases, readJSON(path.join(sourceDirectory, "phrases.json")));
});

test("baseline adapter agrees with the live phrase finder for all content clicks", () => {
	const adapter = baselineAdapter();
	for (const { lines } of readContentFiles()) for (const line of lines) {
		for (const [index] of tokenize(line.text).entries()) assert.deepEqual(adapter(line.text, index), findPreferredLookup(line.text, index), line.text);
	}
});

test("phrase punctuation, clause boundaries and overlapping priorities match production", () => {
	const adapter = baselineAdapter();
	for (const sentence of ["How are you feeling?", "How are you?", "I see the bank.", "I see. Thanks!",
		"I'd like to check in, please.", "I’d like to check in, please.", "take, the bus", "take the bus",
		"How can I help you?", "You're welcome to join.", "You're welcome!", "check\nin"]) {
		for (const [index] of tokenize(sentence).entries()) assert.deepEqual(adapter(sentence, index), findPreferredLookup(sentence, index), sentence);
	}
	assert.equal(lookup("How are you feeling?", 0)?.result.source, "word");
	assert.equal(lookup("How are you?", 0)?.result.source, "phrase");
	assert.equal(lookup("take, the bus", 0)?.result.source, "word");
	assert.equal(lookup("take the bus", 0)?.result.source, "phrase");
	assert.equal(lookup("How can I help you?", 3)?.result.text, "How can I help you");
	assert.equal(lookup("hello", -1), null);
	assert.equal(lookup("hello", 1), null);
});

test("inflection aliases resolve takes, went and books without inventing meanings", () => {
	for (const [form, base] of [["takes", "take"], ["went", "go"], ["books", "book"], ["children", "child"]]) {
		assert.equal(candidate.lemmas[form], base);
		const result = lookup(form, 0).result;
		assert.equal(result.lemma, base);
		assert.equal(result.primaryMeaning, candidate.words[base].primaryMeaning);
		assert(report.lemmaEvidence[form].flags.length);
	}
	assert.match(lookup("went", 0).result.primaryMeaning, /đi/u);
	assert.match(lookup("books", 0).result.primaryMeaning, /sách/u);
});

test("inflected pronunciations do not inherit the base pronunciation", () => {
	assert.deepEqual(lookup("went", 0).result.pron, candidate.formPronunciations.went);
	assert.notDeepEqual(lookup("went", 0).result.pron, candidate.words.go.pron);
	const fixture = createCandidateLookup({ words: { take: { primaryMeaning: "lấy", pos: ["v"], pron: ["/teɪk/"], meanings: [] } }, lemmas: { takes: "take" }, phrases: {} });
	assert.deepEqual(fixture("takes", 0).result.pron, []);
});

test("stemming is guarded and does not rewrite independent lexical entries", () => {
	for (const word of ["news", "species", "business", "thanks", "feeling", "saw"]) {
		assert(candidate.words[word], `Missing independent entry: ${word}`);
		assert.equal(candidate.lemmas[word], undefined);
	}
	assert(morphologyCandidates("studies").some(([word]) => word === "study"));
	assert(morphologyCandidates("making").some(([word]) => word === "make"));
	assert(morphologyCandidates("stopped").some(([word]) => word === "stop"));
	assert(!morphologyCandidates("business").length);
	assert.equal(lookup("totallyinventedword", 0), null);
});

test("core proposed learner corrections are explicit and remain unapproved", () => {
	const expected = { my: /của tôi/u, should: /nên/u,
		and: /^và$/u, how: /như thế nào/u, lights: /đèn/u, password: /mật khẩu/u, chicken: /gà/u };
	for (const [word, meaning] of Object.entries(expected)) {
		assert.match(candidate.words[word].primaryMeaning, meaning);
		assert.equal(report.selection[word].method, "proposed-editorial");
		assert.equal(report.selection[word].humanApproved, false);
		assert(report.selection[word].flags.some(flag => flag.includes("not human-approved")));
	}
	for (const word of ["helping", "this", "that", "these", "those", "hello", "okay", "alright", "thanks"]) {
		assert.equal(report.selection[word].method, "preserved-v3", `Keep the already-correct v3 entry: ${word}`);
	}
});

test("new automatic selections have auditable source definitions and review flags", () => {
	let automatic = 0;
	for (const [word, evidence] of Object.entries(report.selection)) {
		assert.equal(evidence.humanApproved, false);
		if (evidence.method !== "sqlite-ranked") continue;
		automatic++;
		assert(evidence.flags.some(flag => flag.includes("unverified")), word);
		for (const sense of evidence.selectedSources) {
			assert(sense.sources.length > 0, word);
			assert(sense.sources.every(source => Number.isInteger(source.definitionId) && source.definition), word);
		}
	}
	assert(automatic > 300);
	assert.equal(report.humanApproved, false);
});

test("fixed 24-file benchmark reproduces baseline without coverage regressions", () => {
	const evaluation = evaluateCandidate({ benchmarkOnly: true });
	assert.equal(evaluation.corpus.occurrences, 1862);
	assert.equal(evaluation.baseline.hit, 1202);
	assert.equal(evaluation.baseline.historicalBaselineReproduced, true);
	assert(evaluation.candidate.coveragePercent > 98);
	assert.deepEqual(evaluation.regressions, []);
	assert.equal(evaluation.humanReviewedExamples, 0);
	assert.equal(evaluation.exampleCount, 96);
	assert.equal(new Set(evaluation.examples.map(row => `${row.file}:${row.line}`)).size, 96);
	for (const row of evaluation.examples) {
		assert.equal(row.humanDecision, "PENDING");
		assert(row.flags.length);
	}
	assert(evaluation.missingWords.candidate.some(item => item.word === "emma"));
	assert(evaluation.missingWords.candidate.some(item => item.word === "ten-minute"));
});

test("compact candidate has license metadata and accompanying upstream notices", () => {
	assert.equal(candidate.metadata.license, "CC-BY-SA-4.0");
	assert.match(candidate.metadata.licenseUrl, /creativecommons\.org\/licenses\/by-sa\/4\.0/u);
	assert.match(fs.readFileSync(path.join(prototypeDirectory, "ATTRIBUTION.md"), "utf8"), /MinhQND|Skypedia/u);
	assert.match(fs.readFileSync(path.join(prototypeDirectory, "LICENSE"), "utf8"), /Attribution-ShareAlike 4\.0/u);
	assert(Buffer.byteLength(JSON.stringify(candidate)) < 1024 * 1024);
	for (const entry of Object.values(candidate.words)) {
		assert(entry.primaryMeaning.trim());
		assert(Array.isArray(entry.pos) && Array.isArray(entry.pron));
		assert(entry.meanings.length <= 3);
	}
	for (const [form, lemma] of Object.entries(candidate.lemmas)) {
		assert(candidate.words[lemma]); assert(!candidate.words[form]); assert.notEqual(form, lemma);
	}
});

test("nonempty WAL is refused without changing the database or sidecar", () => {
	const directory = fs.mkdtempSync(path.join(os.tmpdir(), "studyjony-wal-test-"));
	const databasePath = path.join(directory, "source.db");
	try {
		fs.writeFileSync(databasePath, "fixture database");
		fs.writeFileSync(databasePath + "-wal", "pending data");
		const original = sha256(databasePath), wal = sha256(databasePath + "-wal");
		assert.throws(() => withSQLiteSnapshot(databasePath, () => assert.fail("Must not open")), /pending WAL/u);
		assert.equal(sha256(databasePath), original); assert.equal(sha256(databasePath + "-wal"), wal);
	} finally {
		fs.rmSync(databasePath, { force: true }); fs.rmSync(databasePath + "-wal", { force: true }); fs.rmdirSync(directory);
	}
});

test("unexpected SQLite schema fails safely and leaves the source unchanged", () => {
	const directory = fs.mkdtempSync(path.join(os.tmpdir(), "studyjony-schema-test-"));
	const databasePath = path.join(directory, "source.db");
	try {
		const db = new DatabaseSync(databasePath);
		db.exec("CREATE TABLE words (id INTEGER, word TEXT)"); db.close();
		const original = sha256(databasePath);
		assert.throws(() => withSQLiteSnapshot(databasePath, () => assert.fail("Invalid schema accepted")), /Unexpected SQLite schema/u);
		assert.equal(sha256(databasePath), original);
	} finally {
		for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(databasePath + suffix, { force: true }); fs.rmdirSync(directory);
	}
});

test("production dictionary, popup and SQLite sidecars are unchanged after generation", () => {
	for (const [name, hash] of Object.entries(before)) assert.equal(sha256(path.join(sourceDirectory, name)), hash, name);
	for (const [relative, hash] of Object.entries(report.inputHashes)) assert.equal(sha256(path.join(sourceDirectory, "../../..", relative)), hash, relative);
});
