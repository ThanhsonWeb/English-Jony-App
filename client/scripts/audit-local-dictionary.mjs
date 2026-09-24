import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(scriptDirectory, "..");
const dictionaryDirectory = path.join(clientRoot, "app/_lib/dictionary");
const sourcePath = path.join(dictionaryDirectory, "dictionary.json");
const cleanedPath = path.join(dictionaryDirectory, "dictionary.cleaned.json");
const lemmaMapPath = path.join(dictionaryDirectory, "lemma-map.json");
const reportPath = path.join(dictionaryDirectory, "dictionary-audit.json");

const BEGINNER_FUNCTION_WORDS = {
	a: { type: "determiner", meaning: "một" },
	an: { type: "determiner", meaning: "một" },
	at: { type: "preposition", meaning: "ở / tại / lúc" },
	for: { type: "preposition", meaning: "cho / vì / trong" },
	from: { type: "preposition", meaning: "từ" },
	on: { type: "preposition", meaning: "trên / vào" },
	the: {
		type: "determiner",
		meaning: "mạo từ xác định (thường không dịch riêng)",
	},
	to: { type: "preposition", meaning: "đến / để" },
};

const TYPE_ALIASES = {
	adj: "adjective",
	adv: "adverb",
	m: "number",
	o: "interjection",
	pron: "pronoun",
};

const VALID_TYPES = new Set([
	"adjective",
	"adverb",
	"conjunction",
	"determiner",
	"interjection",
	"noun",
	"number",
	"preposition",
	"pronoun",
	"verb",
	"word",
]);

const IRREGULAR_LEMMAS = {
	been: "be",
	better: "good",
	bought: "buy",
	brought: "bring",
	came: "come",
	did: "do",
	done: "do",
	felt: "feel",
	found: "find",
	got: "get",
	had: "have",
	has: "have",
	knew: "know",
	left: "leave",
	made: "make",
	ran: "run",
	said: "say",
	saw: "see",
	taken: "take",
	told: "tell",
	went: "go",
	worse: "bad",
};

const GRAMMAR_DESCRIPTION_PATTERNS = [
	/quá khứ/i,
	/phân từ/i,
	/số nhiều (?:của|của)/i,
	/dạng (?:chia|so sánh|số nhiều)/i,
	/ngôi thứ/i,
	/viết tắt (?:của|của)/i,
];

function normalizeType(type) {
	const normalized = String(type || "").trim().toLowerCase();
	return TYPE_ALIASES[normalized] || normalized || "word";
}

function cleanMeaning(meaning) {
	return String(meaning || "")
		.replace(/[\p{Extended_Pictographic}\uFE0F]/gu, "")
		.replace(/\s+/g, " ")
		.trim()
		.replace(/[.;]+$/, "");
}

function hasGrammarDescription(meaning) {
	return GRAMMAR_DESCRIPTION_PATTERNS.some((pattern) => pattern.test(meaning));
}

function hasBrokenIpa(ipa) {
	return (
		!ipa ||
		typeof ipa !== "string" ||
		!/^\/.+\/$/.test(ipa.trim()) ||
		/[ăâđêôơưĂÂĐÊÔƠƯ]|�/.test(ipa)
	);
}

function looksLikeEnglishMeaning(meaning) {
	return (
		/\b(?:means?|mostly|much|little|very|not)\b/i.test(meaning) ||
		/^functionary[.!]?$/i.test(meaning) ||
		/^xem\s+[a-z][a-z -]*$/i.test(meaning)
	);
}

function getLemmaCandidates(word) {
	const candidates = [];
	if (IRREGULAR_LEMMAS[word]) candidates.push(IRREGULAR_LEMMAS[word]);

	if (word.endsWith("ies") && word.length > 4) {
		candidates.push(`${word.slice(0, -3)}y`);
	}
	if (word.endsWith("es") && word.length > 3) {
		candidates.push(word.slice(0, -2), word.slice(0, -1));
	} else if (word.endsWith("s") && word.length > 3) {
		candidates.push(word.slice(0, -1));
	}
	if (word.endsWith("ied") && word.length > 4) {
		candidates.push(`${word.slice(0, -3)}y`);
	}
	if (word.endsWith("ed") && word.length > 3) {
		const stem = word.slice(0, -2);
		candidates.push(stem, `${word.slice(0, -1)}`);
		if (stem.at(-1) === stem.at(-2)) candidates.push(stem.slice(0, -1));
	}
	if (word.endsWith("ing") && word.length > 5) {
		const stem = word.slice(0, -3);
		candidates.push(stem, `${stem}e`);
		if (stem.at(-1) === stem.at(-2)) candidates.push(stem.slice(0, -1));
	}

	return [...new Set(candidates)];
}

