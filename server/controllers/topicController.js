const Topic = require("../models/topicModel");
const catchAsync = require("../utils/catchAsync");

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

exports.deleteTopic = catchAsync(async (req, res, next) => {
	await Topic.findOneAndDelete({
		user: req.user.id,
		_id: req.params.id,
	});

	res.status(204).json({
		status: "success",
	});
});
