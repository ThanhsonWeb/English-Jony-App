"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const mongoose = require("mongoose");

const DATABASE_NAME = "english-learning";
const USER_COLLECTION = "users";
const INTENT_COLLECTION = "avataruploadintents";
const cloudNamePattern = /^[a-zA-Z0-9_-]+$/;
const objectIdPattern = /^[0-9a-f]{24}$/;
const extensions = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const localFilePattern = new RegExp(`^user_([0-9a-f]{24})_(${uuid})\\.(jpg|png|webp)$`);
const uploadStatuses = new Set(["reserved", "uploading", "uncertain", "finished"]);
const uploadResults = new Set([null, "success", "failure", "unknown", "not_started"]);
const attachmentStatuses = new Set(["attached", "unattached"]);
const cleanupStatuses = new Set(["none", "pending", "claimed", "retry", "complete"]);

function idString(value) {
	if (value && typeof value.toHexString === "function") return value.toHexString().toLowerCase();
	return typeof value === "string" && objectIdPattern.test(value) ? value.toLowerCase() : null;
}

function isPresentAvatar(avatar) {
	return avatar !== undefined && avatar !== "";
}

function isValidStorageKey(intent) {
	const owner = idString(intent.user);
	const extension = extensions[intent.contentType];
	if (!owner || !extension || typeof intent.storageKey !== "string") return false;
	const stem = `user_${owner}_${uuid}`;
	if (intent.provider === "local") return new RegExp(`^${stem}\\.${extension}$`).test(intent.storageKey);
	return intent.provider === "cloudinary" && typeof intent.cloudName === "string" &&
		cloudNamePattern.test(intent.cloudName) && new RegExp(`^studyjony/avatars/${stem}$`).test(intent.storageKey);
}

function avatarMatchesIntent(avatar, intent) {
	if (typeof avatar !== "string" || avatar.length === 0 || !isValidStorageKey(intent)) return false;
	const extension = extensions[intent.contentType];
	if (intent.provider === "local") return avatar === `/api/v1/users/avatar-files/${intent.storageKey}`;
	try {
		const url = new URL(avatar);
		const match = url.pathname.match(/^\/([^/]+)\/image\/upload\/v[1-9][0-9]*\/(.+)$/);
		return url.protocol === "https:" && url.hostname === "res.cloudinary.com" && !url.port &&
			!url.username && !url.password && !url.search && !url.hash && Boolean(match) &&
			match[1] === intent.cloudName && match[2] === `${intent.storageKey}.${extension}`;
	} catch {
		return false;
	}
}

function safeUploadOutcome(intent) {
	return (intent.uploadStatus === "reserved" && [null, "not_started"].includes(intent.uploadResult ?? null)) ||
		(intent.uploadStatus === "finished" && ["success", "failure"].includes(intent.uploadResult));
}

function isIntentInconsistent(intent, owner, pointerId) {
	const ownerId = idString(intent.user);
	const id = idString(intent._id);
	const notStartedReconciled = intent.uploadStatus === "finished" && intent.uploadResult === "not_started" &&
		intent.attachmentStatus === "unattached" && intent.cleanupStatus === "complete";
	return !id || !ownerId || !["cloudinary", "local"].includes(intent.provider) ||
		!isValidStorageKey(intent) || !uploadStatuses.has(intent.uploadStatus) ||
		!uploadResults.has(intent.uploadResult ?? null) || !attachmentStatuses.has(intent.attachmentStatus) ||
		!cleanupStatuses.has(intent.cleanupStatus) ||
		(intent.attachmentStatus === "attached" && (!owner || pointerId !== id ||
			intent.uploadStatus !== "finished" || intent.uploadResult !== "success" || intent.cleanupStatus !== "none" ||
			!avatarMatchesIntent(owner.avatar, intent))) ||
		(intent.uploadStatus === "uploading" && intent.cleanupStatus !== "pending") ||
		(intent.uploadStatus === "uncertain" && !["pending", "retry", "claimed"].includes(intent.cleanupStatus)) ||
		(intent.cleanupStatus === "complete" && intent.attachmentStatus !== "unattached") ||
		(intent.uploadResult === "not_started" && !notStartedReconciled) ||
		(intent.uploadStatus === "finished" && !["success", "failure", "not_started"].includes(intent.uploadResult)) ||
		(intent.attachmentStatus === "unattached" && intent.uploadStatus === "finished" &&
			["success", "failure"].includes(intent.uploadResult) && intent.cleanupStatus === "none");
}

