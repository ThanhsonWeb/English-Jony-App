const Vocab = require("../models/vocabModel");
const Topic = require("../models/topicModel");
const mongoose = require("mongoose");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");

exports.getAllVocab = catchAsync(async (req, res, next) => {
	const filter = {
		user: req.user.id,
	};

	if (req.query.topic) {
		filter.topic = req.query.topic;
	}

	const vocabularies = await Vocab.find(filter);

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
	if (!vocab) return next(new AppError("Không tìm thấy từ nào", 404));
	res.status(200).json({
		status: " success",
		data: { vocab },
	});
});
exports.updateVocab = catchAsync(async (req, res, next) => {
	const updates = {};
	for (const field of [
		"english", "vietnamese", "pronunciation", "example", "status", "topic",
	]) {
		if (Object.hasOwn(req.body, field)) updates[field] = req.body[field];
	}
	if (Object.hasOwn(updates, "topic") && updates.topic !== null) {
		if (
			!mongoose.isObjectIdOrHexString(updates.topic) ||
			!(await Topic.exists({ _id: updates.topic, user: req.user.id }))
		) {
			return next(new AppError("Topic must belong to the authenticated user", 400));
		}
	}
	const updatedVocab = await Vocab.findOneAndUpdate(
		{ _id: req.params.id, user: req.user.id },
		{ $set: updates },
		{
			new: true,
			runValidators: true,
		},
	);

	if (!updatedVocab) {
		return res.status(404).json({
			status: "fail",
			message: "Vocabulary not found",
		});
	}

	res.status(200).json({
		status: "success",
		data: { updatedVocab },
	});
});

exports.createNewVocab = catchAsync(async (req, res, next) => {
	const newVocab = await Vocab.create({
		...req.body,
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
