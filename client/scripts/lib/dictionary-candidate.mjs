import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SUBTITLE_WORD_PATTERN } from "../../app/_lib/dictionary/findPreferredLookup.js";

export const clientRoot = fileURLToPath(new URL("../../", import.meta.url));
export const sourceDirectory = path.join(clientRoot, "app/_lib/dictionary");
export const contentDirectory = path.join(clientRoot, "app/[locale]/(main)/dialogue/_data");
export const prototypeDirectory = path.join(clientRoot, "prototypes/dictionary");
export const readJSON = file => JSON.parse(fs.readFileSync(file, "utf8"));
export const normalize = text => text.toLowerCase().trim().replace(/[‘’]/gu, "'")
	.replace(/\s+/gu, " ").replace(/[.,!?;:"()]/gu, "");
export const tokenize = text => [...text.matchAll(SUBTITLE_WORD_PATTERN)];

export function readContentFiles(directory = contentDirectory) {
	return fs.readdirSync(directory, { recursive: true }).filter(file => file.endsWith(".json"))
		.sort().map(file => {
			const data = readJSON(path.join(directory, file));
			if (!Array.isArray(data.dialogue)) throw new Error(`Missing dialogue array: ${file}`);
			return { file: file.replaceAll(path.sep, "/"), lines: data.dialogue };
		});
}

// Equivalent to the live finder, with the dictionary supplied explicitly.
// Keep punctuation barriers and clause-only phrase rules when measuring coverage.
export function createCandidateLookup(candidate) {
	const maxLength = Math.max(1, ...Object.keys(candidate.phrases).map(key => key.split(" ").length));
	return (text, clickedWordIndex) => {
		const words = tokenize(text);
		if (clickedWordIndex < 0 || clickedWordIndex >= words.length) return null;
		for (let length = Math.min(maxLength, words.length); length >= 2; length--) {
			for (let start = Math.max(0, clickedWordIndex - length + 1);
				start <= Math.min(clickedWordIndex, words.length - length); start++) {
				const end = start + length - 1;
				if (!words.slice(start, end).every((word, offset) => /^\s+$/u.test(
					text.slice(word.index + word[0].length, words[start + offset + 1].index)))) continue;
				const endOffset = words[end].index + words[end][0].length;
				const phrase = text.slice(words[start].index, endOffset);
				const entry = candidate.phrases[normalize(phrase)];
				if (!entry) continue;
				const following = text.slice(endOffset).trimStart();
				if (entry.match === "clause" && following && !/^[.!?,;:…]/u.test(following)) continue;
				return { result: { text: phrase, source: "phrase", ...entry }, startWordIndex: start, endWordIndex: end };
			}
		}
		const key = normalize(words[clickedWordIndex][0]);
		// Live lookup also accepts a one-word phrase override.
		const phrase = candidate.phrases[key];
		if (phrase) return { result: { text: key, source: "phrase", ...phrase }, startWordIndex: clickedWordIndex, endWordIndex: clickedWordIndex };
		const lemma = candidate.lemmas[key];
		const entry = candidate.words[key] || candidate.words[lemma];
		return entry ? {
			result: { text: key, source: "word", ...(lemma ? { lemma } : {}), ...entry,
				...(lemma && !candidate.words[key] ? { pron: candidate.formPronunciations?.[key] || [] } : {}) },
			startWordIndex: clickedWordIndex, endWordIndex: clickedWordIndex,
		} : null;
	};
}

// No unchecked stemming at runtime. The generator only considers these bases
// when there is no useful independent entry, and checks the base's POS.
export function morphologyCandidates(word) {
	const result = [];
	if (word.length < 4) return result;
	if (word.endsWith("ies")) result.push([`${word.slice(0, -3)}y`, "plural-or-third-person"]);
	if (word.endsWith("s") && !/(?:ss|us|is)$/u.test(word)) {
		result.push([word.slice(0, -1), "plural-or-third-person"]);
		if (/(?:ches|shes|xes|zes|oes|ses)$/u.test(word)) result.push([word.slice(0, -2), "plural-or-third-person"]);
	}
	if (word.endsWith("ied")) result.push([`${word.slice(0, -3)}y`, "past"]);
	for (const suffix of ["ed", "ing"]) {
		if (!word.endsWith(suffix) || word.length <= suffix.length + 2) continue;
		const stem = word.slice(0, -suffix.length);
		result.push([stem, "verb"], [`${stem}e`, "verb"]);
		if (/([b-df-hj-np-tv-z])\1$/u.test(stem)) result.push([stem.slice(0, -1), "verb"]);
	}
	return [...new Map(result.filter(([base]) => base.length >= 2).map(pair => [pair[0], pair])).values()];
}
