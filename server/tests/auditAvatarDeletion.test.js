"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");

const modelNamesBeforeAuditImport = mongoose.modelNames();
const { runAvatarDeletionAudit, main } = require("../scripts/audit-avatar-deletion");
assert.deepEqual(mongoose.modelNames(), modelNamesBeforeAuditImport, "audit module must not initialize Mongoose models");

const uuid = () => crypto.randomUUID();
const asUrl = (cloud, key) => `https://res.cloudinary.com/${cloud}/image/upload/v123/${key}.jpg`;

function intent(user, provider, storageKey, overrides = {}) {
	return {
		_id: new mongoose.Types.ObjectId(),
		user,
		operationId: `op-${Math.random()}`,
		provider,
		...(provider === "cloudinary" ? { cloudName: "expected_cloud" } : {}),
		contentType: "image/jpeg",
		storageKey,
		uploadStatus: "reserved",
		uploadResult: null,
		attachmentStatus: "unattached",
		cleanupStatus: "none",
		...overrides,
	};
}

test("read-only snapshot audit counts avatar risks without network or database writes", async t => {
	const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
	const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "studyjony-avatar-audit-"));
	t.after(async () => {
		await fs.rm(tempDirectory, { recursive: true, force: true });
		await replSet.stop();
	});

	const uri = replSet.getUri("english-learning");
	const seedClient = new mongoose.mongo.MongoClient(uri);
	await seedClient.connect();
	const db = seedClient.db("english-learning");
	await db.createCollection("users");
	await db.createCollection("avataruploadintents");

	const users = db.collection("users");
	const intents = db.collection("avataruploadintents");
	const legacyUserId = new mongoose.Types.ObjectId();
	const attachedUserId = new mongoose.Types.ObjectId();
	const mismatchUserId = new mongoose.Types.ObjectId();
	const malformedUserId = new mongoose.Types.ObjectId();
	const pointerUserId = new mongoose.Types.ObjectId();
	const localAttachedUserId = new mongoose.Types.ObjectId();

	const attachedKey = `studyjony/avatars/user_${attachedUserId}_${uuid()}`;
	const attachedIntent = intent(attachedUserId, "cloudinary", attachedKey, {
		uploadStatus: "finished", uploadResult: "success", attachmentStatus: "attached",
	});
	const mismatchKey = `studyjony/avatars/user_${mismatchUserId}_${uuid()}`;
	const mismatchIntent = intent(mismatchUserId, "cloudinary", mismatchKey, {
		cloudName: "other_cloud", uploadStatus: "finished", uploadResult: "success", attachmentStatus: "attached",
	});
	const orphanAttachedKey = `studyjony/avatars/user_${attachedUserId}_${uuid()}`;
	const orphanAttachedIntent = intent(attachedUserId, "cloudinary", orphanAttachedKey, {
		uploadStatus: "finished", uploadResult: "success", attachmentStatus: "attached",
	});
	const urlMismatchUserId = new mongoose.Types.ObjectId();
	const urlMismatchKey = `studyjony/avatars/user_${urlMismatchUserId}_${uuid()}`;
	const urlMismatchIntent = intent(urlMismatchUserId, "cloudinary", urlMismatchKey, {
		uploadStatus: "finished", uploadResult: "success", attachmentStatus: "attached",
	});
	const missingIdentityUserId = new mongoose.Types.ObjectId();
	const missingIdentity = intent(missingIdentityUserId, "cloudinary",
		`studyjony/avatars/user_${missingIdentityUserId}_${uuid()}`,
		{ cloudName: undefined, cleanupStatus: "retry", uploadStatus: "finished", uploadResult: "failure" });
	const claimedUserId = new mongoose.Types.ObjectId();
	const claimedIntent = intent(claimedUserId, "cloudinary",
		`studyjony/avatars/user_${claimedUserId}_${uuid()}`,
		{ cleanupStatus: "claimed", uploadStatus: "uncertain", uploadResult: "unknown" });
	const retryUserId = new mongoose.Types.ObjectId();
	const retryIntent = intent(retryUserId, "cloudinary",
		`studyjony/avatars/user_${retryUserId}_${uuid()}`,
		{ cleanupStatus: "retry", uploadStatus: "finished", uploadResult: "failure" });
	const pendingUserId = new mongoose.Types.ObjectId();
	const pendingIntent = intent(pendingUserId, "cloudinary",
		`studyjony/avatars/user_${pendingUserId}_${uuid()}`,
		{ cleanupStatus: "pending", uploadStatus: "reserved", uploadResult: null });
	const localPendingUserId = new mongoose.Types.ObjectId();
	const localPending = intent(localPendingUserId, "local",
		`user_${localPendingUserId}_${uuid()}.jpg`,
		{ cleanupStatus: "pending", uploadStatus: "finished", uploadResult: "failure" });
	const localClaimedUserId = new mongoose.Types.ObjectId();
	const localClaimed = intent(localClaimedUserId, "local",
		`user_${localClaimedUserId}_${uuid()}.jpg`,
		{ cleanupStatus: "claimed", uploadStatus: "reserved", uploadResult: null });
	const localUncertainUserId = new mongoose.Types.ObjectId();
	const localUncertain = intent(localUncertainUserId, "local",
		`user_${localUncertainUserId}_${uuid()}.jpg`,
		{ cleanupStatus: "pending", uploadStatus: "uploading", uploadResult: null });
	const localMissingFileUserId = new mongoose.Types.ObjectId();
	const localMissingFile = intent(localMissingFileUserId, "local",
		`user_${localMissingFileUserId}_${uuid()}.jpg`,
		{ cleanupStatus: "retry", uploadStatus: "finished", uploadResult: "failure" });
	const localAttachedKey = `user_${localAttachedUserId}_${uuid()}.jpg`;
	const localAttached = intent(localAttachedUserId, "local", localAttachedKey, {
		uploadStatus: "finished", uploadResult: "success", attachmentStatus: "attached",
	});
	const brokenTrackingUserId = new mongoose.Types.ObjectId();
	const brokenTracking = intent(brokenTrackingUserId, "local",
		`user_${brokenTrackingUserId}_${uuid()}.jpg`,
		{ cleanupStatus: "none", uploadStatus: "finished", uploadResult: "success" });
	const localCompletedUserId = new mongoose.Types.ObjectId();
	const localCompleted = intent(localCompletedUserId, "local",
		`user_${localCompletedUserId}_${uuid()}.jpg`,
		{ cleanupStatus: "complete", uploadStatus: "finished", uploadResult: "not_started" });

	await users.insertMany([
		{ _id: legacyUserId, avatar: "  " },
		{ _id: attachedUserId, avatar: asUrl("expected_cloud", attachedKey), avatarIntent: attachedIntent._id },
		{ _id: mismatchUserId, avatar: asUrl("other_cloud", mismatchKey), avatarIntent: mismatchIntent._id },
		{ _id: urlMismatchUserId, avatar: asUrl("other_cloud", urlMismatchKey), avatarIntent: urlMismatchIntent._id },
		{ _id: malformedUserId, avatar: 42 },
		{ _id: pointerUserId, avatar: "", avatarIntent: "not-an-object-id" },
		{ _id: localAttachedUserId, avatar: `/api/v1/users/avatar-files/${localAttachedKey}`, avatarIntent: localAttached._id },
	]);
	await intents.insertMany([
		attachedIntent, orphanAttachedIntent, mismatchIntent, urlMismatchIntent, missingIdentity, claimedIntent, retryIntent, pendingIntent,
		localPending, localClaimed, localUncertain, localMissingFile, localAttached, brokenTracking, localCompleted,
	]);
	await users.insertMany([
		missingIdentityUserId, claimedUserId, retryUserId, pendingUserId, localPendingUserId,
		localClaimedUserId, localUncertainUserId, localMissingFileUserId, brokenTrackingUserId, localCompletedUserId,
	].map(_id => ({ _id, avatar: "" })));

	for (const fileName of [localPending.storageKey, localClaimed.storageKey, localUncertain.storageKey,
		localAttached.storageKey, localCompleted.storageKey, `user_${new mongoose.Types.ObjectId()}_${uuid()}.jpg`, "notes.txt"]) {
		await fs.writeFile(path.join(tempDirectory, fileName), "mock", { flag: "wx" });
	}
	await seedClient.close();

	const startedCommands = [];
	const writes = [];
	class MonitoringClient extends mongoose.mongo.MongoClient {
		constructor(connectionString, options) {
			super(connectionString, { ...options, monitorCommands: true });
			this.on("commandStarted", event => {
				startedCommands.push({ commandName: event.commandName, command: event.command });
				if (["insert", "update", "delete", "findAndModify", "createIndexes", "drop"].includes(event.commandName)) {
					writes.push(event.commandName);
				}
			});
		}
	}
	let fetchCalls = 0;
	const originalFetch = global.fetch;
	global.fetch = async () => { fetchCalls++; throw new Error("avatar network access is forbidden in this test"); };
	let counts;
	try {
		counts = await runAvatarDeletionAudit({
			uri,
			expectedCloudName: "expected_cloud",
			localAvatarDirectory: tempDirectory,
			MongoClientClass: MonitoringClient,
		});
	} finally {
		global.fetch = originalFetch;
	}
	assert.equal(fetchCalls, 0);
	assert.deepEqual(writes, []);
	const dataReads = startedCommands.filter(item => item.commandName === "find");
	assert.ok(dataReads.length >= 2);
	assert.ok(dataReads.every(({ command }) => command.autocommit === false && command.txnNumber !== undefined));
	assert.ok(dataReads.some(({ command }) => command.readConcern?.level === "snapshot"),
		"first transactional data read must request snapshot read concern");

	assert.equal(counts.usersWithUntrackedLegacyAvatars, 2);
	assert.equal(counts.usersWithTrackingInconsistencies, 4);
	assert.equal(counts.intentsWithTrackingInconsistencies, 4);
	assert.equal(counts.cloudinaryIntentsMissingOrInvalidIdentity, 1);
	assert.equal(counts.cloudinaryIntentsMismatchedIdentity, 1);
	assert.equal(counts.attachedCloudinaryUrlMismatches, 2);
	assert.equal(counts.cleanupPendingIntents, 3);
	assert.equal(counts.cleanupRetryIntents, 3);
	assert.equal(counts.cleanupClaimedIntents, 2);
	assert.equal(counts.uncertainUploadIntents, 1);
	assert.equal(counts.localFilesPendingCleanup, 1);
	assert.equal(counts.localFilesClaimedCleanup, 1);
	assert.equal(counts.localFilesUncertainOrUploading, 1);
	assert.equal(counts.localCleanupIntentsMissingFile, 1);
	assert.equal(counts.localOrphanFiles, 1);
	assert.equal(counts.localUnrecognizedFiles, 1);
	assert.equal(counts.localFilesWithTrackingInconsistencies, 1);
	assert.equal(counts.localIntentsWithTrackingInconsistencies, 1);
	const verifyClient = new mongoose.mongo.MongoClient(uri);
	await verifyClient.connect();
	assert.equal(await verifyClient.db("english-learning").collection("users").countDocuments({}), 17);
	assert.equal(await verifyClient.db("english-learning").collection("avataruploadintents").countDocuments({}), 15);
	await verifyClient.close();
	const serialized = JSON.stringify(counts);
	for (const privateValue of [String(legacyUserId), String(attachedUserId), asUrl("other_cloud", mismatchKey), localPending.storageKey]) {
		assert.equal(serialized.includes(privateValue), false, "output must contain aggregate counts only");
	}
});

test("CLI returns only UNVERIFIED when configuration is missing or snapshot reads fail", async () => {
	let output = "";
	const code = await main({ env: {}, write: value => { output += value; } });
	assert.equal(code, 1);
	assert.equal(output, "UNVERIFIED\n");

	class SnapshotFailureClient {
		constructor() {}
		async connect() {}
		db() {
			return { listCollections: () => ({ toArray: async () => [{ name: "users" }, { name: "avataruploadintents" }] }) };
		}
		startSession() {
			return {
				withTransaction: async () => { throw new Error("sensitive connection detail"); },
				endSession: async () => {},
			};
		}
		async close() {}
	}
	await assert.rejects(runAvatarDeletionAudit({
		uri: "mongodb://fake",
		expectedCloudName: "expected_cloud",
		localAvatarDirectory: path.resolve(os.tmpdir()),
		MongoClientClass: SnapshotFailureClient,
	}), /sensitive connection detail/);
});
