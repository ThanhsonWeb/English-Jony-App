const assert = require("node:assert/strict");
const { before, after, beforeEach, test } = require("node:test");
const express = require("express");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const User = require("../models/userModel");
const XPEvent = require("../models/xpEventModel");
const { getPeriodBounds, getLeaderboard } = require("../services/leaderboard");
const leaderboardRoutes = require("../routes/leaderboardRoutes");
const StudyActivity = require("../models/studyActivityModel");

const NOW = new Date("2026-09-18T12:00:00Z");
const PUBLIC_KEYS = ["avatar", "completedWeekdays", "currentLevelXp", "id", "isCurrentUser", "level", "lifetimeXp", "name", "nextLevelXp", "periodXp", "progressPercent", "rank", "streakDays"];
let replicaSet;
let server;
let baseUrl;
let user;
let token;
const previousSecret = process.env.JWT_SECRET;
const testSecret = "isolated-leaderboard-test-secret";

before(async () => {
	process.env.JWT_SECRET = testSecret;
	// Always isolated: never load .env or connect to the application's database.
	replicaSet = await MongoMemoryReplSet.create({ binary: { version: "7.0.14" }, replSet: { count: 1 } });
	await mongoose.connect(replicaSet.getUri(), { dbName: "leaderboard_test" });
	await Promise.all([User.init(), XPEvent.init()]);
	const app = express();
	app.use("/api/v1/leaderboard", leaderboardRoutes);
	app.use((error, req, res, next) => res.status(error.statusCode || 500).json({ message: error.message }));
	server = await new Promise(resolve => {
		const listener = app.listen(0, "127.0.0.1", () => resolve(listener));
	});
	baseUrl = `http://127.0.0.1:${server.address().port}/api/v1/leaderboard`;
}, { timeout: 180000 });

after(async () => {
	if (server) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
	await mongoose.disconnect();
	await replicaSet?.stop();
	if (previousSecret === undefined) delete process.env.JWT_SECRET;
	else process.env.JWT_SECRET = previousSecret;
});

async function learner(name, totalXp = 1000) {
	const _id = new mongoose.Types.ObjectId();
	return User.create({ _id, name, email: `${_id}@example.com`, googleId: `private-${_id}`, totalXp, photo: `/avatars/${_id}.png` });
}

beforeEach(async () => {
	await Promise.all([XPEvent.deleteMany({}), User.deleteMany({}), StudyActivity.deleteMany({})]);
	user = await learner("Current Learner", 5000);
	token = jwt.sign({ id: user.id }, testSecret, { expiresIn: "1h" });
});

async function event(recipient, amount, earnedAt = NOW) {
	return XPEvent.create({
		user: recipient._id, awardKey: String(new mongoose.Types.ObjectId()),
		sourceType: "dialogue_task", sourceId: "test/task", amount,
		earnedAt: new Date(earnedAt), dayKey: "2000-01-01", ruleVersion: 1,
	});
}

function ranking(options = {}) {
	return getLeaderboard({ userId: user._id, now: NOW, ...options });
}

async function request(query = "", authToken = token) {
	const response = await fetch(`${baseUrl}${query}`, {
		headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
	});
	return { status: response.status, cacheControl: response.headers.get("cache-control"), body: await response.json() };
}

test("period XP determines order; lifetime totals come from User", async () => {
	const first = await learner("Top Learner", 80);
	const second = await learner("Second Learner", 9000);
	await event(first, 30);
	await event(first, 20);
	await event(second, 40);
	await event(user, 10);
	await event(second, 500, "2026-08-01T00:00:00Z");
	const result = await ranking();
	assert.deepEqual(result.leaderboard.map(row => [row.id, row.rank, row.periodXp, row.lifetimeXp]), [
		[first.id, 1, 50, 80], [second.id, 2, 40, 9000], [user.id, 3, 10, 5000],
	]);
	assert.equal(result.totalRanked, 3);
});

test("equal XP uses stable ascending user IDs and sequential positions", async () => {
	const a = await learner("Zeta Learner");
	const b = await learner("Alpha Learner");
	for (const candidate of [b, user, a]) await event(candidate, 10);
	const result = await ranking();
	assert.deepEqual(result.leaderboard.map(row => row.id), [a.id, b.id, user.id].sort());
	assert.deepEqual(result.leaderboard.map(row => row.rank), [1, 2, 3]);
	assert.deepEqual((await ranking()).leaderboard, result.leaderboard);
});

