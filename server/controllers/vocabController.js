const Vocab = require("../models/vocabModel");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");

exports.getAllVocab = catchAsync(async (req, res, next) => {
	// Get current user's vocab
	const vocabularies = await Vocab.find({
		user: req.user.id, //from protect
		topic: req.query.topic, // from URL
	});

	res.status(200).json({
		status: "success",
		data: { vocabularies },
	});
});

exports.getVocab = catchAsync(async (req, res, next) => {
	const vocab = await Vocab.findOne({
		_id: req.params.id,
		user: req.user.id,
	});
	if (!vocab) return next(new AppError("No vocabulary found", 404));
	res.status(200).json({
		status: " success",
		data: { vocab },
	});
});
exports.updateVocab = catchAsync(async (req, res, next) => {
	const updatedVocab = await Vocab.findOneAndUpdate(
		// This ensures users can only update their own vocabulary.
		{ _id: req.params.id, user: req.user.id },
		req.body,
		{
			new: true,
			runValidators: true,
		},
	);
	res.status(200).json({
		status: " success",
		data: { updatedVocab },
	});
});

exports.createNewVocab = catchAsync(async (req, res, next) => {
	const response = await fetch(
		`https://api.dictionaryapi.dev/api/v2/entries/en/${req.body.english}`,
	);

	let pronunciation = "";

	if (response.ok) {
		const dictionary = await response.json();

		pronunciation =
			dictionary[0]?.phonetic ||
			dictionary[0]?.phonetics?.find((p) => p.text)?.text ||
			"";
	}

	const newVocab = await Vocab.create({
		...req.body,
		pronunciation,
		user: req.user.id,
	});

	res.status(201).json({
		status: "success",
		data: { newVocab },
	});
});

exports.deleteVocab = catchAsync(async (req, res, next) => {
	// only delete the logged-in user's vocabulary
	await Vocab.findOneAndDelete({
		_id: req.params.id,
		user: req.user.id,
	});
	res.status(204).json({
		status: "success",
	});
});
