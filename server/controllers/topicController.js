const Topic = require("../models/topicModel");
const Vocab = require("../models/vocabModel");
const mongoose = require("mongoose");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const { fenceActiveAccountWrite } = require("../utils/accountLifecycle");

const ACCOUNT_WRITE_TRANSACTION_OPTIONS = {
	readPreference: "primary",
	readConcern: { level: "snapshot" },
	writeConcern: { w: "majority" },
};

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

	const topic = await mongoose.connection.transaction(async session => {
		await fenceActiveAccountWrite(req.user.id, session);
		const [created] = await Topic.create([req.body], { session });
		return created;
	}, ACCOUNT_WRITE_TRANSACTION_OPTIONS);

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
	const updatedTopic = await mongoose.connection.transaction(async session => {
		await fenceActiveAccountWrite(req.user.id, session);
		return Topic.findOneAndUpdate(
			{ _id: req.params.id, user: req.user.id },
			{ $set: updates },
			{ returnDocument: "after", runValidators: true, session },
		);
	}, ACCOUNT_WRITE_TRANSACTION_OPTIONS);
	if (!updatedTopic) return next(new AppError("Topic not found", 404));

	res.status(200).json({
		status: "success",
		data: { updatedTopic },
	});
});

exports.deleteTopic = catchAsync(async (req, res, next) => {
	const ownerFilter = { _id: req.params.id, user: req.user.id };
	await mongoose.connection.transaction(async session => {
		await fenceActiveAccountWrite(req.user.id, session);
		if (!(await Topic.exists(ownerFilter).session(session))) {
			throw new AppError("Topic not found", 404);
		}
		await Vocab.deleteMany({ topic: req.params.id, user: req.user.id }, { session });
		const deletedTopic = await Topic.findOneAndDelete(ownerFilter, { session });
		if (!deletedTopic) throw new AppError("Topic not found", 404);
	}, ACCOUNT_WRITE_TRANSACTION_OPTIONS);

	res.status(204).json({
		status: "success",
		data: null,
	});
});
