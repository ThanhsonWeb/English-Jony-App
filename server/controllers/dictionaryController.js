const { Translate } = require("@google-cloud/translate").v2;
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");

const translate = new Translate();
const dictionaryCache = new Map();
const dictionaryEnrichmentRequests = new Map();
const DICTIONARY_TIMEOUT_MS = 1000;
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

async function fetchDictionaryEntryWithTimeout(word) {
	const abortController = new AbortController();
	const timeout = setTimeout(
		() => abortController.abort(),
		DICTIONARY_TIMEOUT_MS,
	);

	try {
		return await fetchDictionaryEntry(word, abortController.signal);
	} finally {
		clearTimeout(timeout);
	}
}

function getDictionaryFields(entry) {
	if (!entry) {
		return { pronunciation: "", example: "" };
	}

	const pronunciation =
		entry.phonetic ||
		entry.phonetics?.find((item) => item.text)?.text ||
		"";
	const example =
		entry.meanings
			?.flatMap((meaning) => meaning.definitions)
			.find((definition) => definition.example)?.example || "";

	return { pronunciation, example };
}

function enrichCachedResult(word) {
	if (dictionaryEnrichmentRequests.has(word)) return;

	const request = fetchDictionaryEntryWithTimeout(word)
		.then((entry) => {
			if (!entry) return;

			const cached = dictionaryCache.get(word);
			if (!cached) return;

			cached.data = {
				...cached.data,
				...getDictionaryFields(entry),
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
	const { pronunciation, example } = getDictionaryFields(entry);

	const data = {
		english: word,
		vietnamese: translation,
		pronunciation,
		example,
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
