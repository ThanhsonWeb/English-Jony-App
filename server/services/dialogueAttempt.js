const { randomBytes } = require("node:crypto");
const DialogueAttempt = require("../models/dialogueAttemptModel");
const AppError = require("../utils/appError");
const { getDialogueTaskRule } = require("../utils/dialogueCatalogue");
const { fillBlankAnswersMatch } = require("../utils/fillBlankAnswer");

const ATTEMPT_TTL_MS = 10 * 60 * 1000;
const minimumAttemptMs = rule => rule.type === "review" ? 2000 : 500;

function taskRule(ids) {
	const rule = getDialogueTaskRule(...ids);
	if (!rule) throw new AppError("Dialogue task not found", 404);
	return rule;
}

async function startDialogueAttempt(userId, ids, now = new Date()) {
	const rule = taskRule(ids), taskKey = JSON.stringify(ids);
	await DialogueAttempt.init();
	// Reuse a still-open attempt rather than resetting a learner's start time.
	let attempt = await DialogueAttempt.findOne({ user: userId, taskKey, consumedAt: { $exists: false }, expiresAt: { $gt: now } }).sort({ startedAt: -1 });
	if (!attempt) attempt = await DialogueAttempt.create({
		_id: randomBytes(32).toString("hex"), user: userId, taskKey,
		startedAt: now, expiresAt: new Date(now.getTime() + ATTEMPT_TTL_MS),
	});
	return { attemptId: attempt._id, expiresAt: attempt.expiresAt,
		readyAfterMs: Math.max(0, attempt.startedAt.getTime() + minimumAttemptMs(rule) - now.getTime()) };
}

function validateCompletion(rule, input) {
	if (rule.type === "review") return input.acknowledged === true;
	if (rule.type === "multipleChoice") return Number.isInteger(input.optionIndex) && input.optionIndex === rule.answers[0];
	const answers = input.answers;
	if (!Array.isArray(answers) || answers.length !== rule.answers.length || answers.some(answer => typeof answer !== "string" || answer.length > 2000)) return false;
	return answers.every((answer, i) => {
		if (rule.type === "fillBlank") return fillBlankAnswersMatch(answer, rule.answers[i]);
		const normalize = value => rule.type === "arrangeWords"
			? value.toLowerCase().replace(/[.,!?;:]/g, "").replace(/\s+/g, " ").trim()
			: value.trim().toLocaleLowerCase("en");
		return normalize(answer) === normalize(rule.answers[i]);
	});
}

async function claimDialogueAttempt(userId, ids, input, session, now) {
	const rule = taskRule(ids);
	if (typeof input.attemptId !== "string" || !/^[a-f0-9]{64}$/.test(input.attemptId)) {
		throw new AppError("A valid study attempt is required", 400);
	}
	const attempt = await DialogueAttempt.findOne({ _id: input.attemptId, user: userId, taskKey: JSON.stringify(ids), expiresAt: { $gt: now } }).session(session);
	if (!attempt) throw Object.assign(new AppError("Study attempt expired or unavailable", 409), { code: "studyAttemptExpired" });
	if (!validateCompletion(rule, input)) throw new AppError("Task completion does not match this exercise", 400);
	const waitMs = attempt.startedAt.getTime() + minimumAttemptMs(rule) - now.getTime();
	if (waitMs > 0) throw Object.assign(new AppError("Study attempt is not ready", 409), { code: "studyAttemptNotReady", retryAfterMs: waitMs });
	if (attempt.consumedAt) return { fresh: false, attempt };
	attempt.consumedAt = now;
	await attempt.save({ session });
	return { fresh: true, attempt };
}

module.exports = { ATTEMPT_TTL_MS, minimumAttemptMs, taskRule, startDialogueAttempt, validateCompletion, claimDialogueAttempt };
