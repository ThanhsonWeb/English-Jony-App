const Vocab = require("../models/vocabModel");
const Topic = require("../models/topicModel");
const mongoose = require("mongoose");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const { fenceActiveAccountWrite } = require("../utils/accountLifecycle");
const { isKnownDialogue } = require("../utils/dialogueCatalogue");

const ACCOUNT_WRITE_TRANSACTION_OPTIONS = {
	readPreference: "primary",
	readConcern: { level: "snapshot" },
	writeConcern: { w: "majority" },
};

const isOwnedTopic = async (topic, userId, session) => topic === null || (
	mongoose.isObjectIdOrHexString(topic) && await Topic.exists({ _id: topic, user: userId }).session(session)
);

const normalizeVocabularyText = value => typeof value === "string"
	? value.normalize("NFC").trim().replace(/\s+/gu, " ").toLowerCase() : "";

async function rejectDuplicate(userId, english, vietnamese, session, excludeId) {
	const term = normalizeVocabularyText(english);
	const meaning = normalizeVocabularyText(vietnamese);
	if (!term || !meaning) return; // Let the existing model validation handle missing fields.
	const existing = await Vocab.find({ user: userId, ...(excludeId ? { _id: { $ne: excludeId } } : {}) })
		.select("english vietnamese").session(session).lean();
	if (existing.some(word => normalizeVocabularyText(word.english) === term && normalizeVocabularyText(word.vietnamese) === meaning)) {
		const error = new AppError("This word and meaning are already in your wordlist.", 409);
		error.code = "duplicateVocabulary";
		throw error;
	}
}

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
	const updatedVocab = await mongoose.connection.transaction(async session => {
		await fenceActiveAccountWrite(req.user.id, session);
		if (Object.hasOwn(updates, "topic") && !(await isOwnedTopic(updates.topic, req.user.id, session))) {
			throw new AppError("Topic must belong to the authenticated user", 400);
		}
		if (Object.hasOwn(updates, "english") || Object.hasOwn(updates, "vietnamese")) {
			const current = await Vocab.findOne({ _id: req.params.id, user: req.user.id }).session(session).lean();
			if (current) await rejectDuplicate(req.user.id, updates.english ?? current.english, updates.vietnamese ?? current.vietnamese, session, current._id);
		}
		return Vocab.findOneAndUpdate(
			{ _id: req.params.id, user: req.user.id },
			{ $set: updates },
			{ new: true, runValidators: true, session },
		);
	}, ACCOUNT_WRITE_TRANSACTION_OPTIONS);

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
	const fields = {};
	for (const field of ["english", "vietnamese", "pronunciation", "example", "topic"]) {
		if (Object.hasOwn(req.body, field)) fields[field] = req.body[field];
	}
	if (Object.hasOwn(req.body, "source")) {
		const source = req.body.source;
		if (!source || typeof source !== "object" || Array.isArray(source) || source.type !== "dialogue" ||
			![source.lessonId, source.dialogueId].every(value => typeof value === "string" && value.trim().length > 0 && value.length <= 200) ||
			!isKnownDialogue(source.lessonId.trim(), source.dialogueId.trim())) {
			return next(new AppError("Invalid dialogue source", 400));
		}
		fields.source = { type: "dialogue", lessonId: source.lessonId.trim(), dialogueId: source.dialogueId.trim() };
	}
	// Review history, timestamps and provenance use server/model defaults only.
	const newVocab = await mongoose.connection.transaction(async session => {
		await fenceActiveAccountWrite(req.user.id, session);
		if (Object.hasOwn(fields, "topic") && !(await isOwnedTopic(fields.topic, req.user.id, session))) {
			throw new AppError("Topic must belong to the authenticated user", 400);
		}
		await rejectDuplicate(req.user.id, fields.english, fields.vietnamese, session);
		const [created] = await Vocab.create([{
			...fields,
			user: req.user.id,
		}], { session });
		return created;
	}, ACCOUNT_WRITE_TRANSACTION_OPTIONS);

	res.status(201).json({
		status: "success",
		data: { newVocab },
	});
});

exports.deleteVocab = catchAsync(async (req, res, next) => {
	// only delete the logged-in user's vocabulary
	await mongoose.connection.transaction(async session => {
		await fenceActiveAccountWrite(req.user.id, session);
		await Vocab.findOneAndDelete({
			_id: req.params.id,
			user: req.user.id,
		}, { session });
	}, ACCOUNT_WRITE_TRANSACTION_OPTIONS);
	res.status(204).json({
		status: "success",
	});
});
