const assert = require("node:assert/strict");
const { test } = require("node:test");
const express = require("express");
const { createLearningRateLimits, learningRateLimitPolicy, peerKey } = require("../middleware/learningRateLimit");

async function fixture(t, overrides = {}) {
	const limits = createLearningRateLimits({ ...learningRateLimitPolicy, readUser: 5, writeUser: 3, readPeer: 100, writePeer: 100, ...overrides });
	const app = express();
	app.set("trust proxy", 1); // Reproduce the existing spoofable req.ip configuration.
	app.use(express.json());
	let authCalls = 0, writes = 0;
	app.use("/learning", limits.peer, (req, res, next) => {
		authCalls++;
		// Isolated identity stub only: production uses protect and a database user.
		const user = req.get("X-Test-User");
		if (!user) return res.status(401).json({ status: "fail" });
		req.user = { _id: user }; next();
	}, limits.user, (req, res) => {
		if (req.method === "POST" || req.method === "PATCH") writes++;
		res.json({ status: "success", ip: req.ip });
	});
	const server = await new Promise(resolve => { const listener = app.listen(0, "127.0.0.1", () => resolve(listener)); });
	t.after(() => new Promise(resolve => server.close(resolve)));
	return {
		get authCalls() { return authCalls; }, get writes() { return writes; },
		async request(method = "GET", path = "/progress", user = "A", headers = {}, body) {
			const response = await fetch(`http://127.0.0.1:${server.address().port}/learning${path}`, {
				method, headers: { ...(user ? { "X-Test-User": user } : {}), "Content-Type": "application/json", ...headers },
				...(body ? { body: JSON.stringify(body) } : {}),
			});
			return { status: response.status, headers: response.headers, body: await response.json() };
		},
	};
}

function limited(response) {
	assert.equal(response.status, 429);
	assert.equal(response.body.status, "fail");
	assert.equal(response.body.code, "learningRateLimited");
	assert.ok(Number(response.headers.get("retry-after")) >= 1);
	assert.match(response.headers.get("ratelimit-policy"), /learning-/);
}

test("user writes share a quota across routes, payloads and task IDs, regardless of forwarded IP", async t => {
	const f = await fixture(t);
	for (const path of ["/dialogue/task/1", "/story/task/2", "/activity"]) {
		assert.equal((await f.request("POST", path)).status, 200);
	}
	limited(await f.request("PATCH", "/story/task/999?user=B", "A", { "X-Forwarded-For": "198.51.100.8" }, { user: "B", taskId: "other" }));
	assert.equal(f.writes, 3);
	assert.equal((await f.request("GET")).status, 200, "Blocked writes do not block progress reads");
});

test("multiple legitimate users behind one peer have independent user quotas", async t => {
	const f = await fixture(t);
	for (let i = 0; i < 3; i++) {
		assert.equal((await f.request("POST", "/activity", "A")).status, 200);
		assert.equal((await f.request("POST", "/activity", "B")).status, 200);
	}
	limited(await f.request("POST", "/activity", "A"));
	assert.equal((await f.request("POST", "/activity", "C")).status, 200);
});

test("peer limit runs before authentication and cannot be reset by forged forwarding headers", async t => {
	const f = await fixture(t, { writePeer: 3 });
	for (let i = 0; i < 3; i++) assert.equal((await f.request("POST", "/activity", null, { "X-Forwarded-For": `198.51.100.${i + 1}` })).status, 401);
	limited(await f.request("POST", "/activity", "A", { "X-Forwarded-For": "203.0.113.10", "X-Real-IP": "203.0.113.11", Forwarded: "for=203.0.113.12" }));
	assert.equal(f.authCalls, 3); assert.equal(f.writes, 0);
});

test("trusted-proxy req.ip spoofing remains possible but does not grant a new learning peer budget", async t => {
	const f = await fixture(t, { readPeer: 2 });
	assert.equal((await f.request("GET", "/progress", "A", { "X-Forwarded-For": "198.51.100.1" })).body.ip, "198.51.100.1");
	assert.equal((await f.request("GET", "/progress", "A", { "X-Forwarded-For": "198.51.100.2" })).body.ip, "198.51.100.2");
	limited(await f.request("GET", "/progress", "B", { "X-Forwarded-For": "198.51.100.3" }));
});

test("reads and writes have separate user and peer budgets", async t => {
	const f = await fixture(t, { readPeer: 5 });
	for (let i = 0; i < 5; i++) assert.equal((await f.request()).status, 200);
	limited(await f.request());
	for (let i = 0; i < 3; i++) assert.equal((await f.request("PATCH")).status, 200);
	limited(await f.request("PATCH"));
});

test("rate limits recover after their window", async t => {
	const f = await fixture(t, { windowMs: 250, writeUser: 1 });
	assert.equal((await f.request("POST")).status, 200);
	limited(await f.request("POST"));
	await new Promise(resolve => setTimeout(resolve, 300));
	assert.equal((await f.request("POST")).status, 200);
	assert.equal(f.writes, 2);
});

test("production policy permits a rapid 200-answer burst plus repeated catalogue reads", async t => {
	const f = await fixture(t, learningRateLimitPolicy);
	// Cheap mock endpoints only, not transactions or a performance/load test.
	for (let i = 0; i < 200; i++) assert.equal((await f.request("POST", `/task/${i}`)).status, 200);
	for (let i = 0; i < 120; i++) assert.equal((await f.request("GET", `/course/${i % 12}`)).status, 200);
	assert.equal(f.writes, 200);
});

test("peer keys ignore forwarded identity, normalize mapped IPv4 and aggregate IPv6 subnets", () => {
	const key = address => peerKey({ socket: { remoteAddress: address }, ip: "untrusted", headers: { "x-forwarded-for": "untrusted" } });
	assert.equal(key("::ffff:192.0.2.1"), key("192.0.2.1"));
	assert.notEqual(key("192.0.2.1"), key("192.0.2.2"));
	assert.equal(key("2001:db8:abcd:1200::1"), key("2001:db8:abcd:1200::2"));
	assert.equal(peerKey({}), "unknown-peer");
});

test("attempt issuance has a separate generous per-user quota shared by all task IDs", async t => {
	const policy = { ...learningRateLimitPolicy, attemptUser: 2 };
	const limits = createLearningRateLimits(policy), app = express();
	app.use((req, res, next) => { req.user = { _id: req.get("X-Test-User") }; next(); }, limits.attempt);
	app.post("/tasks/:id/attempt", (req, res) => res.json({ status: "success" }));
	const server = await new Promise(resolve => { const listener = app.listen(0, "127.0.0.1", () => resolve(listener)); });
	t.after(() => new Promise(resolve => server.close(resolve)));
	const request = (id, user = "A") => fetch(`http://127.0.0.1:${server.address().port}/tasks/${id}/attempt`, { method: "POST", headers: { "X-Test-User": user, "X-Forwarded-For": `198.51.100.${id}` } });
	assert.equal((await request(1)).status, 200); assert.equal((await request(2)).status, 200);
	assert.equal((await request(3)).status, 429); assert.equal((await request(3, "B")).status, 200);
	assert.equal(learningRateLimitPolicy.attemptUser, 180);
});
