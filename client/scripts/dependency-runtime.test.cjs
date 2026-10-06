const assert = require("node:assert/strict");
const { test } = require("node:test");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { parse } = require("node:url");
const { proxyRequest } = require("next/dist/server/lib/router-utils/proxy-request");
const sharp = require("sharp");
const root = path.resolve(__dirname, "..");

test("installed Next/native image packages match the lockfile and decode/encode a real app image", async () => {
	const lock = JSON.parse(fs.readFileSync(path.join(root, "package-lock.json")));
	for (const name of ["next", "eslint-config-next", "sharp", "@next/env", "@next/swc-win32-x64-msvc"]) {
		const file = path.join(root, "node_modules", name, "package.json");
		if (!fs.existsSync(file)) continue; // The platform SWC package differs on Linux/macOS.
		assert.equal(JSON.parse(fs.readFileSync(file)).version, lock.packages[`node_modules/${name}`].version);
	}
	const buffer = await sharp(path.join(root, "public/lugo.png")).resize(64, 64).webp().toBuffer();
	const metadata = await sharp(buffer).metadata();
	assert.equal(metadata.format, "webp"); assert.equal(metadata.width, 64); assert.equal(metadata.height, 64);
});

test("compiled API rewrite and actual Next proxy preserve method, query, JSON, cookies and error status", async t => {
	const manifest = JSON.parse(fs.readFileSync(path.join(root, ".next/routes-manifest.json")));
	const rewrites = Array.isArray(manifest.rewrites) ? manifest.rewrites : Object.values(manifest.rewrites).flat();
	const rule = rewrites.find(rule => rule.source === "/api/v1/:path*");
	assert.ok(rule); assert.ok(rule.destination.endsWith("/api/v1/:path*"));
	const received = [];
	const upstream = http.createServer(async (req, res) => {
		let body = ""; for await (const chunk of req) body += chunk;
		received.push({ method: req.method, url: req.url, cookie: req.headers.cookie, body });
		res.setHeader("Content-Type", "application/json");
		res.setHeader("Set-Cookie", "jwt=synthetic-response; HttpOnly; Path=/");
		res.statusCode = req.url.startsWith("/api/v1/users/me") ? 401 : 200;
		res.end(JSON.stringify({ status: res.statusCode === 200 ? "success" : "fail" }));
	});
	await new Promise(resolve => upstream.listen(0, "127.0.0.1", resolve));
	const frontend = http.createServer((req, res) => {
		assert.match(new URL(req.url, "http://localhost").pathname, new RegExp(rule.regex));
		// Replace only the destination origin with a local mock; never contact the configured API.
		const target = parse(`http://127.0.0.1:${upstream.address().port}${req.url}`, true);
		proxyRequest(req, res, target, undefined, undefined, 2000).catch(error => res.destroy(error));
	});
	await new Promise(resolve => frontend.listen(0, "127.0.0.1", resolve));
	t.after(async () => {
		await Promise.all([new Promise(resolve => frontend.close(resolve)), new Promise(resolve => upstream.close(resolve))]);
	});
	const origin = `http://127.0.0.1:${frontend.address().port}`;
	const body = JSON.stringify({ email: "local@example.test", password: "synthetic-password" });
	const login = await fetch(origin + "/api/v1/auth/login?locale=en", { method: "POST", headers: { "Content-Type": "application/json", Cookie: "jwt=synthetic-request" }, body });
	assert.equal(login.status, 200); assert.equal((await login.json()).status, "success");
	assert.match(login.headers.get("set-cookie"), /jwt=synthetic-response; HttpOnly/);
	assert.deepEqual(received[0], { method: "POST", url: "/api/v1/auth/login?locale=en", cookie: "jwt=synthetic-request", body });
	const me = await fetch(origin + "/api/v1/users/me?scope=global&page=2");
	assert.equal(me.status, 401); assert.equal((await me.json()).status, "fail");
	assert.equal(received[1].url, "/api/v1/users/me?scope=global&page=2");
});
