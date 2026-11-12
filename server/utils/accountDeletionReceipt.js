const crypto = require("node:crypto");
const mongoose = require("mongoose");
const validator = require("validator");
const AccountDeletionReceipt = require("../models/accountDeletionReceiptModel");

const SECRET_ENV = "ACCOUNT_DELETION_RECEIPT_HMAC_SECRET";
const RECEIPT_VERSION = "v1";
const MAX_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_RETENTION_MS = MAX_RETENTION_MS;
const RECEIPT_DOMAIN = "studyjony:account-deletion-receipt:v1:";

function normalizeEmail(email) {
	if (typeof email !== "string") throw new TypeError("A valid email is required");
	const normalized = email.trim().toLowerCase();
	if (!validator.isEmail(normalized)) throw new TypeError("A valid email is required");
	return normalized;
}

function getHmacSecret() {
	const secret = process.env[SECRET_ENV];
	if (typeof secret !== "string" || Buffer.byteLength(secret) < 32 || !secret.trim()) {
		throw new Error(`${SECRET_ENV} must be configured with at least 32 bytes`);
	}
	return secret;
}

function receiptIdForEmail(email) {
	const normalizedEmail = normalizeEmail(email);
	const digest = crypto.createHmac("sha256", getHmacSecret())
		.update(`${RECEIPT_DOMAIN}${normalizedEmail}`, "utf8")
		.digest("hex");
	return `${RECEIPT_VERSION}:${digest}`;
}

function validateRetention(retentionMs) {
	if (!Number.isSafeInteger(retentionMs) || retentionMs < 1 || retentionMs > MAX_RETENTION_MS) {
		throw new RangeError("Receipt retention must be a positive whole number of milliseconds, at most 30 days");
	}
}

async function findReceipt(filter, session) {
	const query = AccountDeletionReceipt.findOne(filter);
	if (session) query.session(session);
	return query.lean();
}

// Internal completion marker only. Repeated calls do not extend an unexpired receipt.
async function createAccountDeletionReceipt(email, { retentionMs = DEFAULT_RETENTION_MS, session } = {}) {
	validateRetention(retentionMs);
	if (session !== undefined && (!session || typeof session.inTransaction !== "function" || !session.inTransaction())) {
		throw new TypeError("The supplied receipt session must have an active transaction");
	}
	const _id = receiptIdForEmail(email);
	const completedAt = new Date();
	const expiresAt = new Date(completedAt.getTime() + retentionMs);
	if (session) {
		const existing = await findReceipt({ _id }, session);
		if (existing && existing.expiresAt > completedAt) return existing;
	}
	try {
		return await AccountDeletionReceipt.findOneAndUpdate(
			{ _id, expiresAt: { $lte: completedAt } },
			{ $set: { completedAt, expiresAt } },
			{ upsert: true, returnDocument: "after", runValidators: true, setDefaultsOnInsert: false, ...(session ? { session } : {}) },
		).lean();
	} catch (error) {
		if (error.code !== 11000) throw error;
		// A concurrent completion or an unexpired receipt already owns this digest.
		const existing = await findReceipt({ _id, expiresAt: { $gt: completedAt } }, session);
		if (existing) return existing;
		throw error;
	}
}

module.exports = {
	createAccountDeletionReceipt,
	receiptIdForEmail,
	MAX_RETENTION_MS,
	DEFAULT_RETENTION_MS,
};
