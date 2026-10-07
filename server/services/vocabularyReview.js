const mongoose = require("mongoose");
const { createHash, randomUUID } = require("node:crypto");
const Vocab = require("../models/vocabModel");
const User = require("../models/userModel");
const XPEvent = require("../models/xpEventModel");
const StudyActivity = require("../models/studyActivityModel");
const VocabularyReviewEvent = require("../models/vocabularyReviewEventModel");
const AppError = require("../utils/appError");
const awardXp = require("./awardXp");
const { markQualifiedStudy, vietnamDay } = require("./studyStreak");

const normalizeAnswer = text => text.trim().toLowerCase();
const stableWordKey = text => createHash("sha256").update(text.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ")).digest("hex");
const ratingLevels = { again: 0, hard: 1, medium: 2, easy: 3 };
const reviewIntervals = {
	1: [1, 3, 7, 14],
	2: [3, 7, 14, 30],
	3: [7, 14, 30, 60],
};

function getReviewOutcome(word, { mode, answer, rating }) {
	if (mode === "flashcard") {
		return { correct: rating !== "again", rating };
	}

	const correct = normalizeAnswer(answer) === normalizeAnswer(mode === "quiz" ? word.vietnamese : word.english);
	return { correct, rating: correct ? "medium" : "again" };
}

function scheduleVocabularyReview(word, rating, now) {
	const level = ratingLevels[rating];
	const count = word.reviewCount || 0;
	const days = level === 0
		? 1 / 24
		: reviewIntervals[level][Math.min(Math.max(count, 0), 3)];

	word.learningLevel = level;
	word.reviewCount = level === 0 ? 0 : count + 1;
	word.lastReviewedAt = new Date(now.getTime());
	if (level === 0) word.status = false;
	word.nextReview = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}

async function reviewVocabulary(userId, wordId, input, { now = new Date() } = {}) {
	// Internal callers may start a new event; the HTTP handler requires reviewId.
	const { mode, answer, rating, practice = false, reviewId = randomUUID() } = input;
	if (typeof reviewId !== "string" || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(reviewId)) {
		throw new AppError("Invalid review identity", 400);
	}
	if (!mongoose.isObjectIdOrHexString(wordId) || !["flashcard", "quiz", "writing"].includes(mode) || typeof practice !== "boolean") {
		throw new AppError("Invalid vocabulary review", 400);
	}
	const ratings = Object.keys(ratingLevels);
	if (mode === "flashcard" ? !ratings.includes(rating) : typeof answer !== "string" || !answer.trim() || answer.length > 10000) {
		throw new AppError("A valid rating or answer is required", 400);
	}
	await Promise.all([XPEvent.init(), StudyActivity.init(), VocabularyReviewEvent.init()]);
	const eventId = createHash("sha256").update(`${userId}:${reviewId.toLowerCase()}`).digest("hex");
	const inputHash = createHash("sha256").update(JSON.stringify([String(wordId), mode, answer ?? null, rating ?? null, practice])).digest("hex");
	const dayKey = vietnamDay(now);
	for (let attempt = 0; attempt < 3; attempt += 1) {
		try {
			return await mongoose.connection.transaction(async session => {
				const word = await Vocab.findOne({ _id: wordId, user: userId }).session(session);
				if (!word) throw new AppError("Vocabulary not found", 404);
				const receipt = await VocabularyReviewEvent.findById(eventId).session(session).lean();
				if (receipt) {
					if (receipt.inputHash !== inputHash) throw new AppError("Review identity already used", 409);
					const user = await User.findById(userId).select("totalXp").session(session).lean();
					return { updatedVocab: word, correct: receipt.correct, xp: { awarded: 0, total: user.totalXp ?? 0, reason: "review_replayed" } };
				}
				const outcome = getReviewOutcome(word, { mode, answer, rating });
				const { correct } = outcome;
				if (!practice) {
					scheduleVocabularyReview(word, outcome.rating, now);
					await word.save({ session });
				}
				// The shared daily write serializes reviews of different words too.
				// A racing transaction retries before reading the daily XP sum.
				await markQualifiedStudy(userId, { session, now });
				await StudyActivity.updateOne({ user: userId, date: dayKey }, {
					$inc: { vocabularyReviewVersion: 1, ...(!practice ? { count: 1 } : {}) },
				}, { session });
				const user = await User.findById(userId).select("totalXp").session(session).lean();
				if (!user) throw new AppError("User not found", 404);
				let xp = { awarded: 0, total: user.totalXp ?? 0, reason: "incorrect" };
				if (correct) {
					const key = stableWordKey(word.english);
					const awardKey = `vocabulary:${key}:${dayKey}`;
					const existing = await XPEvent.exists({ user: userId, awardKey }).session(session);
					if (existing) xp.reason = "already_awarded";
					else {
						const [daily] = await XPEvent.aggregate([
							{ $match: { user: new mongoose.Types.ObjectId(userId), sourceType: "vocabulary_review", dayKey } },
							{ $group: { _id: null, total: { $sum: "$amount" } } },
						]).session(session);
						const amount = mode === "flashcard" ? 2 : 5;
						if ((daily?.total ?? 0) + amount > 100) xp.reason = "daily_cap";
						else {
							const awarded = await awardXp({ userId, awardKey, sourceType: "vocabulary_review", sourceId: key, amount }, { session, now });
							xp = { awarded: awarded.awarded, total: awarded.totalXp, reason: awarded.reason };
						}
					}
				}
				await VocabularyReviewEvent.create([{ _id: eventId, user: userId, word: wordId, inputHash, correct, completedAt: now }], { session });
				return { updatedVocab: word, correct, xp };
			}, { readPreference: "primary", readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
		} catch (error) {
			const collision = (error.keyPattern?.user && (error.keyPattern?.date || error.keyPattern?.awardKey)) || error.keyPattern?._id;
			if (error.code !== 11000 || !collision || attempt === 2) throw error;
		}
	}
}

module.exports = { reviewVocabulary, stableWordKey, getReviewOutcome, scheduleVocabularyReview };
