// created your own Error object.
// Now anywhere in your app you can simply do
// next(new AppError("User not found", 404));
class AppError extends Error {
	constructor(message, statusCode) {
		super(message); // built in
		this.statusCode = statusCode;
		this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";

		this.isOperational = true;
	}
}

module.exports = AppError;
