const Topic = require("../models/topicModel");
const Vocab = require("../models/vocabModel");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");

exports.getAllTopics = catchAsync(async (req, res, next) => {
	const topics = await Topic.find({ user: req.user.id });
	//req.user from protect (currentUser._id)

	res.status(200).json({
		status: " success",
		results: topics.length,
		data: { topics },
	});
});

exports.createTopic = catchAsync(async (req, res, next) => {
	// Add this line to automatically get the user from the protected route
	req.body.user = req.user.id;

	const topic = await Topic.create(req.body);

	res.status(201).json({
		status: "success",
		data: { topic },
	});
});

exports.updateTopic = catchAsync(async (req, res, next) => {
	const updates = {};
	for (const field of ["name", "description"]) {
		if (Object.hasOwn(req.body, field)) updates[field] = req.body[field];
	}
	const updatedTopic = await Topic.findOneAndUpdate(
		{ _id: req.params.id, user: req.user.id },
		{ $set: updates },
		{
			// new: true,
			returnDocument: "after",
			runValidators: true,
		},
	);
	if (!updatedTopic) return next(new AppError("Topic not found", 404));

	res.status(200).json({
		status: "success",
		data: { updatedTopic },
	});
});

exports.deleteTopic = catchAsync(async (req, res, next) => {
	const ownerFilter = { _id: req.params.id, user: req.user.id };
	if (!(await Topic.exists(ownerFilter))) {
		return next(new AppError("Topic not found", 404));
	}
	await Vocab.deleteMany({
		topic: req.params.id,
		user: req.user.id,
	});

	const deletedTopic = await Topic.findOneAndDelete(ownerFilter);
	if (!deletedTopic) return next(new AppError("Topic not found", 404));

	res.status(204).json({
		status: "success",
		data: null,
	});
});
