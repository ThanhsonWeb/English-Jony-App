const AppError = require("../utils/appError");
const { PASSWORD_TOO_LONG } = require("../utils/passwordPolicy");

// Only known, fixed validation messages can reach a production client.
const safeValidationMessages = new Set([
	"name must have at least 3 characters", "maximum 20 characters",
	"please provide a valid email", "user must have an email",
	"Password must be at least 8 characters", "Passwords are not the same", PASSWORD_TOO_LONG,
]);

function expectedError(error) {
	if (error.name === "CastError") return new AppError("Invalid input.", 400);
	if (error.code === 11000) return new AppError("A record with these details already exists.", 400);
	if (error.name === "ValidationError") {
		const messages = Object.values(error.errors || {}).map(item =>
			safeValidationMessages.has(item.message) ? item.message : "Invalid input. Check the provided fields.");
		return new AppError([...new Set(messages)].join(" ") || "Invalid input.", 400);
	}
	if (error.type === "entity.parse.failed") return new AppError("Invalid JSON request body.", 400);
	if (error.type === "entity.too.large") return new AppError("Request body is too large.", 413);
	if (error instanceof URIError) return new AppError("Invalid request URL.", 400);
	return error;
}

module.exports = (err, req, res, next) => {
	if (res.headersSent) return next(err);
	if (process.env.NODE_ENV === "development") {
		return res.status(err.statusCode || 500).json({
			status: err.status || "error", message: err.message, error: err, stack: err.stack,
		});
	}
	// Production, test and unsupported/unset environments all fail safely.
	const error = expectedError(err);
	if (!error.isOperational) {
		return res.status(500).json({ status: "error", message: "Something went wrong. Please try again later." });
	}
	return res.status(error.statusCode || 500).json({
		status: error.status || "error", message: error.message,
		...(error.code === "passwordTooLong" ? { code: error.code } : {}),
	});
};
