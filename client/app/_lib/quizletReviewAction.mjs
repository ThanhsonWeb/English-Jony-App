export function submitQuizletReviewAnswer({ reviewSave, session, index, wordId, mode, answer, correctAnswer, practice, correct }) {
	if (typeof reviewSave.submitRetryAnswer !== "function") {
		throw new TypeError("Review saver is missing submitRetryAnswer");
	}
	if (session.getSnapshot().waitingForContinue) return { accepted: false };

	const attempt = reviewSave.submitRetryAnswer(index, wordId, { mode, answer, practice }, correct);
	if (!attempt.accepted) return { accepted: false };
	const nextSession = session.answer(correct);
	return {
		accepted: nextSession.accepted,
		firstAttempt: attempt.firstAttempt,
		state: nextSession.state,
		feedback: correct ? { type: "correct" } : { type: "wrong", answer: correctAnswer },
	};
}
