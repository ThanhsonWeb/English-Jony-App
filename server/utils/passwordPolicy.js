const AppError = require("./appError");

const MAX_PASSWORD_BYTES = 72;
const PASSWORD_TOO_LONG = `Password must be at most ${MAX_PASSWORD_BYTES} UTF-8 bytes`;
const passwordFitsBcrypt = value => typeof value === "string" && Buffer.byteLength(value, "utf8") <= MAX_PASSWORD_BYTES;

function assertPasswordByteLimit(value) {
	if (typeof value === "string" && !passwordFitsBcrypt(value)) {
		throw Object.assign(new AppError(PASSWORD_TOO_LONG, 400), { code: "passwordTooLong" });
	}
}

module.exports = { MAX_PASSWORD_BYTES, PASSWORD_TOO_LONG, passwordFitsBcrypt, assertPasswordByteLimit };
