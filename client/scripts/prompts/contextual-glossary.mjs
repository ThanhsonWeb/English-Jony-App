export function buildGlossaryPrompt({ courseId, dialogueId, contentType }, source) {
	return `StudyJony contextual glossary authoring — ${contentType}: ${courseId}/${dialogueId}

Codex must author meanings offline after the English draft and Vietnamese translations are final.
Read every line and its translation. Save a separate glossary.json beside draft.json.
Use the existing schemaVersion 1 glossary and the prepared glossary-template.json.
Keep lessonId=${courseId}, dialogueId=${dialogueId}, source line IDs, exact text,
translation, speaker, tokens, and zero-based word positions unchanged.

Review EVERY word occurrence, not only usefulWords. Write short, natural Vietnamese
meanings, usually 1–5 words. Never blindly copy a dictionary's first sense.
Reuse shared entries only when the English word, Vietnamese sense and POS agree;
split references for repeated words with different senses or grammatical roles.
Each word entry has word (lowercase English token), meaning and pos (array).
Optional pron is an IPA array: use trustworthy surface-form IPA, never a lemma's
IPA for an inflected word or one word's IPA for a whole phrase. Omit unknown IPA.
Keep useful grammar explanations in optional note fields, hidden in the popup.
Use a short grammar label when there is no direct Vietnamese translation.
Identify names as proper names. Do not translate character names as ordinary words.

Preserve individual word entries even inside expressions. Add useful phrase entries
with pos:["phrase"] and inclusive spans {start,end,text,entry}. Phrase text must
exactly match the source span, contain at least two words, and never cross punctuation.
Review usefulWords as candidates; do not force every adjacent word into a phrase.
Each line has words (entry IDs in token order) and phrases (span array).
Each character has meaning (name), role and optional note.

Use the English sentence AND its existing Vietnamese translation to select senses.
Check natural Vietnamese, phrase boundaries, individual meanings, POS and IPA.
Flag uncertain senses in optional notes for human review; validation is not proof
of translation accuracy. Never modify an approved glossary automatically.
No runtime translation API, build-time translation API or dictionary-based meaning generator.

After authoring, run:
npm run glossary:check -- ${courseId} ${dialogueId}
Then the existing dialogue:build command validates again before any promotion.

${source ? `Final source (all lines and useful expressions):\n${JSON.stringify({ metadata: source.metadata, dialogue: source.dialogue, usefulWords: source.usefulWords }, null, 2)}`
		: `After saving draft.json, run npm run glossary:prepare -- ${courseId} ${dialogueId} to prepare exact token mappings and an updated authoring request.`}
`;
}
