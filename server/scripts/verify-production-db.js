const mongoose = require("mongoose");
require("dotenv").config({ quiet: true });

const EXPECTED_COLLECTIONS = [
	{
		model: "XPEvent",
		collection: "xpevents",
		indexes: [
			{ key: { user: 1, awardKey: 1 }, unique: true, purpose: "XP duplicate protection" },
			{ key: { earnedAt: 1, user: 1 }, purpose: "leaderboard period scan" },
			{ key: { user: 1, earnedAt: -1 }, purpose: "user XP history" },
		],
	},
	{
		model: "StudyActivity",
		collection: "studyactivities",
		indexes: [
			{ key: { user: 1, date: 1 }, unique: true, purpose: "one activity row per Vietnam day" },
		],
	},
	{
		model: "User",
		collection: "users",
		indexes: [
			{ key: { email: 1 }, unique: true, purpose: "user identity" },
		],
	},
];

function sameKey(actual, expected) {
	const actualEntries = Object.entries(actual || {});
	const expectedEntries = Object.entries(expected);
	return actualEntries.length === expectedEntries.length &&
		actualEntries.every(([field, direction], index) => field === expectedEntries[index][0] && direction === expectedEntries[index][1]);
}

function inspectIndexes(actualIndexes, expectedIndexes) {
	return expectedIndexes.map(expected => {
		const sameFields = actualIndexes.filter(index => sameKey(index.key, expected.key));
		const exact = sameFields.find(index => Boolean(index.unique) === Boolean(expected.unique));
		if (exact) return { status: "ok", expected, actual: exact };
		if (sameFields.length) return { status: "incorrect", expected, actual: sameFields[0] };
		return { status: "missing", expected };
	});
}

function transactionSupport(hello) {
	const sessions = typeof hello.logicalSessionTimeoutMinutes === "number";
	const topology = hello.msg === "isdbgrid" ? "sharded cluster" : hello.setName ? `replica set (${hello.setName})` : "standalone/unknown";
	const transactions = sessions && (Boolean(hello.setName) || hello.msg === "isdbgrid") && hello.maxWireVersion >= 7;
	return { sessions, transactions, topology };
}

function formatKey(key) {
	return Object.entries(key).map(([field, direction]) => `${field}:${direction}`).join(", ");
}

async function verifyProductionDb({ uri = process.env.MONGODB_URI, output = console } = {}) {
	if (!uri) throw new Error("MONGODB_URI is required. The verifier never falls back to another database variable.");

	let failed = false;
	await mongoose.connect(uri, {
		autoIndex: false,
		autoCreate: false,
		serverSelectionTimeoutMS: 10000,
	});
	try {
		const db = mongoose.connection.db;
		const hello = await db.admin().command({ hello: 1 });
		const support = transactionSupport(hello);
		output.log(`Database: ${db.databaseName}`);
		output.log(`Topology: ${support.topology}`);
		output.log(`Logical sessions: ${support.sessions ? "SUPPORTED" : "NOT SUPPORTED"}`);
		output.log(`Transactions: ${support.transactions ? "SUPPORTED" : "NOT SUPPORTED"}`);
		if (!support.transactions) failed = true;

		const existing = new Set((await db.listCollections({}, { nameOnly: true }).toArray()).map(item => item.name));
		for (const definition of EXPECTED_COLLECTIONS) {
			output.log(`\n${definition.model} (${definition.collection})`);
			if (!existing.has(definition.collection)) {
				output.error("  MISSING COLLECTION");
				failed = true;
				continue;
			}
			const indexes = await db.collection(definition.collection).listIndexes().toArray();
			for (const index of indexes) {
				output.log(`  found ${index.name}: (${formatKey(index.key)})${index.unique ? " UNIQUE" : ""}`);
			}
			for (const result of inspectIndexes(indexes, definition.indexes)) {
				const expected = `(${formatKey(result.expected.key)})${result.expected.unique ? " UNIQUE" : ""}`;
				if (result.status === "ok") output.log(`  OK ${expected} — ${result.expected.purpose}`);
				else {
					failed = true;
					const detail = result.status === "missing"
						? "MISSING"
						: `INCORRECT OPTIONS (found${result.actual.unique ? "" : " non-"}unique index ${result.actual.name})`;
					output.error(`  ${detail}: expected ${expected} — ${result.expected.purpose}`);
				}
			}
		}

		if (failed) throw new Error("Production database readiness checks failed. No changes were made.");
		output.log("\nPASS: transaction support and required indexes are ready. No changes were made.");
	} finally {
		await mongoose.disconnect();
	}
}

if (require.main === module) {
	verifyProductionDb().catch(error => {
		console.error(`\nFAIL: ${error.message}`);
		process.exitCode = 1;
	});
}

module.exports = { EXPECTED_COLLECTIONS, inspectIndexes, transactionSupport, verifyProductionDb };
