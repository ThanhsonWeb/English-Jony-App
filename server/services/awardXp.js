const mongoose = require("mongoose");
const User = require("../models/userModel");
const XPEvent = require("../models/xpEventModel");

function xpError(code, message) {
	return Object.assign(new Error(message), { code });
}

function validateInput({ userId, awardKey, sourceType, sourceId, amount, ruleVersion, attemptId }) {
	if (!mongoose.isObjectIdOrHexString(userId) ||
		(attemptId !== undefined && !mongoose.isObjectIdOrHexString(attemptId))) {
		throw xpError("XP_INVALID_INPUT", "A valid userId and optional attemptId are required");
	}
	for (const value of [awardKey, sourceId]) {
		if (typeof value !== "string" || !value.trim() || value.trim().length > 300) {
			throw xpError("XP_INVALID_INPUT", "awardKey and sourceId must contain 1 to 300 characters");
		}
	}
	if (!["dialogue_task", "vocabulary_review"].includes(sourceType) ||
		!Number.isSafeInteger(amount) || amount <= 0 ||
		!Number.isSafeInteger(ruleVersion) || ruleVersion <= 0) {
		throw xpError("XP_INVALID_INPUT", "A supported source and positive integer amount/ruleVersion are required");
	}
}

function duplicateResult(event, user, input) {
	if (!user) throw xpError("XP_USER_NOT_FOUND", "XP recipient does not exist");
	if (event.amount !== input.amount || event.sourceType !== input.sourceType ||
		event.sourceId !== input.sourceId || event.ruleVersion !== input.ruleVersion) {
		throw xpError("XP_AWARD_CONFLICT", "This awardKey already belongs to a different award");
	}
	return { awarded: 0, totalXp: user.totalXp ?? 0, reason: "already_awarded", eventId: event._id };
}

/**
 * Internal only: callers must verify the learning action and choose its reward/key.
 * Requires a replica set (or sharded cluster) and the XPEvent unique index.
 * Owns its transaction by default. An active caller session can be supplied
 * after initializing XPEvent indexes; that caller owns commit and retries.
 */
async function awardXp({ userId, awardKey, sourceType, sourceId, amount, ruleVersion = 1, attemptId } = {}, { session, now = new Date() } = {}) {
	validateInput({ userId, awardKey, sourceType, sourceId, amount, ruleVersion, attemptId });
	const input = { awardKey: awardKey.trim(), sourceId: sourceId.trim(), sourceType, amount, ruleVersion };
	const filter = { user: userId, awardKey: input.awardKey };
	// Fix the server timestamp once, including across automatic transaction retries.
	const earnedAt = new Date(now);
	const dayKey = new Intl.DateTimeFormat("en-CA", {
		timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit",
	}).format(earnedAt);

	const performAward = async (session) => {
		const existing = await XPEvent.findOne(filter).session(session).lean();
		if (existing) {
			const user = await User.findById(userId).select("totalXp").session(session).lean();
			return duplicateResult(existing, user, input);
		}

		const [event] = await XPEvent.create([{
			...input, user: userId, attemptId, earnedAt, dayKey,
		}], { session });

		// $inc initializes missing totals on users created before XP existed.
		// An explicit bound is needed because update validators do not validate $inc.
		const user = await User.findOneAndUpdate({
			_id: userId,
			$or: [
				{ totalXp: { $exists: false } },
				{ totalXp: { $gte: 0, $lte: Number.MAX_SAFE_INTEGER - amount } },
			],
		}, { $inc: { totalXp: amount } }, { returnDocument: "after", session }).select("totalXp").lean();

		if (!user) {
			const exists = await User.exists({ _id: userId }).session(session);
			throw xpError(exists ? "XP_INVALID_TOTAL" : "XP_USER_NOT_FOUND",
				exists ? "XP total is invalid or would exceed the safe integer limit" : "XP recipient does not exist");
		}
		return { awarded: amount, totalXp: user.totalXp, reason: "awarded", eventId: event._id };
	};

	if (session) {
		if (!session.inTransaction()) throw xpError("XP_INVALID_SESSION", "XP requires an active transaction");
		return performAward(session);
	}

	await XPEvent.init();
	try {
		return await mongoose.connection.transaction(performAward,
			{ readPreference: "primary", readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
	} catch (error) {
		// A concurrent insert may win after our first read. The losing transaction
		// has already rolled back; only this specific unique-key violation is a retry.
		if (error.code !== 11000 || !error.keyPattern?.user || !error.keyPattern?.awardKey) throw error;
		const event = await XPEvent.findOne(filter).read("primary").lean();
		if (!event) throw error;
		const user = await User.findById(userId).select("totalXp").read("primary").lean();
		return duplicateResult(event, user, input);
	}
}

module.exports = awardXp;
