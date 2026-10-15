import { SUBTITLE_WORD_PATTERN } from "./findPreferredLookup.js";
import { findLessonLookup } from "./findLessonLookup.js";

// A blank is a hard boundary: a lookup may only use words the learner can see.
export function findVisibleDictationLookup({ lessonId, dialogueId, line, parts, answers, partIndex, clickedWordIndex }) {
	const part = parts[partIndex] || "";
	const visible = findLessonLookup({ lessonId, dialogueId, line: { text: part }, clickedWordIndex });
	if (!visible || !line?.text || !Array.isArray(answers)) return visible;
	if (parts.map((text, index) => text + (answers[index] || "")).join("") !== line.text) return visible;

	const partStart = parts.slice(0, partIndex).reduce((offset, text, index) =>
		offset + text.length + String(answers[index]).length, 0);
	const partWords = [...part.matchAll(SUBTITLE_WORD_PATTERN)];
	const word = partWords[clickedWordIndex];
	if (!word) return null;
	const lineWords = [...line.text.matchAll(SUBTITLE_WORD_PATTERN)];
	const lineWordIndex = lineWords.findIndex((candidate) => candidate.index === partStart + word.index);
	if (lineWordIndex < 0) return visible;
	const contextual = findLessonLookup({ lessonId, dialogueId, line, clickedWordIndex: lineWordIndex });
	if (!contextual) return visible;
	const phraseStart = lineWords[contextual.startWordIndex]?.index;
	const phraseEndWord = lineWords[contextual.endWordIndex];
	const phraseEnd = phraseEndWord && phraseEndWord.index + phraseEndWord[0].length;
	if (phraseStart < partStart || phraseEnd > partStart + part.length) return visible;
	return { ...contextual,
		startWordIndex: contextual.startWordIndex - (lineWordIndex - clickedWordIndex),
		endWordIndex: contextual.endWordIndex - (lineWordIndex - clickedWordIndex),
	};
}
