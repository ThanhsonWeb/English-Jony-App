export const structureRules = Object.freeze({
	usefulWords: { min: 4, max: 10 },

	a1FillBlankRange: { min: 1, max: 2 },
	fillBlankRange: { min: 1, max: 3 },
});

export const levelRules = Object.freeze({
	a1: [
		"Use very common everyday vocabulary.",
		"Use short, clear sentences with simple grammar and usually one idea per sentence.",
		"Avoid unnecessary idioms, slang, and difficult words.",
		"Make the language very easy for beginners.",
		"Use one clear communication goal for the dialogue.",
		"Prefer useful everyday phrases and chunks.",
		"Do not force speakers to alternate.",
		"Avoid dialogue that depends on invisible physical actions when the characters are static.",
	],
	a2: [
		"Use common everyday vocabulary and slightly more varied sentences.",
		"Use simple connectors such as because, but, and so when natural.",
		"Use basic past and future forms when natural.",
		"Keep the language easy and practical.",
	],
	b1: [
		"Use natural everyday vocabulary and more varied sentence structures.",
		"Include explanations, reasons, and opinions when appropriate.",
		"Use common phrasal verbs and expressions when natural.",
		"Avoid unnecessary advanced vocabulary.",
	],
	b2: [
		"Use natural, fluent everyday English with broader vocabulary.",
		"Use more complex sentence structures, nuance, and natural expressions.",
		"Keep the conversation realistic rather than artificially academic.",
	],
});

const levelAliases = Object.freeze({ beginner: "a1" });

export function normalizeLevel(level) {
	const normalized = String(level || "")
		.trim()
		.toLowerCase();
	const resolved = levelAliases[normalized] || normalized;

	if (!levelRules[resolved]) {
		throw new Error(
			`Unsupported dialogue level "${level}". Use A1, A2, B1, or B2.`,
		);
	}

	return resolved;
}
