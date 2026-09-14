const { Translate } = require("@google-cloud/translate").v2;

const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");

const translate = new Translate();

const dictionaryCache = new Map();
const dictionaryEnrichmentRequests = new Map();

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// Fast lookup shown to the user.
const FAST_DICTIONARY_TIMEOUT_MS = 900;

// Background lookup can wait longer because the user is not blocked.
const BACKGROUND_DICTIONARY_TIMEOUT_MS = 5000;

/**
 * ----------------------------------------
 * CACHE
 * ----------------------------------------
 */

function getCachedResult(word) {
	const cached = dictionaryCache.get(word);

	if (!cached) return null;

	if (Date.now() - cached.createdAt >= CACHE_TTL_MS) {
		dictionaryCache.delete(word);
		return null;
	}

	return cached;
}

function saveToCache(word, data, dictionaryComplete = false) {
	dictionaryCache.set(word, {
		createdAt: Date.now(),
		dictionaryComplete,
		data,
	});
}

/**
 * ----------------------------------------
 * DICTIONARY PROVIDERS
 * ----------------------------------------
 */

async function fetchDictionaryApi(word, signal) {
	const response = await fetch(
		`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(
			word,
		)}`,
		{ signal },
	);

	if (!response.ok) return null;

	const data = await response.json();

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

	const data = await response.json();

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

/**
 * ----------------------------------------
 * TIMEOUT
 * ----------------------------------------
 */

async function fetchWithTimeout(fetcher, timeoutMs) {
	const controller = new AbortController();

	const timeout = setTimeout(() => {
		controller.abort();
	}, timeoutMs);

	try {
		return await fetcher(controller.signal);
	} finally {
		clearTimeout(timeout);
	}
}

/**
 * ----------------------------------------
 * FETCH DICTIONARY
 *
 * Both providers run at the SAME TIME.
 * First valid result wins.
 * ----------------------------------------
 */

async function fetchDictionaryEntry(word, timeoutMs) {
	const makeValidResult = (promise) =>
		promise.then((result) => {
			if (!result) {
				throw new Error("No dictionary result");
			}

			return result;
		});

	const primaryPromise = makeValidResult(
		fetchWithTimeout((signal) => fetchDictionaryApi(word, signal), timeoutMs),
	);

	const fallbackPromise = makeValidResult(
		fetchWithTimeout(
			(signal) => fetchFreeDictionaryApi(word, signal),
			timeoutMs,
		),
	);

	try {
		return await Promise.any([primaryPromise, fallbackPromise]);
	} catch {
		return null;
	}
}

/**
 * ----------------------------------------
 * NORMALIZE DICTIONARY DATA
 * ----------------------------------------
 */

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

/**
 * ----------------------------------------
 * BACKGROUND ENRICHMENT
 *
 * Does NOT block the user's request.
 * ----------------------------------------
 */

function enrichCachedResult(word) {
	if (dictionaryEnrichmentRequests.has(word)) {
		return;
	}

	const request = (async () => {
		try {
			const cached = dictionaryCache.get(word);

			if (!cached) return;

			let dictionaryFields = {
				pronunciation: "",
				audioUrl: "",
				partOfSpeech: "",
				example: "",
			};

			/*
			 * If dictionary data is missing,
			 * retry in background with a longer timeout.
			 */
			if (!cached.dictionaryComplete) {
				const entry = await fetchDictionaryEntry(
					word,
					BACKGROUND_DICTIONARY_TIMEOUT_MS,
				);

				if (entry) {
					dictionaryFields = getDictionaryFields(entry);

					cached.data = {
						...cached.data,
						...dictionaryFields,
					};

					cached.dictionaryComplete = true;
				}
			} else {
				dictionaryFields = {
					pronunciation: cached.data.pronunciation || "",
					audioUrl: cached.data.audioUrl || "",
					partOfSpeech: cached.data.partOfSpeech || "",
					example: cached.data.example || "",
				};
			}

			/*
			 * Translate the example separately.
			 */
			const example = dictionaryFields.example || cached.data.example || "";

			if (example && !cached.data.exampleVietnamese) {
				const exampleVietnamese = await translateExample(example);

				if (exampleVietnamese) {
					cached.data.exampleVietnamese = exampleVietnamese;
				}
			}

			/*
			 * Keep original cache creation time.
			 *
			 * We don't want background enrichment to
			 * accidentally restart the 24-hour TTL.
			 */
		} catch {
			// Background enrichment failure should never
			// break the user's lookup request.
		}
	})().finally(() => {
		dictionaryEnrichmentRequests.delete(word);
	});

	dictionaryEnrichmentRequests.set(word, request);
}

/**
 * ----------------------------------------
 * LOOKUP WORD
 * ----------------------------------------
 */

exports.lookupWord = catchAsync(async (req, res, next) => {
	const word = req.params.word?.trim().toLowerCase();

	if (!word) {
		return next(new AppError("Please provide a word", 400));
	}

	const cachedResult = getCachedResult(word);

	if (cachedResult) {
		res.status(200).json({
			status: "success",
			data: cachedResult.data,
		});

		/*
		 * Complete missing information in background.
		 */
		if (
			!cachedResult.dictionaryComplete ||
			(cachedResult.data.example && !cachedResult.data.exampleVietnamese)
		) {
			enrichCachedResult(word);
		}

		return;
	}

	/**
	 * 2. FIRST LOOKUP
	 *
	 * Translation and dictionary lookup happen together.
	 *
	 * Dictionary gets only ~900ms before we stop waiting.
	 */
	const start = Date.now();

	const translationPromise = (async () => {
		const time = Date.now();

		const result = await translateWord(word);

		return result;
	})();

	const dictionaryPromise = (async () => {
		const time = Date.now();

		const result = await fetchDictionaryEntry(word, FAST_DICTIONARY_TIMEOUT_MS);

		return result;
	})();

	const [translationResult, dictionaryResult] = await Promise.allSettled([
		translationPromise,
		dictionaryPromise,
	]);

	const vietnamese =
		translationResult.status === "fulfilled" ? translationResult.value : "";

	const dictionaryEntry =
		dictionaryResult.status === "fulfilled" ? dictionaryResult.value : null;

	const dictionaryFields = getDictionaryFields(dictionaryEntry);

	/**
	 * IMPORTANT:
	 *
	 * Do NOT translate the example here.
	 *
	 * That would create another network request
	 * before responding to the user.
	 */
	const data = {
		english: word,
		vietnamese,

		...dictionaryFields,

		exampleVietnamese: "",
	};

	/**
	 * Save even partial results.
	 */
	saveToCache(word, data, Boolean(dictionaryEntry));

	/**
	 * 3. RESPOND NOW ⚡
	 */
	res.status(200).json({
		status: "success",
		data,
	});

	/**
	 * 4. FINISH EXTRA DATA IN BACKGROUND
	 */
	enrichCachedResult(word);
});
