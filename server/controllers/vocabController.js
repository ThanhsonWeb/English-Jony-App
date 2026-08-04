const Vocab = require("../models/vocabModel");
const catchAsync = require("../utils/catchAsync");

exports.getAllVocab = catchAsync(async (req, res, next) => {
	const vocabularies = await Vocab.find({ user: req.user.id });

	res.status(200).json({
		status: " success",
		data: { vocabularies },
	});
});

exports.getAllVocab = catchAsync(async (req, res, next) => {
	await Vocab.create({
		user: req.user.id,
		english: "apple",
		vietnamese: "quả táo",
	});

	res.status(200).json({
		status: " success",
		data: { vocabularies },
	});
});
