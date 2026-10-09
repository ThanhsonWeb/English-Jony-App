import { SUBTITLE_WORD_PATTERN } from "./findPreferredLookup.js";

export function phraseMatchesText(phrase, text, words) {
	if (!phrase || !Number.isInteger(phrase.start) || !Number.isInteger(phrase.end)
		|| phrase.start < 0 || phrase.start >= phrase.end || phrase.end >= words.length) return false;
	return phrase.text === text.slice(words[phrase.start].index, words[phrase.end].index + words[phrase.end][0].length)
		&& words.slice(phrase.start, phrase.end).every((word, offset) =>
			/^\s+$/u.test(text.slice(word.index + word[0].length, words[phrase.start + offset + 1].index)));
}

// Compare authored occurrence maps with the real lesson, including equal-length edits.
// This validates a reviewed glossary; it does not generate translations.
export function validateLessonGlossary(glossary, source) {
	const errors = [];
	if (!glossary || typeof glossary !== "object" || !source?.metadata || !Array.isArray(source.dialogue)) return ["Invalid glossary or lesson source"];
	if (glossary.schemaVersion !== 1 || glossary.lessonId !== source.metadata.courseId
		|| glossary.dialogueId !== source.metadata.dialogueId) errors.push("Lesson identity mismatch");
	const entries = glossary.entries || {};
	const hasEntry = id => typeof entries[id]?.meaning === "string" && entries[id].meaning.trim();
	for (const [id, entry] of Object.entries(entries)) {
		if (!hasEntry(id)) errors.push(`Entry ${id}: missing meaning`);
		if (!Array.isArray(entry?.pos) || !entry.pos.length || entry.pos.some(pos => typeof pos !== "string" || !pos.trim())) errors.push(`Entry ${id}: missing POS`);
		if (entry?.note !== undefined && typeof entry.note !== "string") errors.push(`Entry ${id}: invalid note`);
		if (entry?.pron !== undefined && (!Array.isArray(entry.pron) || entry.pron.some(pron => typeof pron !== "string" || !pron.trim()))) errors.push(`Entry ${id}: invalid pronunciation`);
	}
	for (const name of new Set(source.dialogue.map(line => line.speaker))) {
		if (!glossary.characters?.[name]?.meaning?.trim() || !glossary.characters[name].role?.trim()) errors.push(`Character ${name}: missing name or role`);
	}
	const sourceIds = source.dialogue.map(line => String(line.id));
	if (JSON.stringify(Object.keys(glossary.lines || {}).sort()) !== JSON.stringify(sourceIds.sort())) errors.push("Line IDs mismatch");
	for (const line of source.dialogue) {
		const context = glossary.lines?.[line.id];
		const prefix = `Line ${line.id}`;
		if (!context) { errors.push(`${prefix}: missing mapping`); continue; }
		for (const field of ["text", "speaker", "translation"]) {
			if (context[field] !== line[field]) errors.push(`${prefix}: outdated ${field}`);
		}
		const words = [...line.text.matchAll(SUBTITLE_WORD_PATTERN)];
		if (JSON.stringify(context.tokens) !== JSON.stringify(words.map(word => word[0]))) errors.push(`${prefix}: incorrect token positions`);
		if (!Array.isArray(context.words) || context.words.length !== words.length) errors.push(`${prefix}: missing word mappings`);
		for (const [index, id] of (Array.isArray(context.words) ? context.words : []).entries()) {
			if (!hasEntry(id)) errors.push(`${prefix}, word ${index}: missing entry ${id}`);
			else if (Array.isArray(entries[id].pos) && entries[id].pos.includes("phrase")) errors.push(`${prefix}, word ${index}: phrase used as word`);
			else if (entries[id].word !== words[index]?.[0].toLowerCase()) errors.push(`${prefix}, word ${index}: incorrect entry position`);
		}
		if (!Array.isArray(context.phrases)) errors.push(`${prefix}: missing phrase array`);
		for (const phrase of Array.isArray(context.phrases) ? context.phrases : []) {
			if (!phraseMatchesText(phrase, line.text, words)) errors.push(`${prefix}: broken phrase boundaries ${phrase?.entry}`);
			if (!hasEntry(phrase?.entry)) errors.push(`${prefix}: missing phrase entry ${phrase?.entry}`);
			else if (!Array.isArray(entries[phrase.entry].pos) || !entries[phrase.entry].pos.includes("phrase")) errors.push(`${prefix}: word used as phrase ${phrase.entry}`);
		}
	}
	return errors;
}
