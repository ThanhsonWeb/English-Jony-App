const { isIP } = require("node:net");
const { ipKeyGenerator } = require("express-rate-limit");
const AppError = require("./appError");

// Verified Nginx upstream: 127.0.0.1:5000. Trust only the socket peer,
// never a second forwarded hop (even if that header claims to be loopback).
function trustNginxProxy(address, hop) {
	return hop === 0 && (address === "127.0.0.1" || address === "::ffff:127.0.0.1");
}

function mobileClientIpKey(req) {
	let address = req.ip; // Express applies the trusted-proxy policy right to left.
	if (!isIP(address) || address.includes("%")) {
		throw new AppError("Sign-in is temporarily unavailable. Please try again later.", 503);
	}
	if (isIP(address) === 6) {
		// Normalize mapped IPv4 before IPv6 subnet grouping, otherwise unrelated
		// IPv4 clients represented as ::ffff:x.x.x.x would share one /56 budget.
		const mapped = /^\[::ffff:([0-9a-f]+):([0-9a-f]+)\]$/.exec(new URL(`http://[${address}]/`).hostname);
		if (mapped) {
			const high = parseInt(mapped[1], 16), low = parseInt(mapped[2], 16);
			address = [high >> 8, high & 255, low >> 8, low & 255].join(".");
		}
	}
	return ipKeyGenerator(address);
}

module.exports = { trustNginxProxy, mobileClientIpKey };
