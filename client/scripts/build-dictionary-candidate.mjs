// Node 22.13+: reads production inputs, writes ONLY prototypes/dictionary.
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { rankSenses, rejectionReason } from "./extract-dictionary-v2.mjs";
import {
	clientRoot, contentDirectory, sourceDirectory, prototypeDirectory,
	readJSON, readContentFiles, normalize, tokenize, morphologyCandidates,
} from "./lib/dictionary-candidate.mjs";

const posCodes = { noun: "n", verb: "v", adjective: "adj", adverb: "adv", preposition: "prep", pronoun: "pron", conjunction: "conj", interjection: "interj", number: "num", word: "word" };
const grammarReference = /^(?:số nhiều|quá khứ|phân từ|hiện tại phân từ|động từ chia|động từ quá khứ|đồng từ quá khứ|dạng |ngôi |so sánh hơn|so sánh nhất|cấp so sánh|xem\s|như\s|dùng như\s)/iu;
const irregular = {
	am: "be", is: "be", are: "be", was: "be", were: "be", been: "be", being: "be",
	has: "have", had: "have", does: "do", did: "do", done: "do", went: "go", gone: "go",
	came: "come", bought: "buy", brought: "bring", took: "take", taken: "take", made: "make",
	said: "say", told: "tell", felt: "feel", knew: "know", known: "know", saw: "see", seen: "see",
	ran: "run", eaten: "eat", ate: "eat", drank: "drink", drunk: "drink", wrote: "write",
	written: "write", gave: "give", given: "give", found: "find", got: "get", gotten: "get",
	kept: "keep", slept: "sleep", spoke: "speak", spoken: "speak", sold: "sell", thought: "think",
	children: "child", men: "man", women: "woman", feet: "foot", teeth: "tooth", mice: "mouse",
};
const ambiguousForms = new Set(["saw", "found", "left", "rose", "fell", "lying", "better", "worse", "drunk"]);
const contextWords = new Set("a an the be am is are was were do does did have has had get take right like mean book free stay can will would could may might should must that this these those of to for on at in as with you she they it we us helping".split(" "));
const beginnerWords = `hello hi bye please thanks yes no okay alright sorry welcome name age person people child family father mother parent brother sister friend man woman boy girl baby home house room door window bed table chair kitchen bathroom school teacher student lesson book pen pencil paper bag food water milk bread rice egg meat fish chicken fruit apple banana orange vegetable lettuce noodle noodles coffee tea sugar salt breakfast lunch dinner shop store market money price buy sell pay work job office computer phone email internet wifi cafe luggage bus train car taxi bike road street station airport hotel park bank hospital left right near far here there now today tomorrow yesterday morning afternoon evening night day week month year time hour minute one two three four five six seven eight nine ten first second last new old good bad big small hot cold warm cool happy sad tired hungry thirsty easy hard clean dirty open close start stop help learn study read write listen speak say tell ask answer know understand want need like love walk run go come see look watch sit stand sleep eat drink make cook wash give bring take find put keep use play meet wait live stay this that these those the you she they we them your their our its why how what when where whose which always often sometimes never again together enough ready sure great nice well much many little few more most some any all each every both another other`.split(/\s+/u);

export const sha256 = file => createHash("sha256").update(fs.readFileSync(file)).digest("hex");

function usefulV3(entry) {
	return entry && typeof entry.primaryMeaning === "string" && entry.primaryMeaning.trim()
		&& !grammarReference.test(entry.primaryMeaning)
		&& !/[{}<>�]|https?:/u.test(entry.primaryMeaning)
		&& !/^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+$/u.test(entry.primaryMeaning);
}

function compactV3(entry) {
	return { pos: entry.pos || [], pron: entry.pron || [], primaryMeaning: entry.primaryMeaning, meanings: entry.meanings || [] };
}