async function listCollectionNames(db) {
	return (await db.listCollections({}, { nameOnly: true }).toArray()).map(item => item.name);
}

async function listLocalEntries(directory) {
	return (await fs.readdir(directory, { withFileTypes: true }))
		.map(entry => ({ name: entry.name, isFile: entry.isFile() }));
}

function emptyCounts() {
	return {
		usersWithUntrackedLegacyAvatars: 0,
		usersWithTrackingInconsistencies: 0,
		intentsWithTrackingInconsistencies: 0,
		cloudinaryIntentsMissingOrInvalidIdentity: 0,
		cloudinaryIntentsMismatchedIdentity: 0,
		attachedCloudinaryUrlMismatches: 0,
		cleanupPendingIntents: 0,
		cleanupRetryIntents: 0,
		cleanupClaimedIntents: 0,
		uncertainUploadIntents: 0,
		localFilesPendingCleanup: 0,
		localFilesClaimedCleanup: 0,
		localCleanupIntentsMissingFile: 0,
		localOrphanFiles: 0,
		localUnrecognizedFiles: 0,
		localFilesWithTrackingInconsistencies: 0,
	};
}

function inspectSnapshot(users, intents, expectedCloudName) {
	const counts = emptyCounts();
	const usersById = new Map(users.map(user => [idString(user._id), user]));
	const intentsById = new Map();
	const intentsByUser = new Map();
	for (const intent of intents) {
		const id = idString(intent._id);
		const ownerId = idString(intent.user);
		if (id) intentsById.set(id, intent);
		if (ownerId) {
			if (!intentsByUser.has(ownerId)) intentsByUser.set(ownerId, []);
			intentsByUser.get(ownerId).push(intent);
		}
		if (intent.provider === "cloudinary") {
			if (typeof intent.cloudName !== "string" || !cloudNamePattern.test(intent.cloudName)) {
				counts.cloudinaryIntentsMissingOrInvalidIdentity++;
			} else if (intent.cloudName !== expectedCloudName) {
				counts.cloudinaryIntentsMismatchedIdentity++;
			}
		}
		if (intent.cleanupStatus === "pending") counts.cleanupPendingIntents++;
		if (intent.cleanupStatus === "retry") counts.cleanupRetryIntents++;
		if (intent.cleanupStatus === "claimed") counts.cleanupClaimedIntents++;
		if (intent.uploadStatus === "uncertain" || intent.uploadResult === "unknown") counts.uncertainUploadIntents++;
	}
	const attachedByUser = new Map();
	for (const intent of intents) {
		if (intent.attachmentStatus === "attached") {
			const ownerId = idString(intent.user);
			if (ownerId) attachedByUser.set(ownerId, (attachedByUser.get(ownerId) || 0) + 1);
		}
	}
	for (const user of users) {
		const userId = idString(user._id);
		const pointerId = idString(user.avatarIntent);
		const avatarPresent = isPresentAvatar(user.avatar);
		let inconsistent = (user.avatar !== undefined && typeof user.avatar !== "string") ||
			(user.avatarIntent !== undefined && user.avatarIntent !== null && !pointerId) ||
			(attachedByUser.get(userId) || 0) > 1;
		if (!pointerId && avatarPresent) counts.usersWithUntrackedLegacyAvatars++;
		for (const intent of intentsByUser.get(userId) || []) {
			if (intent.attachmentStatus === "attached" && idString(intent._id) !== pointerId) inconsistent = true;
		}
		if (pointerId) {
			const intent = intentsById.get(pointerId);
			if (!intent || idString(intent.user) !== userId || intent.attachmentStatus !== "attached" ||
				!avatarMatchesIntent(user.avatar, intent)) {
				inconsistent = true;
				if (intent?.provider === "cloudinary" && !avatarMatchesIntent(user.avatar, intent)) {
					counts.attachedCloudinaryUrlMismatches++;
				}
			}
		}
		if (inconsistent) counts.usersWithTrackingInconsistencies++;
	}
	for (const intent of intents) {
		const owner = usersById.get(idString(intent.user));
		const pointerId = owner && idString(owner.avatarIntent);
		if (isIntentInconsistent(intent, owner, pointerId)) {
			counts.intentsWithTrackingInconsistencies++;
			if (intent.provider === "local") counts.localFilesWithTrackingInconsistencies++;
		}
	}
	return { counts, intents };
}

