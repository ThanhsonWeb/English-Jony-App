require("dotenv").config({ quiet: true });
const mongoose = require("mongoose");
const User = require("../models/userModel");

const GOOGLE_ID_MAX_LENGTH = 255;

const auditPipeline = [
	{
		$facet: {
			statuses: [
				{
					$project: {
						status: {
							$switch: {
								branches: [
									{ case: { $in: [{ $type: "$googleId" }, ["missing", "null"]] }, then: "missing" },
									{ case: { $ne: [{ $type: "$googleId" }, "string"] }, then: "nonString" },
									{ case: { $eq: ["$googleId", ""] }, then: "empty" },
									{ case: { $eq: [{ $trim: { input: "$googleId" } }, ""] }, then: "whitespaceOnly" },
									{ case: { $ne: [{ $trim: { input: "$googleId" } }, "$googleId"] }, then: "surroundingWhitespace" },
									{ case: { $gt: [{ $strLenCP: "$googleId" }, GOOGLE_ID_MAX_LENGTH] }, then: "tooLong" },
								],
								default: "valid",
							},
						},
					},
				},
				{ $group: { _id: "$status", count: { $sum: 1 } } },
			],
			duplicates: [
				{
					$match: {
						$expr: {
							$and: [
								{ $eq: [{ $type: "$googleId" }, "string"] },
								{ $ne: [{ $trim: { input: "$googleId" } }, ""] },
							],
						},
					},
				},
				{ $group: { _id: "$googleId", userCount: { $sum: 1 } } },
				{ $match: { userCount: { $gt: 1 } } },
				{
					$group: {
						_id: null,
						groups: { $sum: 1 },
						users: { $sum: "$userCount" },
						extraRecords: { $sum: { $subtract: ["$userCount", 1] } },
					},
				},
				{ $project: { _id: 0, groups: 1, users: 1, extraRecords: 1 } },
			],
		},
	},
];

async function auditGoogleIds({ collection = User.collection, output = console } = {}) {
	const [result = { statuses: [], duplicates: [] }] = await collection.aggregate(auditPipeline, {
		readConcern: { level: "majority" },
	}).toArray();
	const counts = Object.fromEntries(result.statuses.map(({ _id, count }) => [_id, count]));
	const duplicateCounts = result.duplicates[0] || { groups: 0, users: 0, extraRecords: 0 };
	const summary = {
		totalUsers: Object.values(counts).reduce((total, count) => total + count, 0),
		googleIds: {
			valid: counts.valid || 0,
			missing: counts.missing || 0,
			malformed: {
				nonString: counts.nonString || 0,
				empty: counts.empty || 0,
				whitespaceOnly: counts.whitespaceOnly || 0,
				surroundingWhitespace: counts.surroundingWhitespace || 0,
				tooLong: counts.tooLong || 0,
			},
		},
		duplicates: {
			groups: duplicateCounts.groups,
			users: duplicateCounts.users,
			extraRecords: duplicateCounts.extraRecords,
		},
	};
	output.log(JSON.stringify(summary));
	return summary;
}

async function main() {
	const uri = process.env.DATABASE;
	if (!uri) throw new Error("DATABASE is required; audit stopped.");
	await mongoose.connect(uri, {
		autoIndex: false,
		autoCreate: false,
		readConcern: { level: "majority" },
	});
	try {
		await auditGoogleIds();
	} finally {
		await mongoose.disconnect();
	}
}

if (require.main === module) {
	main().catch(error => {
		console.error(`Google ID audit failed (${error?.name || "Error"}). No data was changed.`);
		process.exitCode = 1;
	});
}

module.exports = { GOOGLE_ID_MAX_LENGTH, auditGoogleIds };
