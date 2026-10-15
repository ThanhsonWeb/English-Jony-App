const assert = require("node:assert/strict");
const { test } = require("node:test");
const AppError = require("../utils/appError");
const leaderboardService = require("../services/leaderboard");

let lookup;
leaderboardService.getLeaderboard = options => lookup(options);
const { getPublicProfile } = require("../controllers/leaderboardController");

function request(userId) {
	return new Promise((resolve, reject) => {
		const headers = {};
		const res = {
			set(name, value) { headers[name] = value; return this; },
			status(statusCode) { this.statusCode = statusCode; return this; },
			json(body) { resolve({ statusCode: this.statusCode, headers, body }); },
		};
		getPublicProfile({ params: { userId } }, res, reject);
	});
}

test("public profile returns current-month values and only approved fields", async () => {
	const id = "507f1f77bcf86cd799439011";
	let options;
	lookup = async value => {
		options = value;
		return { currentUser: {
			id, name: "Learner", avatar: "/avatar.png", level: 5,
			rank: 12, periodXp: 456, streakDays: 3,
			email: "private@example.com", password: "private", lifetimeXp: 2000,
		} };
	};
	const result = await request(id);
	assert.deepEqual(options, { userId: id, period: "month", timeframe: "current", limit: 1 });
	assert.equal(result.statusCode, 200);
	assert.equal(result.headers["Cache-Control"], "private, no-store");
	assert.deepEqual(result.body.data.profile, {
		id, name: "Learner", avatar: "/avatar.png", level: 5,
		monthlyRank: 12, monthlyXp: 456, streakDays: 3,
	});
	assert.doesNotMatch(JSON.stringify(result.body), /private|email|password|lifetimeXp/);
});

test("public profile rejects invalid and unknown user IDs", async () => {
	lookup = async () => { throw new AppError("User not found", 404); };
	await assert.rejects(request("bad-id"), error => error.statusCode === 400);
	await assert.rejects(request("507f1f77bcf86cd799439011"), error => error.statusCode === 404);
});