export function withSQLiteSnapshot(databasePath, action) {
	assert(!fs.existsSync(`${databasePath}-wal`) || fs.statSync(`${databasePath}-wal`).size === 0,
		"Source has pending WAL data; provide a settled database snapshot, without checkpointing production.");
	const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "studyjony-candidate-"));
	const snapshot = path.join(temporary, "source.db");
	let db;
	try {
		fs.copyFileSync(databasePath, snapshot);
		db = new DatabaseSync(snapshot, { readOnly: true });
		for (const [table, columns] of Object.entries({
			words: ["id", "word", "lang_code"], definitions: ["id", "definition", "pos", "definition_lang"],
			word_definitions: ["word_id", "definition_id"], pronunciations: ["word_id", "ipa"],
		})) {
			const actual = db.prepare(`PRAGMA table_info(${table})`).all().map(row => row.name);
			assert(columns.every(column => actual.includes(column)), `Unexpected SQLite schema: ${table}`);
		}
		return action(db);
	} finally {
		db?.close();
		// Explicit files in our own temporary directory, never a recursive delete.
		for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(snapshot + suffix, { force: true });
		fs.rmdirSync(temporary);
	}
}

function referenceTarget(rows) {
	for (const row of rows) {
		if (!grammarReference.test(row.definition)) continue;
		const target = row.definition.match(/(?:của\s+|^(?:xem|như|dùng như)\s+)([\p{L}]+(?:[ '-][\p{L}]+)*)/iu)?.[1];
		if (target) return normalize(target);
	}
	return null;
}

// Static string literals in older JS course data contribute vocabulary only.
// They are not part of the fixed 24-file evaluation denominator.
function supplementaryVocabulary() {
	const words = new Set();
	const files = [];
	for (const relative of fs.readdirSync(contentDirectory, { recursive: true }).sort()) {
		if (!relative.endsWith(".js")) continue;
		const file = path.join(contentDirectory, relative);
		const literals = [...fs.readFileSync(file, "utf8").matchAll(/\btext:\s*("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')/gu)];
		if (!literals.length) continue;
		files.push(file);
		for (const match of literals) {
			const text = vm.runInNewContext(match[1], Object.create(null), { timeout: 100 });
			for (const word of tokenize(text)) words.add(normalize(word[0]));
		}
	}
	return { words, files };
}

export function buildCandidate() {
	const databasePath = path.join(sourceDirectory, "dictionary_en_vi.db");
	const v3Path = path.join(sourceDirectory, "dictionary-v3.json");
	const phrasesPath = path.join(sourceDirectory, "phrases.json");
	const hintPath = path.join(sourceDirectory, "lemma-map.json");
	const overridesPath = path.join(prototypeDirectory, "editorial-overrides.json");
	const v3 = readJSON(v3Path), phrases = readJSON(phrasesPath), hints = readJSON(hintPath);
	const editorial = readJSON(overridesPath);
	const content = readContentFiles();
	const additional = supplementaryVocabulary();
	const frequencyFiles = [1, 2, 3, 4].map(n => path.join(sourceDirectory, `freq-tier1-0${n}.jsonl`));
	const cleanedPath = path.join(sourceDirectory, "dictionary.cleaned.json");
	const vocabulary = new Set([...Object.keys(v3), ...Object.keys(readJSON(cleanedPath)),
		...beginnerWords, ...Object.keys(editorial), ...Object.keys(hints), ...Object.values(irregular), ...Object.keys(irregular), ...additional.words]);
	for (const file of frequencyFiles) {
		for (const line of fs.readFileSync(file, "utf8").replace(/^\uFEFF/u, "").split(/\r?\n/u).filter(line => line.trim())) {
			vocabulary.add(JSON.parse(line).headword);
		}
	}
	for (const { lines } of content) for (const line of lines) for (const word of tokenize(line.text)) vocabulary.add(normalize(word[0]));
	const sourceFiles = [databasePath, v3Path, phrasesPath, hintPath, cleanedPath, overridesPath, ...frequencyFiles,
		...content.map(({ file }) => path.join(contentDirectory, file)), ...additional.files,
		path.join(clientRoot, "scripts/extract-dictionary-v2.mjs"),
		fileURLToPath(import.meta.url), path.join(clientRoot, "scripts/lib/dictionary-candidate.mjs"),
		path.join(sourceDirectory, "findPreferredLookup.js"), path.join(sourceDirectory, "lookupWord.js"),
		path.join(sourceDirectory, "resolveMeaning.js")];
	const inputHashes = Object.fromEntries(sourceFiles.map(file => [path.relative(clientRoot, file).replaceAll(path.sep, "/"), sha256(file)]));
	const report = {
		inputHashes, sqliteHeadwords: 0, requestedHeadwords: vocabulary.size, methods: {},
		selection: {}, lemmaEvidence: {}, missing: [], excluded: [], supplementaryFiles: additional.files.map(file => path.relative(clientRoot, file).replaceAll(path.sep, "/")),
		humanApproved: false, policy: "Coverage is availability only. Every new automatic sense and proposed editorial gloss needs human review.",
	};
	const candidate = withSQLiteSnapshot(databasePath, db => {
		report.sqliteHeadwords = db.prepare("SELECT count(*) AS n FROM words WHERE lang_code='en'").get().n;
		const findRows = db.prepare(`SELECT d.id AS definitionId, d.definition, d.pos FROM words w
			JOIN word_definitions wd ON wd.word_id=w.id JOIN definitions d ON d.id=wd.definition_id
			WHERE w.word=? AND w.lang_code='en' AND d.definition_lang='vi'`);
		const findPron = db.prepare("SELECT DISTINCT p.ipa FROM words w JOIN pronunciations p ON p.word_id=w.id WHERE w.word=? AND w.lang_code='en' ORDER BY p.ipa");
		const rowsCache = new Map();
		const rowsFor = word => {
			if (!rowsCache.has(word)) rowsCache.set(word, findRows.all(word));
			return rowsCache.get(word);
		};
		// Add supported base candidates before selection so aliases cannot dangle.
		for (const word of [...vocabulary]) {
			if (hints[word]) vocabulary.add(hints[word]);
			const reference = referenceTarget(rowsFor(word));
			if (reference) vocabulary.add(reference);
			for (const [base] of morphologyCandidates(word)) if (rowsFor(base).length) vocabulary.add(base);
		}
		const words = {}, lemmas = {}, formPronunciations = {};
		for (const word of [...vocabulary].sort()) {
			if (word !== normalize(word) || !/^[a-z]+(?:[' -][a-z]+)*$/u.test(word)) {
				report.excluded.push({ word, reason: "Not a normalized English learner headword" }); continue;
			}
			const rows = rowsFor(word);
			const flags = [];
			let entry, method, selectedSources = [];
			if (editorial[word]) {
				const { reason, ...edited } = editorial[word];
				entry = { ...edited, pron: v3[word]?.pron || findPron.all(word).map(row => row.ipa) };
				method = "proposed-editorial";
				flags.push(reason, "Proposed edit; not human-approved.");
			} else if (usefulV3(v3[word])) {
				entry = compactV3(v3[word]); method = "preserved-v3";
			} else {
				// No database order or first definition decides the winning sense.
				const selected = rankSenses(rows, "word", "");
				if (selected.length) {
					entry = { pos: [...new Set(selected.map(sense => posCodes[sense.type] || sense.type))],
						pron: findPron.all(word).map(row => row.ipa), primaryMeaning: selected[0].text,
						meanings: selected.slice(1).map(sense => sense.text) };
					method = "sqlite-ranked";
					selectedSources = selected.map(sense => ({ selectedGloss: sense.text, pos: sense.type,
						sources: rows.filter(row => row.definition.normalize("NFC").toLocaleLowerCase("vi").replace(/\s+/gu, " ").replace(/^[\s,;:.]+|[\s,;:.]+$/gu, "").trim() === sense.sourceKey)
							.map(row => ({ definitionId: row.definitionId, definition: row.definition, pos: row.pos })) }));
					flags.push("Automatically ranked SQLite senses; learner usefulness and accuracy are unverified.");
					if (new Set(rows.filter(row => !rejectionReason(row)).map(row => row.definition)).size > 1) flags.push("Multiple source senses; primary meaning may not fit this sentence.");
				}
			}
			if (!entry) continue;
			if (contextWords.has(word) || entry.meanings.length || word.includes("'")) flags.push("Meaning depends on sentence context.");
			if (!entry.pron.length) flags.push("No source pronunciation; none invented.");
			words[word] = entry;
			report.selection[word] = { method, flags, humanApproved: false,
				sourceSenseCount: rows.length, rejectedSenseCount: rows.filter(rejectionReason).length, selectedSources };
			report.methods[method] = (report.methods[method] || 0) + 1;
		}
		for (const word of [...vocabulary].sort()) {
			if (word !== normalize(word) || !/^[a-z]+(?:['-][a-z]+)*$/u.test(word)) continue;
			const rows = rowsFor(word);
			const reference = referenceTarget(rows);
			const bases = [[irregular[word], "explicit-irregular"], [reference, "source-reference"],
				[hints[word], "existing-hint"], ...morphologyCandidates(word)];
			const base = bases.find(([target, evidence]) => {
				if (!target || target === word || !words[target]) return false;
				if (evidence === "explicit-irregular") return true;
				if (words[word]) return false; // Never strip an independent lexical entry.
				if (evidence === "source-reference") return true;
				const permitted = evidence === "plural-or-third-person" ? ["n", "v"] : ["v"];
				return words[target].pos.some(pos => permitted.includes(pos));
			});
			if (!base) continue;
			const [target, evidence] = base;
			// Retain independent editorial/v3 senses on ambiguous forms and be/do.
			if (words[word] && (ambiguousForms.has(word) || editorial[word])) continue;
			if (words[word] && !grammarReference.test(v3[word]?.primaryMeaning || "")
				&& !rows.every(row => grammarReference.test(row.definition))) continue;
			if (words[word]) { report.methods[report.selection[word].method]--; delete words[word]; }
			lemmas[word] = target;
			// An inflection may share meanings, but never its lemma's IPA.
			formPronunciations[word] = findPron.all(word).map(row => row.ipa);
			report.lemmaEvidence[word] = { lemma: target, evidence, sourceReference: reference,
				flags: ["Inflected form shares the base meanings; tense, POS, and sentence fit need human review."], humanApproved: false };
			delete report.selection[word];
		}
		for (const word of [...vocabulary].sort()) {
			if (words[word] || lemmas[word] || report.excluded.some(item => item.word === word)) continue;
			report.missing.push({ word, sourceSenseCount: rowsFor(word).length,
				reason: rowsFor(word).length ? "No usable sense or supported lemma after filtering" : "Not in SQLite/v3/editorial vocabulary" });
		}
		return {
			metadata: { format: "studyjony-dictionary-candidate-1", status: "prototype-needs-human-review",
				license: "CC-BY-SA-4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
				attribution: "Skypedia; MinhQND and upstream resources; StudyJony learner edits. See ATTRIBUTION.md and README.md.",
				sourceDatabaseSHA256: inputHashes["app/_lib/dictionary/dictionary_en_vi.db"] },
			words, lemmas, formPronunciations, phrases,
		};
	});
	for (const file of sourceFiles) assert.equal(sha256(file), inputHashes[path.relative(clientRoot, file).replaceAll(path.sep, "/")], `Input changed during generation: ${file}`);
	for (const [word, lemma] of Object.entries(candidate.lemmas)) assert(candidate.words[lemma] && word !== lemma && !candidate.words[word], `Invalid lemma: ${word}`);
	report.exportedWords = Object.keys(candidate.words).length;
	report.exportedLemmas = Object.keys(candidate.lemmas).length;
	report.exportedPhrases = Object.keys(candidate.phrases).length;
	report.candidateSHA256 = createHash("sha256").update(JSON.stringify(candidate) + "\n").digest("hex");
	return { candidate, report };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const { candidate, report } = buildCandidate();
	fs.writeFileSync(path.join(prototypeDirectory, "dictionary-candidate.json"), JSON.stringify(candidate) + "\n");
	fs.writeFileSync(path.join(prototypeDirectory, "build-review.json"), JSON.stringify(report, null, 2) + "\n");
	console.log(JSON.stringify({ words: report.exportedWords, lemmas: report.exportedLemmas, phrases: report.exportedPhrases,
		methods: report.methods, unresolved: report.missing.length, bytes: fs.statSync(path.join(prototypeDirectory, "dictionary-candidate.json")).size }, null, 2));
}
