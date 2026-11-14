"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");
const mongoose = require("mongoose");

const DATABASE_NAME = "english-learning";
const USER_COLLECTION = "users";
const INTENT_COLLECTION = "avataruploadintents";
const cloudNamePattern = /^[a-zA-Z0-9_-]+$/;
const validObjectId = /^[0-9a-f]{24}$/;
const extensions = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const uuid = "[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const localFilePattern = new RegExp(`^user_([0-9a-f]{24})_(${uuid})\\.(jpg|png|webp)$`);
const allowedUploadStatuses = new Set(["reserved", "uploading", "uncertain", "finished"]);
const allowedUploadResults = new Set([null, "success", "failure", "unknown", "not_started"]);
const allowedAttachmentStatuses = new Set(["attached", "unattached"]);
const allowedCleanupStatuses = new Set(["none", "pending", "claimed", "retry", "complete"]);

function objectIdString(value) {
	if (value && typeof value.toHexString === "function") return value.toHexString().toLowerCase();
	return typeof value === "string" && validObjectId.test(value) ? value.toLowerCase() : null;
}

function hasAvatar(value) {
	return value !== undefined && value !== "";
}

function isValidStorageKey(intent) {
	const userId = objectIdString(intent.user);
	const extension = extensions[intent.contentType];
	if (!userId || !extension || typeof intent.storageKey !== "string") return false;
	const fileStem = `user_${userId}_${uuid}`;
	if (intent.provider === "local") return new RegExp(`^${fileStem}\\.${extension}$`).test(intent.storageKey);
	return intent.provider === "cloudinary" && typeof intent.cloudName === "string" &&
		cloudNamePattern.test(intent.cloudName) && new RegExp(`^studyjony/avatars/${fileStem}$`).test(intent.storageKey);
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
	return (intent.uploadStatus === "reserved" && (intent.uploadResult === null || intent.uploadResult === "not_started")) ||
		(intent.uploadStatus === "finished" && ["success", "failure"].includes(intent.uploadResult));
}

async function readCollectionNames(db, session) {
	const cursor = db.listCollections({}, { nameOnly: true, session });
	return (await cursor.toArray()).map(collection => collection.name);
}

async function collectLocalFiles(directory) {
	const entries = await fs.readdir(directory, { withFileTypes: true });
	return entries.map(entry => ({ name: entry.name, isFile: entry.isFile() }));
}

function newCounts() {
	return {
		usersWithUntrackedLegacyAvatars: 0,
		usersWithTrackingInconsistencies: 0,
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

function inspectDatabase(users, intents, expectedCloudName, counts) {
	const intentsById = new Map();
	const intentsByUser = new Map();
	for (const intent of intents) {
		const id = objectIdString(intent._id);
		if (id) intentsById.set(id, intent);
		const ownerId = objectIdString(intent.user);
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
		if (!isValidStorageKey(intent) || !allowedUploadStatuses.has(intent.uploadStatus) ||
			!allowedUploadResults.has(intent.uploadResult ?? null) ||
			!allowedAttachmentStatuses.has(intent.attachmentStatus) ||
			!allowedCleanupStatuses.has(intent.cleanupStatus)) {
			if (intent.provider === "local") counts.localFilesWithTrackingInconsistencies++;
		}
	}

	const attachedByUser = new Map();
	for (const intent of intents) {
		if (intent.attachmentStatus !== "attached") continue;
		const ownerId = objectIdString(intent.user);
		if (ownerId) attachedByUser.set(ownerId, (attachedByUser.get(ownerId) || 0) + 1);
	}

	for (const user of users) {
		const userId = objectIdString(user._id);
		const pointerId = objectIdString(user.avatarIntent);
		const present = hasAvatar(user.avatar);
		let inconsistent = false;
		if (user.avatar !== undefined && typeof user.avatar !== "string") inconsistent = true;
		if (user.avatarIntent !== undefined && user.avatarIntent !== null && !pointerId) inconsistent = true;
		if (!pointerId && present) counts.usersWithUntrackedLegacyAvatars++;
		if ((attachedByUser.get(userId) || 0) > 1) inconsistent = true;
		for (const intent of (intentsByUser.get(userId) || [])) {
			if (intent.attachmentStatus === "attached" && objectIdString(intent._id) !== pointerId) inconsistent = true;
		}
		if (pointerId) {
			const intent = intentsById.get(pointerId);
			if (!intent || objectIdString(intent.user) !== userId || intent.attachmentStatus !== "attached" ||
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
		const ownerId = objectIdString(intent.user);
		const owner = users.find(user => objectIdString(user._id) === ownerId);
		const pointerId = owner && objectIdString(owner.avatarIntent);
		if (intent.attachmentStatus === "attached" && (!owner || pointerId !== objectIdString(intent._id))) {
			if (intent.provider === "local") counts.localFilesWithTrackingInconsistencies++;
		}
	}
	return { intentsById };
}

async function runAvatarDeletionAudit({
	uri,
	expectedCloudName,
	localAvatarDirectory,
	MongoClientClass = mongoose.mongo.MongoClient,
} = {}) {
	if (typeof uri !== "string" || !/^mongodb(?:\+srv)?:\/\//i.test(uri) ||
		typeof expectedCloudName !== "string" || !cloudNamePattern.test(expectedCloudName) ||
		typeof localAvatarDirectory !== "string" || !path.isAbsolute(localAvatarDirectory)) {
		throw new Error("Invalid audit configuration");
	}
	if (typeof MongoClientClass !== "function") throw new Error("MongoDB driver unavailable");

	const client = new MongoClientClass(uri, { readPreference: "primary", retryWrites: false });
	const counts = newCounts();
	try {
		await client.connect();
		const db = client.db(DATABASE_NAME);
		const session = client.startSession();
		try {
			await session.withTransaction(async () => {
				const collectionNames = await readCollectionNames(db, session);
				if (!collectionNames.includes(USER_COLLECTION) || !collectionNames.includes(INTENT_COLLECTION)) {
					throw new Error("Required collection missing");
				}
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
				inspectDatabase(users, intents, expectedCloudName, counts);
			}, { readPreference: "primary", readConcern: { level: "snapshot" } });
		} finally {
			await session.endSession();
		}
		const localFiles = await collectLocalFiles(localAvatarDirectory);
		const localIntents = [...(await db.collection(INTENT_COLLECTION).find({
			provider: "local",
		}).project({
			_id: 1, user: 1, contentType: 1, storageKey: 1, uploadStatus: 1, uploadResult: 1,
			attachmentStatus: 1, cleanupStatus: 1,
		}).toArray())];
		const byStorageKey = new Map(localIntents.map(intent => [intent.storageKey, intent]));
		const seen = new Set();
		for (const entry of localFiles) {
			const match = localFilePattern.exec(entry.name);
			if (!entry.isFile || !match) {
				counts.localUnrecognizedFiles++;
				continue;
			}
			seen.add(entry.name);
			const intent = byStorageKey.get(entry.name);
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
		return counts;
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

if (require.main === module) {
	main().then(code => { process.exitCode = code; });
}

module.exports = { runAvatarDeletionAudit, main, isValidStorageKey, avatarMatchesIntent };