async function countLocalFiles(directory, intents, counts) {
	const entries = await listLocalEntries(directory);
	const localIntents = intents.filter(intent => intent.provider === "local");
	const byKey = new Map(localIntents.map(intent => [intent.storageKey, intent]));
	const seen = new Set();
	for (const entry of entries) {
		const match = localFilePattern.exec(entry.name);
		if (!entry.isFile || !match) {
			counts.localUnrecognizedFiles++;
			continue;
		}
		seen.add(entry.name);
		const intent = byKey.get(entry.name);
		if (!intent) {
			counts.localOrphanFiles++;
			continue;
		}
		if (!isValidStorageKey(intent)) counts.localFilesWithTrackingInconsistencies++;
		if (intent.attachmentStatus === "unattached" && safeUploadOutcome(intent)) {
			if (["pending", "retry"].includes(intent.cleanupStatus)) counts.localFilesPendingCleanup++;
			if (intent.cleanupStatus === "claimed") counts.localFilesClaimedCleanup++;
		}
	}
	for (const intent of localIntents) {
		if (["pending", "retry"].includes(intent.cleanupStatus) && safeUploadOutcome(intent) && !seen.has(intent.storageKey)) {
			counts.localCleanupIntentsMissingFile++;
		}
	}
}

async function runAvatarDeletionAudit({
	uri,
	expectedCloudName,
	localAvatarDirectory,
	MongoClientClass = mongoose.mongo.MongoClient,
} = {}) {
	if (typeof uri !== "string" || !/^mongodb(?:\+srv)?:\/\//i.test(uri) ||
		typeof expectedCloudName !== "string" || !cloudNamePattern.test(expectedCloudName) ||
		typeof localAvatarDirectory !== "string" || !path.isAbsolute(localAvatarDirectory) ||
		typeof MongoClientClass !== "function") {
		throw new Error("Invalid audit configuration");
	}
	const client = new MongoClientClass(uri, { readPreference: "primary", retryWrites: false });
	try {
		await client.connect();
		const db = client.db(DATABASE_NAME);
		const collectionNames = await listCollectionNames(db);
		if (!collectionNames.includes(USER_COLLECTION) || !collectionNames.includes(INTENT_COLLECTION)) {
			throw new Error("Required collection missing");
		}
		const session = client.startSession();
		let snapshot;
		try {
			snapshot = await session.withTransaction(async () => {
				const users = await db.collection(USER_COLLECTION).find({}, {
					projection: { _id: 1, avatar: 1, avatarIntent: 1 },
					session,
				}).toArray();
				const intents = await db.collection(INTENT_COLLECTION).find({}, {
					projection: {
						_id: 1, user: 1, provider: 1, cloudName: 1, contentType: 1, storageKey: 1,
						uploadStatus: 1, uploadResult: 1, attachmentStatus: 1, cleanupStatus: 1,
					},
					session,
				}).toArray();
				return inspectSnapshot(users, intents, expectedCloudName);
			}, { readPreference: "primary", readConcern: { level: "snapshot" } });
		} finally {
			await session.endSession();
		}
		await countLocalFiles(localAvatarDirectory, snapshot.intents, snapshot.counts);
		return snapshot.counts;
	} finally {
		await client.close();
	}
}

async function main({ env = process.env, write = value => process.stdout.write(value) } = {}) {
	try {
		const counts = await runAvatarDeletionAudit({
			uri: env.AVATAR_AUDIT_DATABASE,
			expectedCloudName: env.CLOUDINARY_CLOUD_NAME,
			localAvatarDirectory: env.AVATAR_AUDIT_LOCAL_DIR || path.resolve(__dirname, "../local-avatars"),
		});
		write(`${JSON.stringify(counts)}\n`);
		return 0;
	} catch {
		write("UNVERIFIED\n");
		return 1;
	}
}

if (require.main === module) main().then(code => { process.exitCode = code; });

module.exports = { runAvatarDeletionAudit, main, isValidStorageKey, avatarMatchesIntent };