test("streaks use only qualified days for leaderboard and unranked current user", async () => {
	const leader = await learner("Leader");
	await event(leader, 10);
	await StudyActivity.create([
		{ user: leader._id, date: "2026-09-18", hasQualifiedStudy: true },
		{ user: user._id, date: "2026-09-16", hasQualifiedStudy: true },
		{ user: user._id, date: "2026-09-17", hasQualifiedStudy: true },
		{ user: user._id, date: "2026-09-18", count: 100 },
	]);
	const result = await ranking({ limit: 1 });
	assert.equal(result.leaderboard[0].streakDays, 1);
	assert.equal(result.currentUser.rank, null);
	assert.equal(result.currentUser.streakDays, 2);
	assert.deepEqual(result.currentUser.completedWeekdays, [false, false, true, true, false, false, false]);
	assert.equal((await ranking({ timeframe: "previous" })).currentUser.streakDays, 2);
	await event(user, 1);
	assert.equal((await ranking({ limit: 1 })).currentUser.streakDays, 2);
});

test("level follows lifetime XP for ranked, outside-top and unranked users across periods", async () => {
	await User.updateOne({ _id: user._id }, { $set: { totalXp: 175 } });
	const leader = await learner("Leader", 1000);
	await event(leader, 90);
	await event(user, 10);
	const result = await ranking({ limit: 1 });
	assert.equal(result.leaderboard[0].level, 5);
	assert.equal(result.leaderboard[0].nextLevelXp, null);
	assert.equal(result.leaderboard[0].progressPercent, 100);
	for (const options of [{ limit: 1 }, { period: "week" }, { timeframe: "previous" }]) {
		const { currentUser } = await ranking(options);
		assert.equal(currentUser.level, 2);
		assert.equal(currentUser.currentLevelXp, 75);
		assert.equal(currentUser.nextLevelXp, 150);
		assert.equal(currentUser.progressPercent, 50);
	}
	await User.collection.updateOne({ _id: user._id }, { $unset: { totalXp: "" } });
	assert.equal((await ranking()).currentUser.level, 1);
	assert.equal((await ranking({ timeframe: "previous" })).currentUser.level, 1);
});

test("current user rank is included outside the requested top users", async () => {
	const a = await learner("First Learner");
	const b = await learner("Second Learner");
	await event(a, 30);
	await event(b, 20);
	await event(user, 10);
	const result = await ranking({ limit: 1 });
	assert.equal(result.leaderboard.length, 1);
	assert.equal(result.leaderboard[0].id, a.id);
	assert.equal(result.currentUser.id, user.id);
	assert.equal(result.currentUser.rank, 3);
	assert.equal(result.currentUser.periodXp, 10);
	assert.equal(result.currentUser.lifetimeXp, 5000);
	assert.equal(result.currentUser.isCurrentUser, true);
});

test("users without selected-period XP are unranked despite lifetime XP", async () => {
	await event(user, 50, "2026-08-01T00:00:00Z");
	const other = await learner("Active Learner");
	await event(other, 20);
	const result = await ranking();
	assert.equal(result.leaderboard.length, 1);
	assert.equal(result.currentUser.rank, null);
	assert.equal(result.currentUser.periodXp, 0);
	assert.equal(result.currentUser.lifetimeXp, 5000);
});

test("empty period returns an empty list and an unranked current user", async () => {
	const result = await ranking();
	assert.deepEqual(result.leaderboard, []);
	assert.equal(result.totalRanked, 0);
	assert.equal(result.currentUser.rank, null);
});

test("orphaned XP events do not occupy leaderboard positions", async () => {
	const removed = await learner("Removed Learner");
	await event(removed, 100);
	await User.deleteOne({ _id: removed._id });
	await event(user, 10);
	const result = await ranking();
	assert.equal(result.totalRanked, 1);
	assert.equal(result.currentUser.rank, 1);
});

test("week starts Monday midnight in Vietnam, not UTC midnight", () => {
	const bounds = getPeriodBounds("week", "current", NOW);
	assert.equal(bounds.start.toISOString(), "2026-09-13T17:00:00.000Z");
	assert.equal(bounds.end.toISOString(), "2026-09-20T17:00:00.000Z");
	const before = getPeriodBounds("week", "current", new Date("2026-09-13T16:59:59.999Z"));
	const after = getPeriodBounds("week", "current", new Date("2026-09-13T17:00:00.000Z"));
	assert.equal(before.end.toISOString(), after.start.toISOString());
});

