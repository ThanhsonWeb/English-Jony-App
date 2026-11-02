export const ADMIN_FEEDBACK_COUNT_CHANGED_EVENT = "studyjony:admin-feedback-count-changed";

export function notifyAdminFeedbackCountChanged() {
	if (typeof window !== "undefined") {
		window.dispatchEvent(new Event(ADMIN_FEEDBACK_COUNT_CHANGED_EVENT));
	}
}

export function readUnreadFeedbackCount(payload) {
	const count = payload?.data?.count;
	return Number.isSafeInteger(count) && count >= 0 ? count : 0;
}
