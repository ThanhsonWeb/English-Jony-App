const assert = require("node:assert/strict");
const { test } = require("node:test");
const express = require("express");
const { trustNginxProxy, mobileClientIpKey } = require("../utils/trustedProxy");

function request(peer, headers = {}) {
	const app = express(); app.set("trust proxy", trustNginxProxy);
	return Object.assign(Object.create(app.request), { app, socket: { remoteAddress: peer }, headers });
}

test("only the verified local Nginx peer is trusted, and only at hop zero", () => {
	for (const address of ["127.0.0.1", "::ffff:127.0.0.1"]) {
		assert.equal(trustNginxProxy(address, 0), true);
		assert.equal(trustNginxProxy(address, 1), false);
	}
	for (const address of ["::1", "127.0.0.2", "162.4.177.199", "10.0.0.1", "192.0.2.1", undefined]) {
		assert.equal(trustNginxProxy(address, 0), false);
	}
});

test("Express selects the Nginx-appended client, ignoring forged earlier addresses and unrelated headers", () => {
	for (const peer of ["127.0.0.1", "::ffff:127.0.0.1"]) {
		for (const prefix of ["192.0.2.1", "198.51.100.1, 10.0.0.1", "127.0.0.1", "::1", "unknown", "not-an-ip"]) {
			const req = request(peer, { "x-forwarded-for": `${prefix}, 203.0.113.20`,
				"x-real-ip": "192.0.2.200", forwarded: "for=192.0.2.201", "cf-connecting-ip": "192.0.2.202" });
			assert.equal(req.ip, "203.0.113.20");
			assert.equal(mobileClientIpKey(req), "203.0.113.20");
		}
	}
	// A loopback-looking rightmost address must not cause a second trusted hop.
	assert.equal(request("127.0.0.1", { "x-forwarded-for": "192.0.2.99, 127.0.0.1" }).ip, "127.0.0.1");
});

test("direct non-Nginx connections cannot select their IP or HTTPS status with forwarding headers", () => {
	for (const peer of ["192.0.2.10", "2001:db8::10", "::1", "127.0.0.2"]) {
		const req = request(peer, { "x-forwarded-for": "198.51.100.1", "x-real-ip": "198.51.100.2", "x-forwarded-proto": "https" });
		assert.equal(req.ip, peer); assert.equal(req.protocol, "http");
	}
	assert.equal(request("127.0.0.1", { "x-forwarded-for": "203.0.113.20", "x-forwarded-proto": "https" }).protocol, "https");
});

test("missing forwarding headers use the actual peer; X-Real-IP alone grants no identity", () => {
	assert.equal(request("127.0.0.1", { "x-real-ip": "198.51.100.1" }).ip, "127.0.0.1");
	assert.equal(mobileClientIpKey(request("192.0.2.1")), "192.0.2.1");
});

test("malformed selected client addresses fail closed instead of creating attacker-selected keys", () => {
	for (const address of ["unknown", "198.51.100.1:1234", "[2001:db8::1]", "fe80::1%eth0"]) {
		assert.throws(() => mobileClientIpKey(request("127.0.0.1", { "x-forwarded-for": address })), { statusCode: 503 });
	}
	assert.throws(() => mobileClientIpKey({}), { statusCode: 503 });
});

test("IPv4 aliases share a key; different IPv4 clients separate; IPv6 keeps subnet protection", () => {
	const key = address => mobileClientIpKey(request("127.0.0.1", { "x-forwarded-for": address }));
	for (const address of ["192.0.2.1", "::ffff:192.0.2.1", "::ffff:c000:201", "0:0:0:0:0:ffff:c000:201"]) {
		assert.equal(key(address), "192.0.2.1");
	}
	assert.notEqual(key("::ffff:192.0.2.1"), key("::ffff:192.0.2.2"));
	assert.equal(key("2001:db8:1234:5600::1"), key("2001:db8:1234:56ff::ffff"));
	assert.notEqual(key("2001:db8:1234:5600::1"), key("2001:db8:1234:5700::1"));
});