test("week query includes its start and excludes its end using earnedAt", async () => {
	await event(user, 100, "2026-09-13T16:59:59.999Z");
	await event(user, 10, "2026-09-13T17:00:00.000Z");
	await event(user, 20, "2026-09-20T16:59:59.999Z");
	await event(user, 200, "2026-09-20T17:00:00.000Z");
	assert.equal((await ranking({ period: "week" })).currentUser.periodXp, 30);
	assert.equal((await ranking({ period: "week", timeframe: "previous" })).currentUser.periodXp, 100);
});

test("month query includes its start and excludes its end", async () => {
	await event(user, 100, "2026-08-31T16:59:59.999Z");
	await event(user, 10, "2026-08-31T17:00:00.000Z");
	await event(user, 20, "2026-09-30T16:59:59.999Z");
	await event(user, 200, "2026-09-30T17:00:00.000Z");
	const current = await ranking();
	assert.equal(current.start, "2026-08-31T17:00:00.000Z");
	assert.equal(current.end, "2026-09-30T17:00:00.000Z");
	assert.equal(current.currentUser.periodXp, 30);
	assert.equal((await ranking({ timeframe: "previous" })).currentUser.periodXp, 100);
});

test("previous periods handle year changes and leap-year February", () => {
	const previousMonth = getPeriodBounds("month", "previous", new Date("2026-12-31T17:00:00Z"));
	assert.equal(previousMonth.start.toISOString(), "2026-11-30T17:00:00.000Z");
	assert.equal(previousMonth.end.toISOString(), "2026-12-31T17:00:00.000Z");
	const leapMonth = getPeriodBounds("month", "previous", new Date("2024-02-29T17:00:00Z"));
	assert.equal(leapMonth.start.toISOString(), "2024-01-31T17:00:00.000Z");
	assert.equal(leapMonth.end.toISOString(), "2024-02-29T17:00:00.000Z");
	const previousWeek = getPeriodBounds("week", "previous", new Date("2026-01-01T00:00:00Z"));
	assert.equal(previousWeek.start.toISOString(), "2025-12-21T17:00:00.000Z");
	assert.equal(previousWeek.end.toISOString(), "2025-12-28T17:00:00.000Z");
});

test("HTTP response exposes only public fields for ranked and unranked users", async () => {
	await User.collection.updateOne({ _id: user._id }, { $set: {
		password: "private-hash", passwordResetToken: "private-reset-token", role: "admin",
	} });
	let response = await request();
	assert.equal(response.status, 200);
	assert.deepEqual(Object.keys(response.body.data.currentUser).sort(), PUBLIC_KEYS);
	await event(user, 10, new Date());
	response = await request();
	assert.equal(response.body.status, "success");
	assert.equal(response.cacheControl, "private, no-store");
	assert.equal(response.body.data.period, "month");
	assert.equal(response.body.data.timeframe, "current");
	assert.equal(response.body.data.limit, 10);
	for (const row of [...response.body.data.leaderboard, response.body.data.currentUser]) {
		assert.deepEqual(Object.keys(row).sort(), PUBLIC_KEYS);
		assert.equal(row.name, user.name);
		assert.equal(row.avatar, user.photo);
	}
	assert.doesNotMatch(JSON.stringify(response.body), /private-hash|private-reset-token|@example.com|googleId|password|email/);
});

test("custom avatar takes priority over the Google photo for ranked and unranked users", async () => {
	const avatar = "https://res.cloudinary.com/studyjony/image/upload/avatar.jpg";
	await User.updateOne({ _id: user._id }, { $set: { avatar } });
	assert.equal((await ranking()).currentUser.avatar, avatar);
	await event(user, 10);
	const result = await ranking();
	assert.equal(result.currentUser.avatar, avatar);
	assert.equal(result.leaderboard[0].avatar, avatar);
});

test("HTTP filters select previous week/month and ignore caller-supplied user identity", async () => {
	const other = await learner("Other Learner");
	for (const period of ["week", "month"]) {
		const response = await request(`?period=${period}&timeframe=previous&limit=3&userId=${other.id}`);
		assert.equal(response.status, 200);
		assert.equal(response.body.data.period, period);
		assert.equal(response.body.data.timeframe, "previous");
		assert.equal(response.body.data.limit, 3);
		assert.equal(response.body.data.currentUser.id, user.id);
	}
});

test("invalid filters and limits are rejected", async () => {
	for (const query of ["period=year", "timeframe=all", "limit=0", "limit=101", "limit=1.5", "limit=bad", "limit=1&limit=2", "period=week&period=month"]) {
		assert.equal((await request(`?${query}`)).status, 400, query);
	}
});

test("leaderboard requires authentication", async () => {
	assert.equal((await request("", null)).status, 401);
});
