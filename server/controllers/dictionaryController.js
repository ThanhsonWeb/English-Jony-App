const { Translate } = require("@google-cloud/translate").v2;
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");

const translate = new Translate();

exports.lookupWord = catchAsync(async (req, res, next) => {
	const word = req.params.word?.trim().toLowerCase();

	if (!word) {
		return next(new AppError("Please provide a word", 400));
	}

	const [translation] = await translate.translate(word, "vi");

	res.status(200).json({
		status: "success",
		data: {
			english: word,
			vietnamese: translation,
		},
	});
});