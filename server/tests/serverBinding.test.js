const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const http = require("node:http");
const { once } = require("node:events");
const { checkHealth, checkPrivateApi } = require("../scripts/check-deployment");

const source = fs.readFileSync(path.join(__dirname, "../server.js"), "utf8");

// Execute the real entry point without loading .env, connecting to MongoDB,
// or attaching fatal-error handlers to the test runner's process.
function start(env = {}, app) {
	const handlers = new Map(), exits = [], calls = [];
	let closed = false;
	const fakeServer = { close(callback) { closed = true; callback(); } };
	const modules = {
		dotenv: { config() {} },
		mongoose: { connect() { return Promise.resolve(); } },
		"./services/avatarUpload": { assertAvatarStorageConfigured() {} },
		"./app": app || { listen(...args) { calls.push(args); args.at(-1)(); return fakeServer; } },
	};
	const server = vm.runInNewContext(source + "\nserver;", {
		require(name) { assert.ok(Object.hasOwn(modules, name), `Unexpected module: ${name}`); return modules[name]; },
		process: { env, on(event, handler) { handlers.set(event, handler); }, exit(code) { exits.push(code); } },
		console: { log() {}, error() {} },
	}, { filename: "server.js", timeout: 1000 });
	return { server, handlers, exits, calls, closed: () => closed };
}

for (const [name, env, port] of [
	["default port", {}, 5000],
	["configured port", { PORT: "54321" }, "54321"],
	["wildcard environment cannot broaden the listener", { HOST: "0.0.0.0" }, 5000],
]) test(`server binds only IPv4 loopback: ${name}`, () => {
	const { calls } = start(env);
	assert.equal(calls.length, 1);
	assert.equal(calls[0][0], port);
	assert.equal(calls[0][1], "127.0.0.1");
	assert.equal(typeof calls[0][2], "function");
});

test("loopback binding preserves shutdown on an unhandled rejection", () => {
	const running = start();
	running.handlers.get("unhandledRejection")(new Error("disposable startup failure"));
	assert.equal(running.closed(), true);
	assert.deepEqual(running.exits, [1]);
});

test("real IPv4 listener supports deployment probes and the reported local Nginx upstream", async t => {
	// Real Express routes and sockets, with no database credentials or records.
	const app = require("../app");
	const { server } = start({ PORT: "0" }, app);
	t.after(() => new Promise(resolve => { server.closeAllConnections(); server.close(resolve); }));
	await once(server, "listening");
	assert.equal(server.address().address, "127.0.0.1");
	assert.equal(server.address().family, "IPv4");
	const upstreamPort = server.address().port;
	const health = `http://127.0.0.1:${upstreamPort}/health`;
	await checkHealth(health, { attempts: 1 });
	await checkPrivateApi(health);

	// Model the confirmed proxy_pass http://127.0.0.1:5000 transport on an
	// ephemeral port. This is a local transport test, not a live Nginx/TLS test.
	const proxy = http.createServer((request, response) => {
		const upstream = http.request({ hostname: "127.0.0.1", port: upstreamPort,
			path: request.url, method: request.method }, result => {
			response.writeHead(result.statusCode, result.headers);
			result.pipe(response);
		});
		upstream.on("error", () => { response.writeHead(502); response.end(); });
		request.pipe(upstream);
	});
	t.after(() => new Promise(resolve => { proxy.closeAllConnections(); proxy.close(resolve); }));
	proxy.listen(0, "127.0.0.1");
	await once(proxy, "listening");
	const proxyHealth = `http://127.0.0.1:${proxy.address().port}/health`;
	await checkHealth(proxyHealth, { attempts: 1 });
	await checkPrivateApi(proxyHealth);
});
