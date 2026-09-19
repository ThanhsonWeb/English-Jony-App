const mongoose = require("mongoose");
const { createHash } = require("node:crypto");
const Vocab = require("../models/vocabModel");
const User = require("../models/userModel");
const XPEvent = require("../models/xpEventModel");
const StudyActivity = require("../models/studyActivityModel");
const AppError = require("../utils/appError");
const awardXp = require("./awardXp");
const { markQualifiedStudy, vietnamDay } = require("./studyStreak");

const normalizeAnswer = text => text.trim().toLowerCase();
const stableWordKey = text => createHash("sha256").update(text.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ")).digest("hex");

async function reviewVocabulary(userId, wordId, input, { now = new Date() } = {}) {
	const { mode, answer, rating, practice = false } = input;
	if (!mongoose.isObjectIdOrHexString(wordId) || !["flashcard", "quiz", "writing"].includes(mode) || typeof practice !== "boolean") {
		throw new AppError("Invalid vocabulary review", 400);
	}
	const ratings = ["again", "hard", "medium", "easy"];
	if (mode === "flashcard" ? !ratings.includes(rating) : typeof answer !== "string" || !answer.trim() || answer.length > 10000) {
		throw new AppError("A valid rating or answer is required", 400);
	}
	await Promise.all([XPEvent.init(), StudyActivity.init()]);
	const dayKey = vietnamDay(now);
	for (let attempt = 0; attempt < 3; attempt += 1) {
		try {
			return await mongoose.connection.transaction(async session => {
				const word = await Vocab.findOne({ _id: wordId, user: userId }).session(session);
				if (!word) throw new AppError("Vocabulary not found", 404);
				const correct = mode === "flashcard" ? rating !== "again" : normalizeAnswer(answer) === normalizeAnswer(mode === "quiz" ? word.vietnamese : word.english);
				const level = mode === "flashcard" ? ratings.indexOf(rating) : correct ? 2 : 0;
				if (!practice) {
					const intervals = { 1: [1, 3, 7, 14], 2: [3, 7, 14, 30], 3: [7, 14, 30, 60] };
					const count = word.reviewCount || 0;
					const hours = level === 0 ? 1 : intervals[level][Math.min(Math.max(count, 0), 3)] * 24;
					word.learningLevel = level;
					word.reviewCount = level === 0 ? 0 : count + 1;
					word.nextReview = new Date(now.getTime() + hours * 3600000);
					await word.save({ session });
				}
				// The shared daily write serializes reviews of different words too.
				// A racing transaction retries before reading the daily XP sum.
				await markQualifiedStudy(userId, { session, now });
				await StudyActivity.updateOne({ user: userId, date: dayKey }, { $inc: { vocabularyReviewVersion: 1 } }, { session });
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
				return { updatedVocab: word, correct, xp };
			}, { readPreference: "primary", readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
		} catch (error) {
			const collision = error.keyPattern?.user && (error.keyPattern?.date || error.keyPattern?.awardKey);
			if (error.code !== 11000 || !collision || attempt === 2) throw error;
		}
	}
}

module.exports = { reviewVocabulary, stableWordKey };
