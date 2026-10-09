// Offline evaluation only. No production imports or dictionary files are edited.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { performance } from "node:perf_hooks";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { findPreferredLookup } from "../app/_lib/dictionary/findPreferredLookup.js";
import { resolveMeaning } from "../app/_lib/dictionary/resolveMeaning.js";
import { sha256 } from "./build-dictionary-candidate.mjs";
import {
	clientRoot, contentDirectory, sourceDirectory, prototypeDirectory,
	readJSON, normalize, tokenize, readContentFiles, createCandidateLookup,
} from "./lib/dictionary-candidate.mjs";

const percent = (hit, total) => Number((hit / total * 100).toFixed(4));
const markdown = value => String(value ?? "—").replaceAll("|", "\\|").replaceAll("\n", " ");

function popup(lookup, line, word, index) {
	const match = lookup(line.text, index);
	return match ? resolveMeaning({ result: match.result, transcript: line.text, clickedWord: word,
		clickedWordIndex: index, matchedPhrase: match.result.source === "phrase" ? match.result.text : "" }) : null;
}

function summaries(values) {
	const sorted = [...values].sort((a, b) => a - b);
	return { medianMs: sorted[Math.floor(sorted.length / 2)], p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1] };
}

function measurements(candidatePath, rows, candidateLookup) {
	const baselineFiles = ["dictionary-v3.json", "lemma-map.json", "phrases.json"].map(file => path.join(sourceDirectory, file));
	const variants = { baseline: baselineFiles, candidate: [candidatePath] };
	const result = { environment: { node: process.version, platform: process.platform, arch: process.arch },
		method: "30 JSON-parse samples after 5 warmups; 20 complete corpus popup passes after 3 warmups; local Node only; no browser/bundler/network timing.",
	};
	for (const [name, files] of Object.entries(variants)) {
		const buffers = files.map(file => fs.readFileSync(file));
		const texts = buffers.map(buffer => buffer.toString("utf8"));
		const times = [];
		let parsed;
		for (let sample = 0; sample < 35; sample++) {
			const start = performance.now();
			parsed = texts.map(text => JSON.parse(text));
			if (sample >= 5) times.push(performance.now() - start);
		}
		assert(parsed.length);
		const child = spawnSync(process.execPath, ["--expose-gc", "--input-type=module", "-e", `
			import fs from 'node:fs';
			const texts = process.argv.slice(1).map(file => fs.readFileSync(file, 'utf8'));
			global.gc(); const before = process.memoryUsage().heapUsed;
			const values = texts.map(text => JSON.parse(text)); global.gc();
			console.log(JSON.stringify({retainedHeapBytes:process.memoryUsage().heapUsed-before,objects:values.length}));
		`, ...files], { encoding: "utf8" });
		assert.equal(child.status, 0, child.stderr);
		const lookup = name === "baseline" ? findPreferredLookup : candidateLookup;
		const passes = [];
		let hits = 0;
		for (let pass = 0; pass < 23; pass++) {
			const start = performance.now();
			for (const row of rows) if (popup(lookup, { text: row.sentence }, row.word, row.wordIndex)?.displayMeaning) hits++;
			if (pass >= 3) passes.push(performance.now() - start);
		}
		assert(hits);
		const timing = summaries(passes);
		result[name] = {
			files: files.map(file => path.relative(clientRoot, file).replaceAll(path.sep, "/")),
			bytes: buffers.reduce((n, buffer) => n + buffer.length, 0),
			gzipBytes: buffers.reduce((n, buffer) => n + gzipSync(buffer).length, 0),
			parse: summaries(times), heap: JSON.parse(child.stdout),
			popupCorpusPass: timing, medianMicrosecondsPerClick: timing.medianMs * 1000 / rows.length,
		};
	}
	result.baselineV3OnlyBytes = fs.statSync(path.join(sourceDirectory, "dictionary-v3.json")).size;
	return result;
}

