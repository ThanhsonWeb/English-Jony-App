import { lookupWord, maxPhraseWords } from "./lookupWord.js";

export const SUBTITLE_WORD_PATTERN = /([A-Za-z]+(?:['’\-][A-Za-z]+)*)/g;
export const SUBTITLE_WORD_TOKEN_PATTERN = /^[A-Za-z]+(?:['’\-][A-Za-z]+)*$/;

export function findPreferredLookup(text, clickedWordIndex) {
	const words = [...text.matchAll(SUBTITLE_WORD_PATTERN)];
	if (clickedWordIndex < 0 || clickedWordIndex >= words.length) return null;

	for (let length = Math.min(maxPhraseWords, words.length); length >= 2; length -= 1) {
		const firstStart = Math.max(0, clickedWordIndex - length + 1);
		const lastStart = Math.min(clickedWordIndex, words.length - length);
		for (let start = firstStart; start <= lastStart; start += 1) {
			const end = start + length - 1;
			const hasOnlySpacesBetweenWords = words.slice(start, end).every((word, offset) => {
				const next = words[start + offset + 1];
				return /^\s+$/u.test(text.slice(word.index + word[0].length, next.index));
			});
			if (!hasOnlySpacesBetweenWords) continue;

			const endOffset = words[end].index + words[end][0].length;
			const phrase = text.slice(words[start].index, endOffset);
			const result = lookupWord(phrase);
			if (result?.source !== "phrase") continue;
			const following = text.slice(endOffset).trimStart();
			if (result.match === "clause" && following && !/^[.!?,;:…]/u.test(following)) continue;

			return {
				result: { ...result, text: phrase },
				startWordIndex: start,
				endWordIndex: end,
			};
		}
	}

	const result = lookupWord(words[clickedWordIndex][0]);
	return result
		? {
				result,
				startWordIndex: clickedWordIndex,
				endWordIndex: clickedWordIndex,
			}
		: null;
}
