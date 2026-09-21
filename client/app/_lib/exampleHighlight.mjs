// Deliberately limited to common English endings; this is not a stemmer.
export function splitExample(sentence, word) {
	if (!sentence || !word?.trim()) return [{ text: sentence || "—", matched: false }];
	const base = word.trim().toLowerCase();
	const forms = new Set([base]);
	if (/^[a-z]+$/.test(base)) {
		forms.add(`${base}s`);
		forms.add(`${base}es`);
		forms.add(`${base}ed`);
		forms.add(`${base}ing`);
		if (base.endsWith("e")) {
			forms.add(`${base}d`);
			forms.add(`${base.slice(0, -1)}ing`);
		}
		if (/[^aeiou]y$/.test(base)) {
			forms.add(`${base.slice(0, -1)}ies`);
			forms.add(`${base.slice(0, -1)}ied`);
		}
		if (/[aeiou][bdgmnprt]$/.test(base)) {
			forms.add(`${base}${base.at(-1)}ed`);
			forms.add(`${base}${base.at(-1)}ing`);
		}
	}
	const escaped = [...forms].sort((a, b) => b.length - a.length)
		.map(value => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
	const pattern = new RegExp(`(?<![\\p{L}\\p{N}_])(?:${escaped.join("|")})(?![\\p{L}\\p{N}_])`, "giu");
	const parts = [];
	let offset = 0;
	for (const match of sentence.matchAll(pattern)) {
		if (match.index > offset) parts.push({ text: sentence.slice(offset, match.index), matched: false });
		parts.push({ text: match[0], matched: true });
		offset = match.index + match[0].length;
	}
	if (offset < sentence.length) parts.push({ text: sentence.slice(offset), matched: false });
	return parts;
}
