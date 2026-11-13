const test = require("node:test");
const assert = require("node:assert/strict");
const User = require("../models/userModel");
const reviewEvents = require("../services/deleteVocabularyReviewEvents");
const vocabularies = require("../services/deleteVocabularies");
const topics = require("../services/deleteTopics");
const dialogueProgress = require("../services/deleteDialogueProgress");
const studyActivities = require("../services/deleteStudyActivities");
const xpEvents = require("../services/deleteXpEvents");
const dialogueAttempts = require("../services/deleteDialogueAttempts");
const avatarIntents = require("../services/deleteCompletedAvatarIntents");
const readiness = require("../services/accountDeletionReadiness");
const finalization = require("../services/finalizeAccountDeletion");
const { coordinateAccountDeletion } = require("../services/accountDeletionCoordinator");

const userId = "64b000000000000000000001";
const stepServices = [
	[reviewEvents, "deleteVocabularyReviewEvents"],
	[vocabularies, "deleteVocabularies"],
	[topics, "deleteTopics"],
	[dialogueProgress, "deleteDialogueProgress"],
	[studyActivities, "deleteStudyActivities"],
	[xpEvents, "deleteXpEvents"],
	[dialogueAttempts, "deleteDialogueAttempts"],
	[avatarIntents, "deleteCompletedAvatarIntents"],
];

function mockUser(t, initialState = "deleting") {
	let lifecycleState = initialState;
	t.mock.method(User, "findById", id => {
		assert.equal(String(id), userId);
		return {
			select(selection) {
				assert.equal(selection, "+lifecycleState");
				return { lean: async () => lifecycleState ? { lifecycleState } : null };
			},
		};
	});
	return state => { lifecycleState = state; };
}

function mockSteps(t, run) {
	const calls = [];
	for (const [module, method] of stepServices) {
		t.mock.method(module, method, async id => {
			calls.push(method);
			assert.equal(String(id), userId);
			return run ? run(method) : {};
		});
	}
	return calls;
}

test("coordinator rejects accounts that are missing or not deleting before cleanup", async t => {
	const setLifecycleState = mockUser(t, "active");
	const calls = mockSteps(t);
	t.mock.method(readiness, "checkAccountDeletionReadiness", async () => assert.fail("readiness must not run"));
	t.mock.method(finalization, "finalizeAccountDeletion", async () => assert.fail("finalizer must not run"));

	await assert.rejects(coordinateAccountDeletion(userId), /not deleting/);
	assert.deepEqual(calls, []);

	setLifecycleState(null);
	await assert.rejects(coordinateAccountDeletion(userId), /not found/);
	assert.deepEqual(calls, []);
});

test("coordinator stops after one bounded step reports more work", async t => {
	mockUser(t);
	const calls = mockSteps(t, method => method === "deleteVocabularies" ? { deletedCount: 100, hasMore: true } : {});
	t.mock.method(readiness, "checkAccountDeletionReadiness", async () => assert.fail("readiness must wait"));
	t.mock.method(finalization, "finalizeAccountDeletion", async () => assert.fail("finalizer must wait"));

	assert.deepEqual(await coordinateAccountDeletion(userId), { status: "in_progress", step: "vocabularies" });
	assert.deepEqual(calls, ["deleteVocabularyReviewEvents", "deleteVocabularies"]);
});

test("failed cleanup propagates for retry and finalization occurs only after retry completes", async t => {
	mockUser(t);
	let failedOnce = false;
	const calls = mockSteps(t, method => {
		if (method === "deleteVocabularies" && !failedOnce) {
			failedOnce = true;
			throw new Error("temporary transaction failure");
		}
		return {};
	});
	t.mock.method(readiness, "checkAccountDeletionReadiness", async () => ({ ready: true, blockers: [], remainingCounts: {} }));
	let finalized = 0;
	t.mock.method(finalization, "finalizeAccountDeletion", async () => { finalized += 1; });

	await assert.rejects(coordinateAccountDeletion(userId), /temporary transaction failure/);
	assert.equal(finalized, 0);

	assert.deepEqual(await coordinateAccountDeletion(userId), { status: "completed" });
	assert.equal(finalized, 1);
	assert.equal(calls.filter(name => name === "deleteVocabularyReviewEvents").length, 2);
});

test("readiness blockers prevent finalization", async t => {
	mockUser(t);
	mockSteps(t);
	const result = {
		ready: false,
		blockers: ["avatar_cleanup_pending"],
		remainingCounts: { avatarUploadIntents: 1 },
	};
	t.mock.method(readiness, "checkAccountDeletionReadiness", async () => result);
	t.mock.method(finalization, "finalizeAccountDeletion", async () => assert.fail("blocked account must not finalize"));

	assert.deepEqual(await coordinateAccountDeletion(userId), {
		status: "blocked",
		blockers: result.blockers,
		remainingCounts: result.remainingCounts,
	});
});

test("all cleanup steps run in order before readiness and finalization", async t => {
	mockUser(t);
	const sequence = [];
	for (const [module, method] of stepServices) {
		t.mock.method(module, method, async () => { sequence.push(method); return {}; });
	}
	t.mock.method(readiness, "checkAccountDeletionReadiness", async () => {
		sequence.push("readiness");
		return { ready: true, blockers: [], remainingCounts: {} };
	});
	t.mock.method(finalization, "finalizeAccountDeletion", async () => {
		sequence.push("finalize");
		return { deleted: true };
	});

	assert.deepEqual(await coordinateAccountDeletion(userId), { status: "completed" });
	assert.deepEqual(sequence, [
		"deleteVocabularyReviewEvents",
		"deleteVocabularies",
		"deleteTopics",
		"deleteDialogueProgress",
		"deleteStudyActivities",
		"deleteXpEvents",
		"deleteDialogueAttempts",
		"deleteCompletedAvatarIntents",
		"readiness",
		"finalize",
	]);
});
