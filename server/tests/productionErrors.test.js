const assert = require("node:assert/strict");
const { test } = require("node:test");
const mongoose = require("mongoose");
const handler = require("../controllers/errorController");
const AppError = require("../utils/appError");

function response(error, environment) {
	const previous = process.env.NODE_ENV;
	if (environment === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = environment;
	let body, status;
	try { handler(error, {}, { headersSent: false, status(value) { status = value; return this; }, json(value) { body = value; } }, () => assert.fail("unexpected next")); }
	finally { if (previous === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous; }
	return { status, body };
}

test("production and unsupported environments hide unexpected database/implementation errors", () => {
	for (const environment of ["production", "test", "staging", "", undefined]) {
		const error = Object.assign(new Error("database password and collection internals"), { statusCode: 403 });
		const result = response(error, environment);
		assert.equal(result.status, 500);
		assert.deepEqual(result.body, { status: "error", message: "Something went wrong. Please try again later." });
	}
});

test("Mongo casts, nested validation casts and duplicate keys do not disclose raw input or internals", () => {
	const cast = new mongoose.Error.CastError("ObjectId", "private-value", "_id");
	const validation = new mongoose.Error.ValidationError(); validation.addError("_id", cast);
	for (const error of [cast, validation, Object.assign(new Error("private collection"), { code: 11000, keyValue: { email: "private@example.test" } })]) {
		const result = response(error, "production");
		assert.equal(result.status, 400);
		assert.doesNotMatch(JSON.stringify(result.body), /private|CastError|ObjectId|Mongoose|collection|stack/);
	}
});

test("expected 400/401/403/404 messages remain useful; malformed JSON is safe", () => {
	for (const status of [400, 401, 403, 404]) {
		const result = response(new AppError("Safe expected message", status), "production");
		assert.equal(result.status, status); assert.equal(result.body.message, "Safe expected message");
	}
	assert.equal(response(Object.assign(new SyntaxError("secret JSON"), { type: "entity.parse.failed" }), "production").status, 400);
});

test("development retains diagnostics; headers already sent delegate without another response", () => {
	const error = new Error("development diagnostic");
	const result = response(error, "development");
	assert.equal(result.status, 500); assert.equal(result.body.error, error); assert.match(result.body.stack, /development diagnostic/);
	let delegated;
	handler(error, {}, { headersSent: true, status() { assert.fail("second response"); } }, value => { delegated = value; });
	assert.equal(delegated, error);
});

test("forgot-password returns its uniform response once, without a second response/error", async () => {
	const previous = process.env.FRONTEND_URL; process.env.FRONTEND_URL = "https://studyjony.test";
	let responses = 0, errors = 0;
	try {
		await require("../controllers/authController").forgotPassword({ body: { email: "invalid" } }, {
			status(code) { assert.equal(code, 200); return this; },
			json(body) { responses++; assert.deepEqual(body, require("../middleware/recoveryRateLimit").recoveryResponse); return this; },
		}, () => { errors++; });
		await new Promise(resolve => setImmediate(resolve));
		assert.equal(responses, 1); assert.equal(errors, 0);
	} finally { if (previous === undefined) delete process.env.FRONTEND_URL; else process.env.FRONTEND_URL = previous; }
});
