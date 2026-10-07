const { Translate } = require("@google-cloud/translate").v2;
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const { createDictionaryLookup } = require("../services/dictionaryLookup");

// Native HTTP timeout plus no automatic paid-request retries.
const translate = new Translate({ timeout: 3000, autoRetry: false, maxRetries: 0 });
const FAST_DICTIONARY_TIMEOUT_MS = 900;
const BACKGROUND_DICTIONARY_TIMEOUT_MS = 5000;

async function readProviderJson(response) {
	const chunks = [];
	let size = 0;
	for await (const chunk of response.body) {
		size += chunk.length;
		if (size > 64 * 1024) throw new Error("Dictionary response too large");
		chunks.push(chunk);
	}
	return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function fetchDictionaryApi(word, signal) {
	const response = await fetch(
		`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(
			word,
		)}`,
		{ signal },
	);

	if (!response.ok) return null;

	const data = await readProviderJson(response);

	return data?.[0] || null;
}

async function fetchFreeDictionaryApi(word, signal) {
	const response = await fetch(
		`https://freedictionaryapi.com/api/v1/entries/en/${encodeURIComponent(
			word,
		)}`,
		{ signal },
	);

	if (!response.ok) return null;

	const data = await readProviderJson(response);

	const entry = data.entries?.[0];

	if (!entry) return null;

	const pronunciation =
		entry.pronunciations?.find(
			(item) => item.type === "ipa" && item.text?.trim(),
		)?.text || "";

	const example = entry.senses
		?.flatMap((sense) =>
			Array.isArray(sense.examples) ? sense.examples : [sense.examples],
		)
		.find((item) => typeof item === "string" && item.trim());

	return {
		phonetic: pronunciation,

		phonetics: [],

		meanings: [
			{
				partOfSpeech: entry.partOfSpeech || "",

				definitions: example
					? [
							{
								example,
							},
						]
					: [],
			},
		],
	};
}


async function fetchDictionaryEntry(word, timeoutMs) {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), timeoutMs);
	const valid = async fetcher => {
		const result = await fetcher(word, controller.signal);
		if (!result) throw new Error("No dictionary result");
		return result;
	};
	const requests = [valid(fetchDictionaryApi), valid(fetchFreeDictionaryApi)];
	try { return await Promise.any(requests); }
	catch { return null; }
	finally {
		clearTimeout(timeout); controller.abort();
		await Promise.allSettled(requests);
	}
}

function getDictionaryFields(entry) {
	if (!entry) {
		return {
			pronunciation: "",
			audioUrl: "",
			partOfSpeech: "",
			example: "",
		};
	}

	const pronunciation =
		entry.phonetic || entry.phonetics?.find((item) => item.text)?.text || "";

	const audioUrl = entry.phonetics?.find((item) => item.audio)?.audio || "";

	const meaningWithExample = entry.meanings?.find((meaning) =>
		meaning.definitions?.some((definition) => definition.example),
	);

	const example =
		meaningWithExample?.definitions?.find((definition) => definition.example)
			?.example || "";

	const partOfSpeech =
		meaningWithExample?.partOfSpeech || entry.meanings?.[0]?.partOfSpeech || "";

	return {
		pronunciation,
		audioUrl,
		partOfSpeech,
		example,
	};
}

/**
 * ----------------------------------------
 * TRANSLATION
 * ----------------------------------------
 */

async function translateWord(word) {
	try {
		const [translation] = await translate.translate(word, "vi");

		return translation || "";
	} catch {
		return "";
	}
}

async function translateExample(example) {
	if (!example) return "";

	try {
		const [translation] = await translate.translate(example, "vi");

		return translation || "";
	} catch {
		return "";
	}
}


const limited = (value, max) => typeof value === "string" ? value.slice(0, max) : "";
function boundFields(fields) {
	return {
		pronunciation: limited(fields.pronunciation, 200), audioUrl: limited(fields.audioUrl, 1000),
		partOfSpeech: limited(fields.partOfSpeech, 100), example: limited(fields.example, 2000),
	};
}

const dictionary = createDictionaryLookup({
	async lookup(word) {
		const [vietnamese, entry] = await Promise.all([translateWord(word), fetchDictionaryEntry(word, FAST_DICTIONARY_TIMEOUT_MS)]);
		const fields = boundFields(getDictionaryFields(entry));
		if (!vietnamese && !fields.pronunciation && !fields.example && !fields.partOfSpeech) throw new AppError("Dictionary is temporarily unavailable", 503);
		return { dictionaryComplete: Boolean(entry), data: {
			english: word, vietnamese: limited(vietnamese, 1000), ...fields, exampleVietnamese: "",
		} };
	},
	async enrich(word, cached) {
		let data = { ...cached.data }, dictionaryComplete = cached.dictionaryComplete;
		if (!dictionaryComplete) {
			const entry = await fetchDictionaryEntry(word, BACKGROUND_DICTIONARY_TIMEOUT_MS);
			if (entry) { data = { ...data, ...boundFields(getDictionaryFields(entry)) }; dictionaryComplete = true; }
		}
		if (data.example && !data.exampleVietnamese) data.exampleVietnamese = limited(await translateExample(data.example), 2000);
		return { data, dictionaryComplete };
	},
});

exports.lookupWord = catchAsync(async (req, res) => {
	try {
		const data = await dictionary.lookup(req.params.word);
		res.status(200).json({ status: "success", data });
	} catch (error) {
		if (error.statusCode === 503) res.set("Retry-After", "5");
		throw error;
	}
});
