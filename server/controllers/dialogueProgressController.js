const DialogueProgress = require("../models/dialogueProgressModel.js");
const catchAsync = require("../utils/catchAsync.js");

// GET /api/v1/dialogue-progress/:lessonId
exports.getLessonProgress = catchAsync(async (req, res, next) => {
	const progress = await DialogueProgress.find({
		user: req.user._id,
		lessonId: req.params.lessonId,
	}).sort({ updatedAt: -1 });

	res.status(200).json({
		status: "success",
		data: {
			progress,
		},
	});
});

// PATCH /api/v1/dialogue-progress/:lessonId/:dialogueId/tasks/:taskId
exports.completeTask = catchAsync(async (req, res, next) => {
	const { lessonId, dialogueId, taskId } = req.params;

	const progress = await DialogueProgress.findOneAndUpdate(
		{
			user: req.user._id,
			lessonId,
			dialogueId,
		},
		{
			$addToSet: {
				completedTaskIds: taskId,
			},
		},
		{
			new: true,
			upsert: true,
			runValidators: true,
		},
	);

	res.status(200).json({
		status: "success",
		data: {
			progress,
		},
	});
});
