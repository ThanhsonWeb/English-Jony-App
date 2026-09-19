const DialogueProgress = require("../models/dialogueProgressModel.js");
const catchAsync = require("../utils/catchAsync.js");
const mongoose = require("mongoose");
const User = require("../models/userModel.js");
const XPEvent = require("../models/xpEventModel.js");
const awardXp = require("../services/awardXp.js");
const AppError = require("../utils/appError.js");
const StudyActivity = require("../models/studyActivityModel");
const { markQualifiedStudy } = require("../services/studyStreak");

// GET /api/v1/dialogue-progress/:lessonId
exports.getLessonProgress = catchAsync(async (req, res, next) => {
	const progress = await DialogueProgress.find({
		user: req.user._id, // protect middleware
		lessonId: req.params.lessonId,
	}).sort({ updatedAt: -1 });

	res.status(200).json({
		status: "success",
		data: {
			progress,
		},
	});
});

exports.getLatestProgress = catchAsync(async (req, res, next) => {
	const progress = await DialogueProgress.findOne({
		user: req.user._id,
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
	const filter = { user: req.user._id, lessonId, dialogueId };
	const awardKey = `dialogue:${[lessonId, dialogueId, taskId].map(encodeURIComponent).join(":")}`;
	const studiedAt = new Date();
	await Promise.all([DialogueProgress.init(), XPEvent.init(), StudyActivity.init()]);

	let result;
	for (let attempt = 0; attempt < 3; attempt += 1) {
		try {
			result = await mongoose.connection.transaction(async (session) => {
				const previous = await DialogueProgress.findOne(filter).session(session).lean();
				const alreadyCompleted = previous?.completedTaskIds.includes(taskId) ?? false;
				const progress = await DialogueProgress.findOneAndUpdate(filter,
					{ $addToSet: { completedTaskIds: taskId } },
					{ returnDocument: "after", upsert: true, runValidators: true, session });

				await markQualifiedStudy(req.user._id, { session, now: studiedAt });
				if (alreadyCompleted) {
					// Old completions with no XP event are replays, not new rewards.
					const user = await User.findById(req.user._id).select("totalXp").session(session).lean();
					if (!user) throw new AppError("User not found", 404);
					return { progress, xp: { awarded: 0, total: user.totalXp ?? 0, reason: "already_completed" } };
				}

				const xp = await awardXp({
					userId: req.user._id,
					awardKey,
					sourceType: "dialogue_task",
					sourceId: [lessonId, dialogueId, taskId].map(encodeURIComponent).join("/"),
					amount: 10,
				}, { session });
				return { progress, xp: { awarded: xp.awarded, total: xp.totalXp, reason: xp.reason } };
			}, { readPreference: "primary", readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
			break;
		} catch (error) {
			// A racing first upsert can hit a unique index instead of a transient
			// write conflict. Restart the entire transaction to read the winner.
			const progressCollision = error.keyPattern?.user && error.keyPattern?.lessonId && error.keyPattern?.dialogueId;
			const awardCollision = error.keyPattern?.user && error.keyPattern?.awardKey;
			const activityCollision = error.keyPattern?.user && error.keyPattern?.date;
			if (error.code !== 11000 || (!progressCollision && !awardCollision && !activityCollision) || attempt === 2) throw error;
		}
	}

	res.status(200).json({
		status: "success",
		data: result,
	});
});
