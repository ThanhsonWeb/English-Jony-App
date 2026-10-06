const assert = require("node:assert/strict");
const { test, before, after } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const jwt = require("jsonwebtoken");
const net = require("node:net");
const nodemailer = require("nodemailer");
const User = require("../models/userModel");
const Vocabulary = require("../models/vocabModel");

let db, server, url, token;
const originalEnv = { NODE_ENV: process.env.NODE_ENV, JWT_SECRET: process.env.JWT_SECRET, FRONTEND_URL: process.env.FRONTEND_URL };
before(async () => {
	Object.assign(process.env, { NODE_ENV: "development", JWT_SECRET: "isolated-dependency-test-secret", FRONTEND_URL: "http://studyjony.test" });
	db = await MongoMemoryServer.create({ binary: { version: "7.0.14" } });
	await mongoose.connect(db.getUri(), { dbName: "dependency_compatibility_test" });
	const user = await User.create({ name: "Test Learner", email: "dependency@example.com", googleId: "isolated-dependency-subject" });
	token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: "1h" });
	await Vocabulary.insertMany(Array.from({ length: 3 }, (_, index) => ({ english: `testword${index}`, vietnamese: "Meaning ".repeat(400), user: user.id })));
	const app = require("../app");
	server = await new Promise(resolve => { const listener = app.listen(0, "127.0.0.1", () => resolve(listener)); });
	url = `http://127.0.0.1:${server.address().port}`;
}, { timeout: 180000 });
after(async () => {
	if (server) await new Promise(resolve => server.close(resolve));
	await mongoose.disconnect(); await db?.stop();
	for (const [key, value] of Object.entries(originalEnv)) {
		if (value === undefined) delete process.env[key]; else process.env[key] = value;
	}
});

for (const encoding of ["gzip", "identity"]) test(`real API middleware preserves vocabulary JSON with ${encoding} encoding`, async () => {
	const response = await fetch(url + "/api/v1/vocab", { headers: { Cookie: `jwt=${token}`, "Accept-Encoding": encoding, Origin: process.env.FRONTEND_URL } });
	assert.equal(response.status, 200);
	assert.equal(response.headers.get("content-encoding"), encoding === "gzip" ? "gzip" : null);
	assert.match(response.headers.get("vary"), /Accept-Encoding/i);
	assert.equal(response.headers.get("access-control-allow-origin"), process.env.FRONTEND_URL);
	const data = await response.json(); // Fetch decodes compressed JSON as the browser does.
	assert.equal(data.data.vocabularies.length, 3);
	assert.equal(data.data.vocabularies[0].vietnamese, "Meaning ".repeat(400).trim());
});
test("compressed API still denies unauthenticated access and serves health checks", async () => {
	const denied = await fetch(url + "/api/v1/vocab", { headers: { "Accept-Encoding": "gzip" } });
	assert.equal(denied.status, 401); assert.equal((await denied.json()).status, "fail");
	const health = await fetch(url + "/health"); assert.equal(health.status, 200); assert.equal((await health.json()).status, "ok");
});

test("existing email helper sends through Nodemailer CommonJS SMTP API to a loopback mock only", async t => {
	const received = [], sockets = new Set();
	const smtp = net.createServer(socket => {
		sockets.add(socket); socket.on("close", () => sockets.delete(socket));
		let buffer = "", inMessage = false, message = [];
		socket.write("220 local.test ESMTP\r\n");
		socket.on("data", chunk => {
			buffer += chunk.toString();
			while (buffer.includes("\r\n")) {
				const end = buffer.indexOf("\r\n"), line = buffer.slice(0, end); buffer = buffer.slice(end + 2);
				if (inMessage) {
					if (line === ".") { received.push(message.join("\r\n")); inMessage = false; socket.write("250 Message accepted\r\n"); }
					else message.push(line);
				} else if (/^EHLO|^HELO/.test(line)) socket.write("250 local.test\r\n");
				else if (/^MAIL FROM:|^RCPT TO:/.test(line)) socket.write("250 OK\r\n");
				else if (line === "DATA") { message = []; inMessage = true; socket.write("354 End with dot\r\n"); }
				else if (line === "QUIT") socket.end("221 Bye\r\n");
				else socket.write("250 OK\r\n");
			}
		});
	});
	await new Promise(resolve => smtp.listen(0, "127.0.0.1", resolve));
	t.after(async () => { for (const socket of sockets) socket.destroy(); await new Promise(resolve => smtp.close(resolve)); });
	const createTransport = nodemailer.createTransport.bind(nodemailer);
	t.mock.method(nodemailer, "createTransport", options => {
		assert.equal(typeof options.host, "string"); assert.equal(typeof options.port, "number");
		// Never pass the configured real host/credentials to any transport.
		return createTransport({ host: "127.0.0.1", port: smtp.address().port, secure: false, ignoreTLS: true, connectionTimeout: 2000, greetingTimeout: 2000, socketTimeout: 2000 });
	});
	await require("../utils/email")({ email: "learner@example.test", subject: "StudyJony local recovery test", message: "Local recovery message; no real token or account." });
	assert.equal(received.length, 1);
	assert.match(received[0], /To: learner@example\.test/);
	assert.match(received[0], /Subject: StudyJony local recovery test/);
	assert.match(received[0], /Local recovery message/);
});
test("email helper still propagates transport failures without attempting live delivery", async t => {
	t.mock.method(nodemailer, "createTransport", () => ({ sendMail: async () => { throw new Error("Mock transport failure"); } }));
	await assert.rejects(require("../utils/email")({ email: "learner@example.test", subject: "Test", message: "Test" }), /Mock transport failure/);
});
