const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { createRequire } = require("node:module");
const path = require("node:path");
const { test } = require("node:test");

// These children load app.js, never server.js or dotenv. They use random
// loopback ports and synthetic JSON, with no MongoDB connection or credentials.
// Keep a vulnerable parser's uncaught exception inside the child process.
function parserChild() {
	const assert = require("node:assert/strict");
	const http = require("node:http");
	const zlib = require("node:zlib");
	const app = require("./app");
	const mode = process.argv[1];
	const pack = (encoding, text) => encoding === "gzip" ? zlib.gzipSync(text)
		: encoding === "deflate" ? zlib.deflateSync(text) : Buffer.from(text);
	let server;

	async function request(route, payload, encoding) {
		return new Promise((resolve, reject) => {
			const req = http.request({
				hostname: "127.0.0.1", port: server.address().port, path: route,
				method: payload ? "POST" : "GET", agent: false,
				headers: payload ? {
					"Content-Type": "application/json",
					"Content-Encoding": encoding,
					"Content-Length": payload.length,
				} : {},
			}, response => {
				let text = "";
				response.setEncoding("utf8");
				response.on("data", chunk => { text += chunk; });
				response.on("error", reject);
				response.on("end", () => resolve({ status: response.statusCode, body: JSON.parse(text) }));
			});
			req.on("error", reject);
			req.setTimeout(3000, () => req.destroy(new Error("Local parser request timed out")));
			req.end(payload);
		});
	}

	(async () => {
		await new Promise(resolve => { server = app.listen(0, "127.0.0.1", resolve); });
		try {
			if (mode === "compatibility") {
				for (const encoding of ["identity", "gzip", "deflate"]) {
					// POST /health is deliberately not a route. A 404 confirms parsing
					// completed; no authentication handler or database is invoked.
					assert.equal((await request("/health", pack(encoding, '{"word":"book"}'), encoding)).status, 404);
					const malformed = await request("/health", pack(encoding, '{"word":'), encoding);
					assert.equal(malformed.status, 400);
					assert.equal(malformed.body.message, "Invalid JSON request body.");
					const large = pack(encoding, JSON.stringify({ word: "x".repeat(101 * 1024) }));
					assert.equal((await request("/health", large, encoding)).status, 413);
				}
				for (const route of ["/api/v1/users/me", "/api/v1/vocab"]) {
					assert.equal((await request(route)).status, 401);
				}
			} else {
				const encoded = pack(mode, '{"word":"book"}');
				const wireBody = Buffer.concat([encoded, Buffer.from([0]), Buffer.alloc(128 * 1024, 88)]);
				assert.equal((await request("/health", wireBody, mode)).status, 404);
				// A completed response alone is insufficient: the old decoder can
				// crash afterwards, when it receives the remaining request bytes.
				await new Promise(resolve => setTimeout(resolve, 250));
			}
			const health = await request("/health");
			assert.equal(health.status, 200);
			assert.equal(health.body.status, "ok");
		} finally {
			server.closeAllConnections();
			await new Promise(resolve => server.close(resolve));
		}
		process.stdout.write("PARSER_TEST_PASS");
	})().catch(() => { process.stderr.write("PARSER_TEST_FAILURE"); process.exit(1); });
}

function runParserChild(mode) {
	const env = Object.fromEntries(["PATH", "SystemRoot", "WINDIR", "TEMP", "TMP"]
		.filter(key => process.env[key] !== undefined).map(key => [key, process.env[key]]));
	Object.assign(env, { NODE_ENV: "production", FRONTEND_URL: "https://studyjony.test" });
	const child = spawnSync(process.execPath, ["-e", "(" + parserChild.toString() + ")()", mode], {
		cwd: path.join(__dirname, ".."), env, encoding: "utf8", timeout: 15000, windowsHide: true,
	});
	assert.equal(child.error, undefined, "The isolated parser test must finish within its timeout");
	assert.equal(child.status, 0, "The isolated parser process must survive the request");
	assert.equal(child.stdout, "PARSER_TEST_PASS");
	assert.equal(child.stderr, "");
}

test("Express resolves the patched body-parser 2.x dependency", () => {
	const fromExpress = createRequire(require.resolve("express"));
	const { version } = fromExpress("body-parser/package.json");
	const [major, minor] = version.split(".").map(Number);
	assert.equal(major, 2);
	assert.ok(minor >= 4, "body-parser must include the 2.4.0 compressed-body security fix");
});

test("real API parsing preserves JSON, compression, limits, safe errors and private-route denial", () => {
	runParserChild("compatibility");
});

for (const encoding of ["gzip", "deflate"]) {
	test(encoding + " trailing bytes cannot crash the real API after its response", () => {
		runParserChild(encoding);
	});
}
