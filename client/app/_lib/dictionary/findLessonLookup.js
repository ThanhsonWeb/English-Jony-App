import { lessonGlossaries } from "./lessonGlossaries.js";
import { findPreferredLookup, SUBTITLE_WORD_PATTERN } from "./findPreferredLookup.js";
import { lookupWord } from "./lookupWord.js";
import { resolveMeaning } from "./resolveMeaning.js";
import { phraseMatchesText } from "./validateLessonGlossary.js";

// Exact line IDs, text and speaker prevent stale or unrelated occurrence maps
// from being applied. Offsets use the same tokenizer as the subtitle buttons.
export function findContextualLookup(glossary, line, clickedWordIndex, preferPhrase = true) {
	const context = glossary?.lines?.[line?.id];
	if (!context || context.text !== line.text || context.speaker !== line.speaker
		|| context.translation !== line.translation) return null;
	const words = [...line.text.matchAll(SUBTITLE_WORD_PATTERN)];
	if (!Number.isInteger(clickedWordIndex) || clickedWordIndex < 0 || clickedWordIndex >= words.length) return null;
	if (context.tokens?.length !== words.length || context.tokens.some((token, index) => token !== words[index][0])) return null;
	const wordEntry = glossary.entries[context.words?.[clickedWordIndex]];
	if (wordEntry && wordEntry.word !== words[clickedWordIndex][0].toLowerCase()) return null;

	const phrases = (context.phrases || []).filter(phrase =>
		preferPhrase && phraseMatchesText(phrase, line.text, words)
		&& phrase.start <= clickedWordIndex && clickedWordIndex <= phrase.end
		&& glossary.entries[phrase.entry]?.meaning?.trim())
		.sort((a, b) => (b.end - b.start) - (a.end - a.start) || a.start - b.start);
	const phrase = phrases[0];
	const start = phrase?.start ?? clickedWordIndex;
	const end = phrase?.end ?? clickedWordIndex;
	const entry = glossary.entries[phrase?.entry ?? context.words?.[clickedWordIndex]];
	if (!entry?.meaning?.trim()) return null;

	const text = line.text.slice(words[start].index, words[end].index + words[end][0].length);
	const existing = lookupWord(text);
	return {
		startWordIndex: start,
		endWordIndex: end,
		...(phrase ? { wordLookup: findContextualLookup(glossary, line, clickedWordIndex, false) } : {}),
		result: {
			...existing,
			text,
			source: phrase ? "phrase" : "word",
			...(phrase ? { type: "phrase" } : {}),
			pos: entry.pos || existing?.pos || [],
			pron: existing?.pron?.length ? existing.pron : entry.pron || [],
			primaryMeaning: entry.meaning,
			meaning: entry.meaning,
			meanings: [],
			displayMeaning: entry.meaning,
			alternativeMeanings: [],
			contextual: true,
		},
	};
}

export function findLessonLookup({ lessonId, dialogueId, line, clickedWordIndex }) {
	if (!Number.isInteger(clickedWordIndex)) return null;
	const glossary = lessonGlossaries.find(item => item.lessonId === lessonId && item.dialogueId === dialogueId);
	if (glossary) {
		const contextual = findContextualLookup(glossary, line, clickedWordIndex);
		if (contextual) return contextual;
	}

	const lookup = findPreferredLookup(line?.text || "", clickedWordIndex);
	if (!lookup) return null;
	return {
		...lookup,
		result: resolveMeaning({
			result: lookup.result,
			transcript: line?.text,
			clickedWord: lookup.result.text,
			clickedWordIndex,
			matchedPhrase: lookup.result.source === "phrase" ? lookup.result.text : "",
		}),
	};
}
