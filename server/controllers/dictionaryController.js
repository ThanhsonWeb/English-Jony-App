const { Translate } = require("@google-cloud/translate").v2;
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");

const translate = new Translate();

exports.lookupWord = catchAsync(async (req, res, next) => {
	const word = req.params.word?.trim().toLowerCase();

	if (!word) {
		return next(new AppError("Please provide a word", 400));
	}

	// 1. Google Translate → Vietnamese
	const [translation] = await translate.translate(word, "vi");

	// 2. Dictionary API → IPA + example
	const dictionaryRes = await fetch(
		`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
	);

	let pronunciation = "";
	let example = "";

	if (dictionaryRes.ok) {
		const dictionary = await dictionaryRes.json();
		const entry = dictionary[0];

		// IPA
		pronunciation =
			entry.phonetic ||
			entry.phonetics?.find((item) => item.text)?.text ||
			"";

		// Example
		example =
			entry.meanings
				?.flatMap((meaning) => meaning.definitions)
				.find((definition) => definition.example)?.example || "";
	}

	res.status(200).json({
		status: "success",
		data: {
			english: word,
			vietnamese: translation,
			pronunciation,
			example,
		},
	});
});