export function createMistakeReviewSession(totalWords) {
	let phase = "main";
	let currentIndex = 0;
	let missed = [];
	let currentRound = [];
	let nextRound = [];
	let roundTotal = 0;
	let roundCompleted = 0;
	let waitingForContinue = false;
	let finished = totalWords === 0;

	function snapshot() {
		return {
			phase,
			currentIndex,
			waitingForContinue,
			finished,
			current: phase === "main" ? currentIndex + 1 : roundCompleted + 1,
			total: phase === "main" ? totalWords : roundTotal,
			mistakesRemaining: missed.length + currentRound.length + nextRound.length,
		};
	}

	function advance() {
		if (phase === "main") {
			if (currentIndex + 1 < totalWords) {
				currentIndex += 1;
			} else if (missed.length > 0) {
				phase = "mistakes";
				currentRound = missed;
				missed = [];
				roundTotal = currentRound.length;
				currentIndex = currentRound[0];
			} else {
				finished = true;
			}
			return;
		}

		currentRound.shift();
		roundCompleted += 1;
		if (currentRound.length > 0) {
			currentIndex = currentRound[0];
		} else if (nextRound.length > 0) {
			currentRound = nextRound;
			nextRound = [];
			roundTotal = currentRound.length;
			roundCompleted = 0;
			currentIndex = currentRound[0];
		} else {
			finished = true;
		}
	}

	return {
		getSnapshot: snapshot,
		answer(correct) {
			if (finished || waitingForContinue) return { accepted: false, state: snapshot() };
			if (correct) {
				advance();
			} else {
				if (phase === "main") missed.push(currentIndex);
				else nextRound.push(currentIndex);
				waitingForContinue = true;
			}
			return { accepted: true, state: snapshot() };
		},
		continueAfterWrong() {
			if (!waitingForContinue) return { accepted: false, state: snapshot() };
			waitingForContinue = false;
			advance();
			return { accepted: true, state: snapshot() };
		},
	};
}
