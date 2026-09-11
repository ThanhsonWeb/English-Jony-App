const { Translate } = require("@google-cloud/translate").v2;
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");

const translate = new Translate();
const dictionaryCache = new Map();
const dictionaryEnrichmentRequests = new Map();
const DICTIONARY_TIMEOUT_MS = 5000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function getCachedResult(word) {
	const cached = dictionaryCache.get(word);

	if (!cached) return null;

	if (Date.now() - cached.createdAt >= CACHE_TTL_MS) {
		dictionaryCache.delete(word);
		return null;
	}

	return cached;
}

async function fetchDictionaryEntry(word, signal) {
	const response = await fetch(
		`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
		{ signal },
	);

	if (!response.ok) return null;

	const dictionary = await response.json();
	return dictionary[0] || null;
}

async function fetchFallbackDictionaryEntry(word, signal) {
	const response = await fetch(
		`https://freedictionaryapi.com/api/v1/entries/en/${encodeURIComponent(word)}`,
		{ signal },
	);

	if (!response.ok) return null;

	const dictionary = await response.json();
	const entry = dictionary.entries?.[0];
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
				definitions: example ? [{ example }] : [],
			},
		],
	};
}

async function fetchWithTimeout(fetcher) {
	const abortController = new AbortController();
	const timeout = setTimeout(
		() => abortController.abort(),
		DICTIONARY_TIMEOUT_MS,
	);

	try {
		return await fetcher(abortController.signal);
	} finally {
		clearTimeout(timeout);
	}
}

async function fetchDictionaryEntryWithTimeout(word) {
	const primaryEntry = await fetchWithTimeout((signal) =>
		fetchDictionaryEntry(word, signal),
	).catch(() => null);

	if (primaryEntry) return primaryEntry;

	return fetchWithTimeout((signal) =>
		fetchFallbackDictionaryEntry(word, signal),
	).catch(() => null);
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
		entry.phonetic ||
		entry.phonetics?.find((item) => item.text)?.text ||
		"";
	const audioUrl = entry.phonetics?.find((item) => item.audio)?.audio || "";
	const meaningWithExample = entry.meanings?.find((meaning) =>
		meaning.definitions?.some((definition) => definition.example),
	);
	const example = meaningWithExample?.definitions?.find(
		(definition) => definition.example,
	)?.example || "";
	const partOfSpeech =
		meaningWithExample?.partOfSpeech || entry.meanings?.[0]?.partOfSpeech || "";

	return { pronunciation, audioUrl, partOfSpeech, example };
}

async function translateExample(example) {
	if (!example) return "";

	try {
		const [translation] = await translate.translate(example, "vi");
		return translation;
	} catch {
		return "";
	}
}

function enrichCachedResult(word) {
	if (dictionaryEnrichmentRequests.has(word)) return;

	const request = fetchDictionaryEntryWithTimeout(word)
		.then(async (entry) => {
			if (!entry) return;

			const cached = dictionaryCache.get(word);
			if (!cached) return;
			const dictionaryFields = getDictionaryFields(entry);

			cached.data = {
				...cached.data,
				...dictionaryFields,
				exampleVietnamese: await translateExample(dictionaryFields.example),
			};
			cached.dictionaryComplete = true;
			cached.createdAt = Date.now();
		})
		.catch(() => {})
		.finally(() => dictionaryEnrichmentRequests.delete(word));

	dictionaryEnrichmentRequests.set(word, request);
}

exports.lookupWord = catchAsync(async (req, res, next) => {
	const word = req.params.word?.trim().toLowerCase();

	if (!word) {
		return next(new AppError("Please provide a word", 400));
	}

	const cachedResult = getCachedResult(word);

	if (cachedResult) {
		if (!cachedResult.dictionaryComplete) {
			enrichCachedResult(word);
		}

		return res.status(200).json({
			status: "success",
			data: cachedResult.data,
		});
	}

	const [translationResult, dictionaryResult] = await Promise.allSettled([
		translate.translate(word, "vi"),
		fetchDictionaryEntryWithTimeout(word),
	]);

	const translation =
		translationResult.status === "fulfilled"
			? translationResult.value[0]
			: "";
	const entry =
		dictionaryResult.status === "fulfilled" ? dictionaryResult.value : null;
	const dictionaryFields = getDictionaryFields(entry);
	const exampleVietnamese = await translateExample(dictionaryFields.example);

	const data = {
		english: word,
		vietnamese: translation,
		...dictionaryFields,
		exampleVietnamese,
	};

	if (translationResult.status === "fulfilled") {
		dictionaryCache.set(word, {
			createdAt: Date.now(),
			dictionaryComplete: Boolean(entry),
			data,
		});

		if (!entry) {
			enrichCachedResult(word);
		}
	}

	res.status(200).json({
		status: "success",
		data,
	});
});