function findLemma(word, entry, dictionary) {
	const entryType = normalizeType(entry.type);
	for (const candidate of getLemmaCandidates(word)) {
		const baseEntry = dictionary[candidate];
		if (!baseEntry) continue;

		const baseType = normalizeType(baseEntry.type);
		const compatible =
			entryType === baseType ||
			hasGrammarDescription(entry.meaning || "") ||
			(entryType === "adjective" && baseType === "verb");
		if (compatible) return candidate;
	}

	return null;
}

function getPosConcern(word, type, originalType) {
	if (!originalType) return "missing part of speech";
	if (!VALID_TYPES.has(type)) return `unknown type: ${type}`;
	if (
		word.endsWith("ly") &&
		type === "adjective" &&
		!["daily", "early", "holy", "likely"].includes(word)
	) {
		return "-ly entry is likely an adverb";
	}
	if (word.endsWith("tion") && type !== "noun") {
		return "-tion form is usually a noun";
	}
	return null;
}

const source = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
const cleaned = {};
const lemmaMap = {};
const report = {
	summary: {
		sourceEntries: Object.keys(source).length,
		cleanedEntries: 0,
		beginnerFunctionWordsPreserved: 0,
		lemmaMappings: 0,
		suspiciousEntries: 0,
		grammarDescriptions: 0,
		brokenIpa: 0,
		questionablePos: 0,
	},
	suspiciousEntries: [],
	lemmaCandidates: [],
	grammarDescriptions: [],
	brokenIpa: [],
	questionablePos: [],
	preservedFunctionWords: [],
};

for (const [word, sourceEntry] of Object.entries(source)) {
	const entry = sourceEntry || {};
	const sourceMeaning = cleanMeaning(entry.meaning);
	const functionWord = BEGINNER_FUNCTION_WORDS[word];
	const meaning = functionWord?.meaning || sourceMeaning;
	const type = functionWord?.type || normalizeType(entry.type);
	const lemma = findLemma(word, entry, source);
	const grammarDescription = hasGrammarDescription(sourceMeaning);
	const brokenIpa = hasBrokenIpa(entry.ipa);
	const englishMeaning = looksLikeEnglishMeaning(sourceMeaning);
	const posConcern = getPosConcern(word, type, entry.type);

	if (lemma) {
		lemmaMap[word] = lemma;
		report.lemmaCandidates.push({ word, lemma, mapped: true });
	}
	if (grammarDescription) {
		report.grammarDescriptions.push({ word, meaning: sourceMeaning, lemma });
	}
	if (brokenIpa) report.brokenIpa.push({ word, ipa: entry.ipa || "" });
	if (posConcern) report.questionablePos.push({ word, type, reason: posConcern });

	const suspiciousReasons = [];
	if (!meaning) suspiciousReasons.push("empty meaning");
	if (englishMeaning) suspiciousReasons.push("meaning appears to be English");
	if (/[<>]|�/.test(meaning)) suspiciousReasons.push("broken characters or markup");
	if (meaning.length > 180) suspiciousReasons.push("unusually long meaning");
	if (suspiciousReasons.length) {
		report.suspiciousEntries.push({
			word,
			meaning: sourceMeaning,
			reasons: suspiciousReasons,
		});
	}

	if (functionWord) report.preservedFunctionWords.push(word);
	if (
		!meaning ||
		(englishMeaning && !functionWord && !(grammarDescription && lemma)) ||
		/[<>]|�/.test(meaning)
	) {
		continue;
	}
	if (grammarDescription && !lemma) continue;

	const baseEntry = lemma ? source[lemma] : null;
	cleaned[word] = {
		type,
		ipa: brokenIpa ? "" : String(entry.ipa).trim(),
		meaning: grammarDescription && baseEntry
			? cleanMeaning(baseEntry.meaning)
			: meaning,
	};
}

report.summary.cleanedEntries = Object.keys(cleaned).length;
report.summary.beginnerFunctionWordsPreserved =
	report.preservedFunctionWords.length;
report.summary.lemmaMappings = Object.keys(lemmaMap).length;
report.summary.suspiciousEntries = report.suspiciousEntries.length;
report.summary.grammarDescriptions = report.grammarDescriptions.length;
report.summary.brokenIpa = report.brokenIpa.length;
report.summary.questionablePos = report.questionablePos.length;

fs.writeFileSync(cleanedPath, `${JSON.stringify(cleaned, null, 2)}\n`);
fs.writeFileSync(lemmaMapPath, `${JSON.stringify(lemmaMap, null, 2)}\n`);
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

console.log(JSON.stringify(report.summary, null, 2));
console.log(`Cleaned dictionary: ${cleanedPath}`);
console.log(`Lemma map: ${lemmaMapPath}`);
console.log(`Audit report: ${reportPath}`);