export function evaluateCandidate({ benchmarkOnly = false } = {}) {
	const candidatePath = path.join(prototypeDirectory, "dictionary-candidate.json");
	const candidate = readJSON(candidatePath);
	const build = readJSON(path.join(prototypeDirectory, "build-review.json"));
	assert.equal(sha256(candidatePath), build.candidateSHA256, "Candidate changed; regenerate its review evidence.");
	for (const [file, hash] of Object.entries(build.inputHashes)) assert.equal(sha256(path.join(clientRoot, file)), hash, `Stale input: ${file}; rebuild before evaluation.`);
	const files = readJSON(path.join(prototypeDirectory, "benchmark-files.json"));
	assert.equal(files.length, 24, "The comparison sample must keep its original 24 files.");
	assert.equal(new Set(files).size, files.length);
	const lookup = createCandidateLookup(candidate);
	const rows = [], byFile = [], missing = { baseline: new Map(), candidate: new Map() };
	const speakerNames = new Set(readContentFiles().flatMap(({ lines }) => lines.flatMap(line => tokenize(line.speaker || "").map(word => normalize(word[0])))));
	let baselineHit = 0, candidateHit = 0, gains = 0;
	const regressions = [];
	for (const file of files) {
		assert(!file.includes("..") && !path.isAbsolute(file), "Invalid corpus path");
		const data = readJSON(path.join(contentDirectory, file));
		const counts = { file, occurrences: 0, baselineHit: 0, candidateHit: 0 };
		for (const [lineIndex, line] of data.dialogue.entries()) {
			for (const [wordIndex, token] of tokenize(line.text).entries()) {
				const word = token[0], key = normalize(word);
				const current = popup(findPreferredLookup, line, word, wordIndex);
				const proposed = popup(lookup, line, word, wordIndex);
				const hasCurrent = Boolean(current?.displayMeaning), hasProposed = Boolean(proposed?.displayMeaning);
				const lemma = candidate.lemmas[key];
				const evidence = build.selection[lemma || key];
				const flags = proposed?.source === "phrase"
					? ["Existing phrase override retained; sentence fit still needs review."]
					: [...(evidence?.flags || []), ...(build.lemmaEvidence[key]?.flags || [])];
				if (speakerNames.has(key)) flags.push("Possible character name: a dictionary gloss may be inappropriate even if this click is covered.");
				if (!hasProposed) flags.push("Missing; no translation invented.");
				if (hasCurrent && hasProposed && current.displayMeaning === proposed.displayMeaning) flags.push("Unchanged availability is not evidence of correctness.");
				const row = { file, line: lineIndex + 1, lineId: line.id ?? null, sentence: line.text,
					sentenceTranslation: line.translation || null, word, wordIndex, lemma: lemma || null,
					currentLookupText: current?.text || null, proposedLookupText: proposed?.text || null,
					current: current?.displayMeaning || null, proposed: proposed?.displayMeaning || null,
					currentAlternatives: current?.alternativeMeanings || [], proposedAlternatives: proposed?.alternativeMeanings || [],
					method: proposed?.source === "phrase" ? "preserved-phrase" : build.lemmaEvidence[key] ? "lemma" : evidence?.method || "missing",
					flags, humanDecision: "PENDING" };
				rows.push(row); counts.occurrences++;
				if (hasCurrent) { baselineHit++; counts.baselineHit++; }
				if (hasProposed) { candidateHit++; counts.candidateHit++; }
				if (!hasCurrent && hasProposed) gains++;
				if (hasCurrent && !hasProposed) regressions.push(row);
				for (const [variant, covered] of [["baseline", hasCurrent], ["candidate", hasProposed]]) {
					if (covered) continue;
					if (!missing[variant].has(key)) missing[variant].set(key, { word: key, occurrences: 0, files: new Set() });
					const item = missing[variant].get(key); item.occurrences++; item.files.add(file);
				}
			}
		}
		byFile.push(counts);
	}
	assert.equal(rows.length, 1862, "Corpus changed; do not silently compare a different denominator.");
	// Baseline is measured from current working-tree code, never hard-coded.
	const baselineReproduced = baselineHit === 1202;
	const missingWords = Object.fromEntries(Object.entries(missing).map(([variant, words]) => [variant,
		[...words.values()].map(item => ({ ...item, files: [...item.files].sort() })).sort((a, b) => b.occurrences - a.occurrences || a.word.localeCompare(b.word))]));
	const examples = [];
	const wordUseCounts = new Map();
	for (const file of files) {
		const candidates = rows.filter(row => row.file === file);
		const selectedSentences = new Set(), selectedWords = new Set();
		const priority = row => (!row.current && row.proposed ? 40 : row.current !== row.proposed ? 30 : 0)
			+ (row.method === "sqlite-ranked" ? 12 : row.method === "lemma" ? 10 : row.method === "proposed-editorial" ? 8 : 0)
			+ (row.method === "proposed-editorial" && row.current && row.current !== row.proposed ? 45 : 0)
			+ (row.flags.some(flag => /correct|wrong|reject/iu.test(flag)) ? 20 : 0)
			+ (!row.proposed ? 25 : 0) + (row.flags.some(flag => flag.includes("character name")) ? 15 : 0);
		const predicates = [row => row.method === "sqlite-ranked" || row.method === "lemma",
			row => row.method === "proposed-editorial" && row.current !== row.proposed, row => !row.proposed || row.flags.some(flag => flag.includes("character name")),
			row => row.current && row.current === row.proposed];
		for (const predicate of predicates) {
			const ranked = [...candidates].sort((a, b) => priority(b) - priority(a) || a.line - b.line || a.wordIndex - b.wordIndex);
			const available = ranked.filter(row => !selectedSentences.has(row.sentence) && !selectedWords.has(normalize(row.word)));
			const varied = available.filter(row => (wordUseCounts.get(normalize(row.word)) || 0) < 2);
			const row = varied.find(predicate) || available.find(predicate) || varied[0] || available[0];
			assert(row, `Insufficient independent sentences in ${file}`);
			selectedSentences.add(row.sentence); selectedWords.add(normalize(row.word)); examples.push(row);
			wordUseCounts.set(normalize(row.word), (wordUseCounts.get(normalize(row.word)) || 0) + 1);
		}
	}
	const report = {
		status: "Ready for human review; not approved for production integration.",
		corpus: { files, fileCount: files.length, occurrences: rows.length,
			tokenizer: "Live SUBTITLE_WORD_PATTERN; contractions and hyphenated words count as one; digits excluded.",
			fingerprint: createHash("sha256").update(JSON.stringify(files.map(file => ({ file, sha256: sha256(path.join(contentDirectory, file)) })))).digest("hex") },
		baseline: { hit: baselineHit, total: rows.length, coveragePercent: percent(baselineHit, rows.length), missingOccurrences: rows.length - baselineHit,
			uniqueMissing: missingWords.baseline.length, historicalBaselinePercent: 64.55, historicalBaselineReproduced: baselineReproduced },
		candidate: { hit: candidateHit, total: rows.length, coveragePercent: percent(candidateHit, rows.length), missingOccurrences: rows.length - candidateHit,
			uniqueMissing: missingWords.candidate.length, words: build.exportedWords, lemmas: build.exportedLemmas, phrases: build.exportedPhrases, methods: build.methods },
		improvementPercentagePoints: percent(candidateHit - baselineHit, rows.length), newlyCoveredOccurrences: gains,
		regressions, byFile, missingWords, exampleCount: examples.length, examples,
		candidateSHA256: build.candidateSHA256, humanReviewedExamples: 0,
	};
	if (!benchmarkOnly) report.performance = measurements(candidatePath, rows, lookup);
	return report;
}

