import assert from "node:assert/strict";
import test from "node:test";
import { readUnreadFeedbackCount } from "./adminFeedbackNotifications.mjs";

test("unread feedback count accepts only non-negative safe integers", () => {
	assert.equal(readUnreadFeedbackCount({ data: { count: 7 } }), 7);
	assert.equal(readUnreadFeedbackCount({ data: { count: 0 } }), 0);
	for (const count of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1, "7", null]) {
		assert.equal(readUnreadFeedbackCount({ data: { count } }), 0);
	}
	assert.equal(readUnreadFeedbackCount(null), 0);
});
