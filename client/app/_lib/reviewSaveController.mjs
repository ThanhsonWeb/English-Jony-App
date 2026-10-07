export function createReviewSaveController(sendReview) {
	let snapshot = { pending: 0, failed: 0 };
	const listeners = new Set();
	const submitted = new Set();
	const retryAttempts = new Map();

	function update(changes) {
		snapshot = { ...snapshot, ...changes };
		listeners.forEach((listener) => listener());
	}

	function save(wordId, input) {
		const eventInput = { ...input, reviewId: crypto.randomUUID() };
		update({ pending: snapshot.pending + 1 });
		try {
			void Promise.resolve(sendReview(wordId, eventInput))
				.catch(() => update({ failed: snapshot.failed + 1 }))
				.finally(() => update({ pending: snapshot.pending - 1 }));
		} catch {
			update({ failed: snapshot.failed + 1, pending: snapshot.pending - 1 });
		}
	}

	return {
		getSnapshot: () => snapshot,
		subscribe(listener) {
			listeners.add(listener);
			return () => listeners.delete(listener);
		},
		resetAnswers() {
			submitted.clear();
			retryAttempts.clear();
		},
		submitAnswer(index, wordId, input) {
			if (submitted.has(index)) return false;
			submitted.add(index);
			save(wordId, input);
			return true;
		},
		submitRetryAnswer(index, wordId, input, correct) {
			const attempt = retryAttempts.get(index);
			if (attempt?.complete) return { accepted: false, advance: false, firstAttempt: false };
			const firstAttempt = !attempt;
			if (firstAttempt) {
				retryAttempts.set(index, { complete: correct });
				save(wordId, input);
			} else if (correct) {
				attempt.complete = true;
			}
			return { accepted: true, advance: correct, firstAttempt };
		},
	};
}

export function isReviewCompletionReady(finished, pending) {
	return finished && pending === 0;
}