export function renderReview(report) {
	const p = report.performance;
	const lines = ["# StudyJony dictionary candidate review", "",
		"**Ready for further human review. Not ready to replace production.** No example has been approved by a human.", "",
		"## Coverage", "", "Coverage means a clicked subtitle token returns a nonempty popup meaning. It does not measure meaning accuracy.", "",
		"| Metric | Current popup | Candidate |", "| --- | ---: | ---: |",
		`| Covered occurrences | ${report.baseline.hit}/${report.baseline.total} | ${report.candidate.hit}/${report.candidate.total} |`,
		`| Coverage | ${report.baseline.coveragePercent.toFixed(2)}% | ${report.candidate.coveragePercent.toFixed(2)}% |`,
		`| Missing occurrences | ${report.baseline.missingOccurrences} | ${report.candidate.missingOccurrences} |`,
		`| Unique missing words | ${report.baseline.uniqueMissing} | ${report.candidate.uniqueMissing} |`, "",
		`Gain: ${report.improvementPercentagePoints.toFixed(2)} percentage points; ${report.newlyCoveredOccurrences} newly covered clicks; ${report.regressions.length} coverage regressions.`, "",
		`Historical 64.55% baseline reproduced: **${report.baseline.historicalBaselineReproduced ? "yes" : "NO — current inputs differ"}**.`, "",
		"The fixed corpus is 20 dialogue JSON files plus four Story JSON files enabled in the current course registry. It excludes the four disabled hotel files and older JS courses from the comparison denominator. Generation also reads those other existing files for vocabulary. The full file list and content fingerprint are in evaluation.json and benchmark-files.json.", "",
		"Phrase matching uses the existing longest-phrase priority, whitespace boundaries, and clause restrictions. The current meaning resolver is used for both variants, including its context rules. Counts include function words, contractions, character names, and every repeated occurrence. Tasks and Vietnamese translations are excluded.", "",
		"## Offline file and local performance", "",
		"| Metric | Current runtime data (v3 + lemmas + phrases) | Candidate package |", "| --- | ---: | ---: |",
		`| Raw bytes | ${p.baseline.bytes.toLocaleString("en")} | ${p.candidate.bytes.toLocaleString("en")} |`,
		`| Gzip bytes | ${p.baseline.gzipBytes.toLocaleString("en")} | ${p.candidate.gzipBytes.toLocaleString("en")} |`,
		`| JSON parse median / p95 (ms) | ${p.baseline.parse.medianMs.toFixed(3)} / ${p.baseline.parse.p95Ms.toFixed(3)} | ${p.candidate.parse.medianMs.toFixed(3)} / ${p.candidate.parse.p95Ms.toFixed(3)} |`,
		`| Retained parsed heap in isolated process (bytes) | ${p.baseline.heap.retainedHeapBytes.toLocaleString("en")} | ${p.candidate.heap.retainedHeapBytes.toLocaleString("en")} |`,
		`| Popup median per click (microseconds) | ${p.baseline.medianMicrosecondsPerClick.toFixed(2)} | ${p.candidate.medianMicrosecondsPerClick.toFixed(2)} |`, "",
		`Production dictionary-v3.json alone: ${p.baselineV3OnlyBytes.toLocaleString("en")} bytes. Candidate contains ${report.candidate.words} words, ${report.candidate.lemmas} explicit lemma aliases, and ${report.candidate.phrases} preserved phrases. It is a learner subset, not an export of all 104,829 SQLite headwords.`, "",
		`Method: ${p.method} Environment: ${p.environment.node}, ${p.environment.platform}, ${p.environment.arch}. Heap measurement is one isolated run; timing varies with machine load. These figures do not establish browser startup, mobile memory, or interaction speed. The existing Node SQLite experimental warning is expected.`, "",
		"## Missing words", "", "| Candidate word | Occurrences | Source files |", "| --- | ---: | --- |",
		...report.missingWords.candidate.map(item => `| ${markdown(item.word)} | ${item.occurrences} | ${markdown(item.files.join(", "))} |`), "",
		"All baseline missing words and counts are listed in evaluation.json. Missing names are kept missing rather than assigned invented Vietnamese meanings.", "",
		"## Remaining weaknesses and review work", "",
		"- SQLite ranking is a heuristic, not a verified translation-quality score. Every newly ranked sense is flagged. Specialist/archaic/reference filtering can miss bad senses or remove useful ones.",
		"- Retained v3 meanings can still be wrong in context. Examples include broad verbs, prepositions, polysemy, and character names that collide with ordinary headwords. Existing translations were preserved unless an explicit proposed correction is recorded.",
		"- Proposed editorial pronoun, contraction, and grammar glosses need human decisions. Forms such as I'd, it's, and what's can expand in different ways; a standalone gloss is only a guide. Auxiliaries/articles often have no separate Vietnamese translation.",
		"- Lemma aliases share base meanings without expressing every tense, aspect, or POS distinction. Own source IPA is used for inflections; missing IPA stays empty. SQLite and v3 IPA are unverified and may contain synthesized or imperfect pronunciations.",
		"- Only existing phrase overrides are enabled. This prototype does not automatically turn every SQLite multiword headword into a popup phrase. Arbitrary compounds and possessives remain incomplete.",
		"- The candidate was tuned using this small corpus. It is not an independent held-out evaluation or a claim of full beginner/English coverage. Test more courses and fresh sentences before integration.",
		"- Human reviewers should accept/correct/reject each proposed meaning using the full sentence and existing sentence translation. Then check flagged entries outside the sample, resolve names and ambiguity, and run browser/mobile trials in a separate integration change.", "",
		"## 96 sentence examples for human review", "",
		"Four separate sentences from each content file; stratified toward new SQLite/lemma coverage, proposed changes, names/missing words, and unchanged meanings. This is a review sample, not a statistical accuracy estimate. Word index is zero-based, so repeated words can be located. Phrase text is shown when the popup selects a phrase. Sentence translations in evaluation.json are existing content references, not independent validation.", "",
		"| # | File : line / word index | Real English sentence | Click → popup text | Current Vietnamese | Proposed Vietnamese | Review reason | Human decision |",
		"| --- | --- | --- | --- | --- | --- | --- | --- |",
		...report.examples.map((row, index) => `| ${index + 1} | ${markdown(`${row.file}:${row.line} / ${row.wordIndex}`)} | ${markdown(row.sentence)} | ${markdown(`${row.word} → ${row.proposedLookupText || row.currentLookupText || "missing"}${row.lemma ? ` (base: ${row.lemma})` : ""}`)} | ${markdown(row.current)} | ${markdown(row.proposed)} | ${markdown([row.method, ...row.flags].join("; "))} | PENDING |`), "",
		"## Licensing and production protection", "",
		"Data remains [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Credits and the unchanged upstream notices are in ATTRIBUTION.md and LICENSE, with the derivative change notice in README.md. [Skypedia upstream attribution](https://github.com/skypediacode/english-vietnamese-dictionary/blob/main/ATTRIBUTION.md) includes MinhQND and the underlying resources. Existing production attribution is unchanged.", "",
		"The generator only writes this prototype folder. Input SHA-256 hashes are stored in build-review.json and checked before evaluation. The SQLite source is copied to a disposable directory, preserving original DB/WAL/SHM files. Production dictionary-v3.json, popup code, and existing uncommitted edits are untouched. Tests check generator determinism, ranking order independence, lemma safeguards, phrase parity, no coverage regressions, licensing metadata, and protected inputs.", "",
		"Reproduce: node client/scripts/build-dictionary-candidate.mjs; node client/scripts/evaluate-dictionary-candidate.mjs; node --test client/scripts/tests/integration/dictionary-candidate.test.mjs.", ""];
	return lines.join("\n");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	const report = evaluateCandidate();
	fs.writeFileSync(path.join(prototypeDirectory, "evaluation.json"), JSON.stringify(report, null, 2) + "\n");
	fs.writeFileSync(path.join(prototypeDirectory, "review-report.md"), renderReview(report));
	console.log(JSON.stringify({ baseline: report.baseline, candidate: report.candidate,
		regressions: report.regressions.length, examples: report.exampleCount, performance: report.performance }, null, 2));
}
