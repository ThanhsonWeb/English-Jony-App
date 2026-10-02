export function createReviewQuestionState(sessionState = null) {
	return {
		sessionState,
		selectedAnswer: "",
		answer: "",
		submitted: false,
		result: null,
		feedback: null,
		example: null,
		revealed: false,
		temporarilyDisabled: false,
	};
}

export function reviewQuestionReducer(state, action) {
	switch (action.type) {
		case "session-changed": {
			const previous = state.sessionState;
			const next = action.sessionState;
			const questionChanged = previous && (
				previous.currentIndex !== next.currentIndex ||
				previous.phase !== next.phase ||
				(previous.waitingForContinue && !next.waitingForContinue)
			);

			return questionChanged
				? createReviewQuestionState(next)
				: { ...state, sessionState: next };
		}
		case "reset":
			return createReviewQuestionState(state.sessionState);
		case "question-changed":
			return createReviewQuestionState({
				...state.sessionState,
				currentIndex: action.index,
			});
		case "selected-answer":
			return { ...state, selectedAnswer: action.value };
		case "answer":
			return { ...state, answer: action.value };
		case "feedback":
			return {
				...state,
				submitted: true,
				result: action.value.type,
				feedback: action.value,
				example: action.value.example || null,
				revealed: action.value.type === "wrong",
			};
		case "reveal":
			return { ...state, revealed: action.value };
		case "temporarily-disabled":
			return { ...state, temporarilyDisabled: action.value };
		default:
			return state;
	}
}
