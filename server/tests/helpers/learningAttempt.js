const { startDialogueAttempt, taskRule } = require("../../services/dialogueAttempt");

// Disposable-test helper: a real server-issued attempt with elapsed fixture time.
async function completionFor(userId, ids) {
	const rule = taskRule(ids);
	const attempt = await startDialogueAttempt(userId, ids, new Date(Date.now() - 3000));
	const proof = rule.type === "multipleChoice" ? { optionIndex: rule.answers[0] }
		: rule.type === "review" ? { acknowledged: true } : { answers: rule.answers };
	return { ...proof, attemptId: attempt.attemptId };
}

function idsFromPath(path) {
	const match = path.match(/\/dialogue-progress\/([^/]+)\/([^/]+)\/tasks\/([^/?]+)$/);
	return match?.slice(1).map(decodeURIComponent);
}

module.exports = { completionFor, idsFromPath };
